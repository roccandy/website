import "server-only";
import { randomUUID, createHash } from "node:crypto";
import MailComposer from "nodemailer/lib/mail-composer";
import type Mail from "nodemailer/lib/mailer";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import type {
  ArchivedAttachment,
  ArchivedEmail,
  EmailArchiveContext,
  EmailArchiveStatus,
} from "./emailArchiveTypes";

export const EMAIL_ARCHIVE_BUCKET = "order-email-archive";
const hash = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
const unique = (values: string[] = []) => [
  ...new Set(values.map((value) => value.trim()).filter(Boolean)),
];
export const validArchiveId = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id,
  );

type ArchiveMailOptions = Omit<
  Mail.Options,
  "from" | "to" | "text" | "html" | "bcc" | "subject"
> & {
  from: string;
  to: string[];
  text: string;
  html?: string;
  bcc?: string[];
  subject: string;
};
export async function prepareArchivedEmail(
  options: ArchiveMailOptions,
  context: EmailArchiveContext,
) {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const attachments: ArchivedAttachment[] = [];
  const files: { path: string; bytes: Buffer; contentType: string }[] = [];
  const normalisedAttachments = (options.attachments ?? []).map(
    (attachment, index) => {
      // All website-generated attachments are materialised bytes. Never allow
      // Nodemailer to read an arbitrary URL, file or stream for archived mail.
      if (
        attachment.path ||
        ("href" in attachment && attachment.href) ||
        attachment.raw ||
        (typeof attachment.content !== "string" &&
          !Buffer.isBuffer(attachment.content))
      ) {
        throw new Error("Email attachment must contain prepared bytes.");
      }
      const bytes = Buffer.isBuffer(attachment.content)
        ? attachment.content
        : Buffer.from(
            attachment.content as string,
            attachment.encoding as BufferEncoding | undefined,
          );
      const filename =
        typeof attachment.filename === "string"
          ? attachment.filename
          : `attachment-${index + 1}`;
      const contentType = attachment.contentType || "application/octet-stream";
      const path = `${id}/attachments/${index}`;
      attachments.push({
        filename,
        contentType,
        cid: attachment.cid || null,
        disposition:
          attachment.contentDisposition === "inline" ? "inline" : "attachment",
        path,
        bytes: bytes.length,
        sha256: hash(bytes),
      });
      files.push({ path, bytes, contentType });
      return { ...attachment, content: bytes };
    },
  );
  const messageId = `<${id}@roccandy.com.au>`;
  const compiled = new MailComposer({
    ...options,
    attachments: normalisedAttachments,
    date: new Date(createdAt),
    messageId,
    disableFileAccess: true,
    disableUrlAccess: true,
  }).compile();
  const raw = await compiled.build();
  const rawPath = `${id}/original.eml`;
  files.push({ path: rawPath, bytes: raw, contentType: "message/rfc822" });
  const orderNumbers = unique(context.orderNumbers);
  const orderIds = unique(context.orderIds).filter(validArchiveId);
  if (orderNumbers.length) {
    const { data, error } = await supabaseAdminClient
      .from("orders")
      .select("id")
      .in("order_number", orderNumbers);
    if (error)
      throw new Error(
        "Email order references could not be archived. Email was not submitted.",
      );
    orderIds.push(...(data ?? []).map((row) => String(row.id)));
  }
  if (!orderIds.length && !orderNumbers.length)
    throw new Error("Archived order email must have an order reference.");
  // Store immutable content before attempting SMTP. If this fails, no email is
  // submitted, so a later retry cannot silently lose the original document.
  for (const file of files) {
    const { error } = await supabaseAdminClient.storage
      .from(EMAIL_ARCHIVE_BUCKET)
      .upload(file.path, file.bytes, {
        contentType: file.contentType,
        upsert: false,
      });
    if (error)
      throw new Error(
        "Original email could not be archived. Email was not submitted.",
      );
  }
  const record: ArchivedEmail = {
    id,
    order_ids: unique(orderIds),
    order_numbers: orderNumbers,
    kind: context.kind,
    from_address: options.from,
    to_addresses: options.to,
    bcc_addresses: options.bcc ?? [],
    subject: options.subject || "",
    text_body: options.text,
    html_body: options.html ?? null,
    attachments,
    raw_path: rawPath,
    raw_sha256: hash(raw),
    message_id: messageId,
    status: "prepared",
    accepted_addresses: [],
    rejected_addresses: [],
    created_at: createdAt,
    completed_at: null,
  };
  const { error } = await supabaseAdminClient
    .from("order_email_archive")
    .insert(record);
  if (error)
    throw new Error(
      "Email history could not be saved. Email was not submitted.",
    );
  const envelope = compiled.getEnvelope();
  if (!envelope.from) throw new Error("Email sender is missing.");
  return { id, raw, envelope: { from: envelope.from, to: envelope.to } };
}

export async function setArchivedEmailStatus(
  id: string,
  status: EmailArchiveStatus,
  accepted: string[] = [],
  rejected: string[] = [],
) {
  const { error } = await supabaseAdminClient
    .from("order_email_archive")
    .update({
      status,
      accepted_addresses: accepted,
      rejected_addresses: rejected,
      completed_at: status === "sending" ? null : new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error("Email submission status could not be recorded.");
}

export function smtpArchiveOutcome(info: {
  accepted?: unknown[];
  rejected?: unknown[];
}) {
  const addresses = (values: unknown[] = []) =>
    values
      .map((value) =>
        typeof value === "string"
          ? value
          : value && typeof value === "object" && "address" in value
            ? String(value.address)
            : "",
      )
      .filter(Boolean);
  const accepted = addresses(info.accepted),
    rejected = addresses(info.rejected);
  const status: EmailArchiveStatus = accepted.length
    ? rejected.length
      ? "partial"
      : "accepted"
    : rejected.length
      ? "rejected"
      : "unconfirmed";
  return { status, accepted, rejected };
}

export async function sendArchivedEmail(
  options: Parameters<typeof prepareArchivedEmail>[0],
  context: EmailArchiveContext,
  submit: (message: {
    raw: Buffer;
    envelope: { from: string; to: string[] };
  }) => Promise<{ accepted?: unknown[]; rejected?: unknown[] }>,
) {
  const prepared = await prepareArchivedEmail(options, context);
  await setArchivedEmailStatus(prepared.id, "sending");
  let info;
  try {
    // The bytes archived above are precisely the bytes handed to SMTP.
    info = await submit({ raw: prepared.raw, envelope: prepared.envelope });
  } catch (error) {
    // A network timeout can happen after acceptance. Do not label it as a
    // definite failure or automatically resend an ambiguous submission.
    await setArchivedEmailStatus(prepared.id, "unconfirmed").catch(() =>
      console.error("Email archive outcome unavailable", prepared.id),
    );
    throw error;
  }
  const outcome = smtpArchiveOutcome(info);
  // Never turn a successful SMTP submission into a retryable failure solely
  // because the subsequent status write failed. 'sending' remains unconfirmed.
  await setArchivedEmailStatus(
    prepared.id,
    outcome.status,
    outcome.accepted,
    outcome.rejected,
  ).catch(() =>
    console.error("Email archive outcome unavailable", prepared.id),
  );
  if (
    outcome.status === "rejected" ||
    options.to.some((recipient) =>
      outcome.rejected.some(
        (rejected) => rejected.toLowerCase() === recipient.toLowerCase(),
      ),
    )
  )
    throw new Error(
      "A customer recipient was rejected by the mail server. Review email history before retrying.",
    );
  return { success: true as const };
}

export type EmailHistory = {
  available: boolean;
  emails: Omit<
    ArchivedEmail,
    "html_body" | "text_body" | "raw_path" | "raw_sha256" | "bcc_addresses"
  >[];
};
export async function getOrderEmailHistory(
  orderId: string,
  orderNumber?: string | null,
): Promise<EmailHistory> {
  // Match only exact saved order IDs/numbers, never customer email or a fuzzy
  // order prefix (which could expose another customer's correspondence).
  const columns =
    "id,order_ids,order_numbers,kind,from_address,to_addresses,subject,attachments,message_id,status,accepted_addresses,rejected_addresses,created_at,completed_at";
  const queries = [
    supabaseAdminClient
      .from("order_email_archive")
      .select(columns)
      .contains("order_ids", [orderId])
      .order("created_at", { ascending: false })
      .limit(100),
  ];
  if (orderNumber)
    queries.push(
      supabaseAdminClient
        .from("order_email_archive")
        .select(columns)
        .contains("order_numbers", [orderNumber])
        .order("created_at", { ascending: false })
        .limit(100),
    );
  const results = await Promise.all(queries);
  if (results.some((result) => result.error))
    return { available: false, emails: [] };
  const emails = new Map(
    results.flatMap((result) => result.data ?? []).map((row) => [row.id, row]),
  );
  return {
    available: true,
    emails: [...emails.values()]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 100) as EmailHistory["emails"],
  };
}
export async function getArchivedEmail(id: string) {
  if (!validArchiveId(id)) return null;
  const { data, error } = await supabaseAdminClient
    .from("order_email_archive")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Original email could not be loaded.");
  return data as ArchivedEmail | null;
}
export async function getInvoiceOriginals() {
  const originals = new Map<string, { emailId: string; index: number }>();
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabaseAdminClient
      .from("order_email_archive")
      .select("id,order_ids,order_numbers,attachments")
      .eq("kind", "invoice-pdf")
      .eq("status", "accepted")
      .order("created_at", { ascending: false })
      .order("id")
      .range(offset, offset + 499);
    if (error || !data)
      return new Map<string, { emailId: string; index: number }>();
    for (const email of data) {
      const index = (email.attachments as ArchivedAttachment[]).findIndex(
        (file) => file.contentType === "application/pdf",
      );
      if (index < 0) continue;
      for (const key of [...email.order_ids, ...email.order_numbers])
        if (!originals.has(key))
          originals.set(key, { emailId: email.id, index });
    }
    if (data.length < 500) break;
  }
  return originals;
}
export async function readArchivedFile(path: string, sha256: string) {
  const { data, error } = await supabaseAdminClient.storage
    .from(EMAIL_ARCHIVE_BUCKET)
    .download(path);
  if (error || !data)
    throw new Error("Original attachment could not be loaded.");
  const bytes = Buffer.from(await data.arrayBuffer());
  if (hash(bytes) !== sha256)
    throw new Error("Original attachment integrity check failed.");
  return bytes;
}
