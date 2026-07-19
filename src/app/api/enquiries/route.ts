import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { sendWebsiteEnquiryEmails } from "@/lib/email";
import { parseEnquiryRequest, type EnquiryRequestBody } from "@/lib/enquiry";
import { getClientIp, rateLimit } from "@/lib/rateLimit";

const MAX_REQUEST_BYTES = 4_250_000;
const MAX_ATTACHMENT_COUNT = 3;
const MAX_ATTACHMENT_BYTES = 4_000_000;

const ATTACHMENT_TYPES: Record<string, { contentType: string; signatures: ((content: Buffer) => boolean)[] }> = {
  pdf: {
    contentType: "application/pdf",
    signatures: [(content) => content.subarray(0, 5).toString("ascii") === "%PDF-"],
  },
  png: {
    contentType: "image/png",
    signatures: [(content) => content.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))],
  },
  jpg: {
    contentType: "image/jpeg",
    signatures: [(content) => content.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex"))],
  },
  jpeg: {
    contentType: "image/jpeg",
    signatures: [(content) => content.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex"))],
  },
  webp: {
    contentType: "image/webp",
    signatures: [
      (content) =>
        content.subarray(0, 4).toString("ascii") === "RIFF" &&
        content.subarray(8, 12).toString("ascii") === "WEBP",
    ],
  },
  heic: {
    contentType: "image/heic",
    signatures: [
      (content) =>
        content.subarray(4, 8).toString("ascii") === "ftyp" &&
        /^(heic|heix|hevc|hevx|mif1|msf1)$/.test(content.subarray(8, 12).toString("ascii")),
    ],
  },
  ai: {
    contentType: "application/postscript",
    signatures: [
      (content) => content.subarray(0, 5).toString("ascii") === "%PDF-",
      (content) => content.subarray(0, 10).toString("ascii") === "%!PS-Adobe",
    ],
  },
  eps: {
    contentType: "application/postscript",
    signatures: [(content) => content.subarray(0, 10).toString("ascii") === "%!PS-Adobe"],
  },
};

type EnquiryAttachment = {
  filename: string;
  contentType: string;
  content: Buffer;
};

function safeFilename(filename: string) {
  const basename = filename.split(/[\\/]/).pop() ?? "attachment";
  return basename
    .replace(/[\r\n\t]/g, " ")
    .replace(/[^\p{L}\p{N}._ ()-]/gu, "_")
    .trim()
    .slice(0, 120) || "attachment";
}

async function parseAttachments(values: FormDataEntryValue[]) {
  const files = values.filter(
    (value): value is File => typeof value !== "string" && value.size > 0,
  );
  if (files.length > MAX_ATTACHMENT_COUNT) {
    return { ok: false as const, error: `Please attach no more than ${MAX_ATTACHMENT_COUNT} files.` };
  }
  if (files.reduce((total, file) => total + file.size, 0) > MAX_ATTACHMENT_BYTES) {
    return { ok: false as const, error: "Attachments must be no more than 4 MB combined." };
  }

  const attachments: EnquiryAttachment[] = [];
  for (const file of files) {
    const filename = safeFilename(file.name);
    const extension = filename.split(".").pop()?.toLowerCase() ?? "";
    const allowedType = ATTACHMENT_TYPES[extension];
    if (!allowedType) {
      return {
        ok: false as const,
        error: "Attachments must be PDF, PNG, JPG, WEBP, HEIC, AI, or EPS files.",
      };
    }

    const content = Buffer.from(await file.arrayBuffer());
    if (!allowedType.signatures.some((matches) => matches(content))) {
      return { ok: false as const, error: `${filename} does not appear to be a valid ${extension.toUpperCase()} file.` };
    }
    attachments.push({ filename, contentType: allowedType.contentType, content });
  }

  return { ok: true as const, attachments };
}

async function parseRequest(request: Request) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    return {
      body: (await request.json()) as EnquiryRequestBody,
      attachments: [] as EnquiryAttachment[],
    };
  }

  const formData = await request.formData();
  const body: EnquiryRequestBody = {};
  for (const field of [
    "name",
    "email",
    "phone",
    "organisation",
    "interest",
    "requiredDate",
    "quantity",
    "message",
    "website",
    "productContext",
    "sourcePage",
    "startedAt",
  ] as const) {
    const value = formData.get(field);
    if (typeof value === "string") body[field] = value;
  }
  const attachments = await parseAttachments(formData.getAll("attachments"));
  if (!attachments.ok) throw new AttachmentValidationError(attachments.error);
  return { body, attachments: attachments.attachments };
}

class AttachmentValidationError extends Error {}

function isAllowedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    return (
      hostname === "roccandy.com.au" ||
      hostname === "www.roccandy.com.au" ||
      hostname === "localhost" ||
      hostname === "127.0.0.1"
    );
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: "Unable to submit this enquiry." }, { status: 403 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: "This enquiry is too large to submit." }, { status: 413 });
  }

  const ip = getClientIp(request);
  const limit = rateLimit(`enquiries:${ip}`, { windowMs: 10 * 60 * 1_000, max: 5 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many enquiries have been submitted. Please wait a few minutes or call us." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let body: EnquiryRequestBody;
  let attachments: EnquiryAttachment[];
  try {
    ({ body, attachments } = await parseRequest(request));
  } catch (error) {
    if (error instanceof AttachmentValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 });
  }

  const parsed = parseEnquiryRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  if (parsed.isSpam || !parsed.enquiry) {
    return NextResponse.json({ ok: true, reference: "RCQ-RECEIVED" });
  }

  const reference = `RCQ-${randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
  try {
    await sendWebsiteEnquiryEmails({
      reference,
      receivedAt: new Date().toISOString(),
      enquiry: parsed.enquiry,
      attachments,
    });
  } catch (error) {
    console.error("Website enquiry email failed:", error);
    return NextResponse.json(
      {
        error:
          "We could not send your enquiry just now. Please try again, email enquiries@roccandy.com.au, or call 0414 519 211.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true, reference });
}
