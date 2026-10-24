export type EmailArchiveContext = {
  orderIds?: string[];
  orderNumbers?: string[];
  kind: "confirmation" | "order-update" | "invoice-pdf" | "refund" | "internal";
};
export type ArchivedAttachment = {
  filename: string;
  contentType: string;
  cid: string | null;
  disposition: "inline" | "attachment";
  path: string;
  bytes: number;
  sha256: string;
};
export type EmailArchiveStatus =
  "prepared" | "sending" | "accepted" | "partial" | "rejected" | "unconfirmed";
export type ArchivedEmail = {
  id: string;
  order_ids: string[];
  order_numbers: string[];
  kind: EmailArchiveContext["kind"];
  from_address: string;
  to_addresses: string[];
  bcc_addresses: string[];
  subject: string;
  text_body: string;
  html_body: string | null;
  attachments: ArchivedAttachment[];
  raw_path: string;
  raw_sha256: string;
  message_id: string;
  status: EmailArchiveStatus;
  accepted_addresses: string[];
  rejected_addresses: string[];
  created_at: string;
  completed_at: string | null;
};
export const emailStatusLabel: Record<EmailArchiveStatus, string> = {
  prepared: "Prepared · not submitted",
  sending: "Submission started · outcome unconfirmed",
  accepted: "Accepted by mail server",
  partial: "Some recipients rejected",
  rejected: "Rejected by mail server",
  unconfirmed: "Send outcome unconfirmed",
};
export const emailKindLabel: Record<EmailArchiveContext["kind"], string> = {
  confirmation: "Order confirmation",
  "order-update": "Order update",
  "invoice-pdf": "PDF invoice",
  refund: "Refund email",
  internal: "Internal notification",
};
