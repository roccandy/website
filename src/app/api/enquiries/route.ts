import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { sendWebsiteEnquiryEmails } from "@/lib/email";
import { parseEnquiryRequest, type EnquiryRequestBody } from "@/lib/enquiry";
import { getClientIp, rateLimit } from "@/lib/rateLimit";

const MAX_REQUEST_BYTES = 30_000;

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
  try {
    body = (await request.json()) as EnquiryRequestBody;
  } catch {
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

