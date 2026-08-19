import nodemailer from "nodemailer";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { AdminCustomOrderDetails, AdminOrderSummaryEmailPayload } from "@/lib/orderEmailSummary";
import { enquiryInterestLabel, type WebsiteEnquiry } from "@/lib/enquiry";

type EmailPayload = {
  from?: string;
  to: string[];
  bcc?: string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  attachments?: nodemailer.SendMailOptions["attachments"];
};

type OrderEmailPayload = {
  orderNumber?: string | null;
  title?: string | null;
  designType?: string | null;
  quantity?: number | null;
  flavor?: string | null;
  dueDate?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  totalWeightKg?: number | null;
  totalPrice?: number | null;
  notes?: string | null;
};

type CustomerOrderItem = {
  title: string;
  quantity: number;
};

type CustomerOrderEmailPayload = {
  orderNumber?: string | null;
  items: CustomerOrderItem[];
  dueDate?: string | null;
  paymentMethod?: string | null;
  pickup?: boolean;
  addressLine1?: string | null;
  addressLine2?: string | null;
  suburb?: string | null;
  state?: string | null;
  postcode?: string | null;
  totalPrice?: number | null;
};

type CustomerRefundEmailPayload = {
  orderNumber?: string | null;
  amount?: number | null;
  paymentMethod?: string | null;
  reason?: string | null;
};

export type PaidOrderSaveFailureEmailPayload = {
  orderNumber: string;
  paymentProvider: string;
  paymentMethod: string;
  transactionId: string;
  paidAt: string;
  orderTotal: number;
  saveError: string | null;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  requestedDate: string | null;
  deliveryAddress: string;
  items: Array<{
    orderNumber: string;
    title: string;
    description: string | null;
    flavor: string | null;
    quantity: number;
    totalPrice: number | null;
  }>;
};

const ROC_CANDY_EMAIL = "admin@roccandy.com.au";
const ROC_CANDY_PHONE = "0411 810 538";
const ROC_CANDY_ABN = "61 076 609 035";
const ROC_CANDY_LOGO_CID = "roc-candy-logo@roccandy";

let emailLogoPromise: Promise<Buffer | null> | null = null;

function getEmailLogo() {
  emailLogoPromise ??= readFile(path.join(process.cwd(), "public/branding/logo-gold.svg"))
    .then((source) => sharp(source).resize(88, 88, { fit: "contain" }).grayscale().png().toBuffer())
    .catch((error) => {
      console.error("Email logo could not be prepared:", error);
      return null;
    });
  return emailLogoPromise;
}

async function buildTaxInvoiceBranding() {
  const logo = await getEmailLogo();
  const attachment: NonNullable<nodemailer.SendMailOptions["attachments"]>[number] | null = logo
    ? {
        filename: "roc-candy-logo.png",
        content: logo,
        contentType: "image/png",
        cid: ROC_CANDY_LOGO_CID,
        contentDisposition: "inline",
      }
    : null;
  return {
    attachment,
    html: `
      <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 12px;">
        <tr>
          ${logo ? `<td style="padding:0 14px 0 0;vertical-align:middle;"><img src="cid:${ROC_CANDY_LOGO_CID}" width="76" height="76" alt="Roc Candy" style="display:block;width:76px;height:76px;" /></td>` : ""}
          <td style="vertical-align:middle;color:#18181b;">
            <div class="rc-brand-name" style="font-size:19px;line-height:1.25;font-weight:700;">Roc Candy Pty Ltd</div>
            <div class="rc-brand-contact" style="font-size:14px;line-height:1.4;"><a href="mailto:${ROC_CANDY_EMAIL}" style="color:#18181b;text-decoration:none;">${ROC_CANDY_EMAIL}</a> | ${ROC_CANDY_PHONE}</div>
            <div class="rc-brand-contact" style="font-size:14px;line-height:1.4;">ABN ${ROC_CANDY_ABN}</div>
          </td>
        </tr>
      </table>`,
  };
}

let cachedTransporter: nodemailer.Transporter | null = null;

export function isEmailConfigured() {
  if (process.env.SMTP_ENABLED?.toLowerCase() === "false") return false;
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getSmtpTransporter() {
  if (cachedTransporter) return cachedTransporter;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;

  const secureEnv = process.env.SMTP_SECURE;
  const secure = secureEnv ? secureEnv === "true" : port === 465;
  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 10_000,
  });
  return cachedTransporter;
}

export function parseEmailList(value?: string | null) {
  if (!value) return [];
  return value
    .split(/[;,]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function sendEmail(payload: EmailPayload) {
  if (process.env.SMTP_ENABLED?.toLowerCase() === "false") {
    console.warn("Email disabled: SMTP_ENABLED is false.");
    return { skipped: true };
  }
  const transporter = getSmtpTransporter();
  const from = payload.from ?? process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "";
  if (!transporter || !from) {
    console.warn("Email disabled: missing SMTP configuration.");
    return { skipped: true };
  }

  const to = payload.to.filter(Boolean);
  const bcc = payload.bcc?.filter(Boolean);
  if (to.length === 0) {
    return { skipped: true };
  }

  await transporter.sendMail({
    from,
    to,
    bcc,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
    replyTo: payload.replyTo,
    attachments: payload.attachments,
  });

  return { success: true };
}

export async function sendOrderEmail(to: string[], order: OrderEmailPayload) {
  const orderNumber = order.orderNumber ? `#${order.orderNumber}` : "New order";
  const subject = `Order placed ${orderNumber}`;
  const totalWeight =
    Number.isFinite(order.totalWeightKg ?? NaN) && (order.totalWeightKg ?? 0) > 0
      ? `${Number(order.totalWeightKg).toFixed(2)} kg`
      : "-";
  const totalPrice =
    Number.isFinite(order.totalPrice ?? NaN) && order.totalPrice !== null
      ? `$${Number(order.totalPrice).toFixed(2)}`
      : "-";

  const lines = [
    `Order #: ${order.orderNumber ? `#${order.orderNumber}` : "-"}`,
    `Title: ${order.title ?? "-"}`,
    `Type: ${order.designType ?? "-"}`,
    `Quantity: ${order.quantity ?? "-"}`,
    `Flavour: ${order.flavor ?? "-"}`,
    `Due date: ${order.dueDate ?? "-"}`,
    `Customer: ${order.customerName ?? "-"}`,
    `Customer email: ${order.customerEmail ?? "-"}`,
    `Total weight: ${totalWeight}`,
    `Total price: ${totalPrice}`,
    order.notes ? `Notes: ${order.notes}` : null,
  ].filter(Boolean);

  return sendEmail({
    to,
    subject,
    text: lines.join("\n"),
  });
}

export async function sendCustomerOrderEmail(to: string[], order: CustomerOrderEmailPayload) {
  const orderNumber = order.orderNumber ?? null;
  const subject = orderNumber
    ? `Roc Candy Tax Invoice #${orderNumber}`
    : "Roc Candy Tax Invoice";
  const totalPrice =
    Number.isFinite(order.totalPrice ?? NaN) && order.totalPrice !== null
      ? `$${Number(order.totalPrice).toFixed(2)}`
      : "-";
  const gstIncluded =
    Number.isFinite(order.totalPrice ?? NaN) && order.totalPrice !== null
      ? `$${(Number(order.totalPrice) / 11).toFixed(2)}`
      : "-";
  const deliveryLabel = order.pickup ? "Pickup" : "Delivery";
  const deliveryNote = order.pickup
    ? "Pickup: We will contact you when your order is ready for collection."
    : "Delivery: We will contact you with delivery details once your order is ready.";
  const addressParts = [
    order.addressLine1,
    order.addressLine2,
    order.suburb,
    order.state,
    order.postcode,
  ]
    .filter(Boolean)
    .join(", ");

  const lines = [
    "Roc Candy Pty Ltd",
    `${ROC_CANDY_EMAIL} | ${ROC_CANDY_PHONE}`,
    `ABN ${ROC_CANDY_ABN}`,
    "",
    `Tax Invoice ${orderNumber ? `#${orderNumber}` : ""}`.trim(),
    "",
    `Thanks for your order!`,
    "",
    `Order number: ${orderNumber ?? "-"}`,
    `Payment method: ${order.paymentMethod ?? "-"}`,
    `Due date: ${order.dueDate ?? "-"}`,
    `${deliveryLabel}: ${addressParts || "-"}`,
    deliveryNote,
    "",
    "Items:",
    ...order.items.map((item) => `- ${item.quantity} x ${item.title}`),
    "",
    `Total: ${totalPrice}`,
    `GST included (10%): ${gstIncluded}`,
  ];

  return sendEmail({
    to,
    subject,
    text: lines.join("\n"),
  });
}

export async function sendCustomerRefundEmail(to: string[], refund: CustomerRefundEmailPayload) {
  const orderNumber = refund.orderNumber ? `#${refund.orderNumber}` : "your order";
  const subject = `Refund processed ${orderNumber}`;
  const amount =
    Number.isFinite(refund.amount ?? NaN) && refund.amount !== null
      ? `$${Number(refund.amount).toFixed(2)}`
      : "-";
  const reason = refund.reason?.trim();

  const lines = [
    `A refund has been processed.`,
    `Order #: ${refund.orderNumber ? `#${refund.orderNumber}` : "-"}`,
    `Amount: ${amount}`,
    `Payment method: ${refund.paymentMethod ?? "-"}`,
    ...(reason ? [`Refund reason: ${reason}`] : []),
    "",
    "Please allow a few business days for the refund to appear on your statement.",
  ];

  return sendEmail({
    to,
    subject,
    text: lines.join("\n"),
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderCandyPreviewImage(imageSrc: string | null, width: number, marginBottom = 12) {
  if (!imageSrc) return "";
  return `<img src="${escapeHtml(imageSrc)}" alt="Candy design" width="${width}" style="display:block;width:${width}px;max-width:100%;height:auto;border-radius:12px;margin:0 auto ${marginBottom}px;" />`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-AU", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function formatPerthDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Perth",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

export async function sendPaidOrderSaveFailureEmail(
  to: string[],
  order: PaidOrderSaveFailureEmailPayload,
) {
  const orderNumber = `#${order.orderNumber}`;
  const paymentAmount = Number.isFinite(order.orderTotal) ? `$${order.orderTotal.toFixed(2)}` : "-";
  const productsText = order.items
    .map((item) => {
      const flavor = item.flavor ? ` | Flavour: ${item.flavor}` : "";
      const description = item.description ? ` | ${item.description}` : "";
      const total = Number.isFinite(item.totalPrice ?? NaN) ? ` | $${Number(item.totalPrice).toFixed(2)}` : "";
      return `- ${item.quantity} x ${item.title}${flavor}${description}${total} (${item.orderNumber})`;
    })
    .join("\n");
  const lines = [
    "URGENT: A customer payment succeeded, but no order record was created.",
    "Do not charge the customer again. Verify the payment and recreate the order from these details.",
    "",
    `Intended order number: ${orderNumber}`,
    `Payment received: ${formatPerthDateTime(order.paidAt)}`,
    `Payment provider: ${order.paymentProvider}`,
    `Payment method: ${order.paymentMethod}`,
    `Payment transaction: ${order.transactionId}`,
    `Payment amount: ${paymentAmount}`,
    `Save error: ${order.saveError ?? "Unknown database error"}`,
    "",
    `Customer: ${order.customerName || "-"}`,
    `Email: ${order.customerEmail ?? "-"}`,
    `Phone: ${order.customerPhone ?? "-"}`,
    `Requested date: ${formatDate(order.requestedDate)}`,
    `Delivery: ${order.deliveryAddress}`,
    "",
    "Products that were not saved",
    productsText || "-",
  ];
  const productsHtml = order.items
    .map((item) => {
      const total = Number.isFinite(item.totalPrice ?? NaN) ? `$${Number(item.totalPrice).toFixed(2)}` : "-";
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #fecaca;">${escapeHtml(item.orderNumber)}</td>
        <td style="padding:8px;border-bottom:1px solid #fecaca;">${escapeHtml(item.title)}</td>
        <td style="padding:8px;border-bottom:1px solid #fecaca;">${escapeHtml(item.flavor ?? "-")}</td>
        <td style="padding:8px;border-bottom:1px solid #fecaca;text-align:center;">${item.quantity}</td>
        <td style="padding:8px;border-bottom:1px solid #fecaca;text-align:right;">${escapeHtml(total)}</td>
      </tr>`;
    })
    .join("");

  return sendEmail({
    to,
    subject: `URGENT: Paid order not saved ${orderNumber}`,
    text: lines.join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#18181b;max-width:760px;">
        <div style="padding:16px;border:2px solid #dc2626;border-radius:12px;background:#fef2f2;margin-bottom:20px;">
          <h2 style="margin:0 0 8px;color:#b91c1c;">Paid order was not saved</h2>
          <p style="margin:0 0 6px;font-weight:700;">Do not charge the customer again.</p>
          <p style="margin:0;">Verify the payment and recreate the order using the details below.</p>
        </div>
        <h3 style="margin:0 0 8px;">Payment</h3>
        <div><strong>Intended order:</strong> ${escapeHtml(orderNumber)}</div>
        <div><strong>Received:</strong> ${escapeHtml(formatPerthDateTime(order.paidAt))}</div>
        <div><strong>Provider:</strong> ${escapeHtml(order.paymentProvider)}</div>
        <div><strong>Method:</strong> ${escapeHtml(order.paymentMethod)}</div>
        <div><strong>Transaction:</strong> ${escapeHtml(order.transactionId)}</div>
        <div><strong>Amount:</strong> ${escapeHtml(paymentAmount)}</div>
        <div><strong>Save error:</strong> ${escapeHtml(order.saveError ?? "Unknown database error")}</div>
        <hr style="border:none;border-top:1px solid #fecaca;margin:20px 0;" />
        <h3 style="margin:0 0 8px;">Customer and delivery</h3>
        <div><strong>Customer:</strong> ${escapeHtml(order.customerName || "-")}</div>
        <div><strong>Email:</strong> ${escapeHtml(order.customerEmail ?? "-")}</div>
        <div><strong>Phone:</strong> ${escapeHtml(order.customerPhone ?? "-")}</div>
        <div><strong>Requested date:</strong> ${escapeHtml(formatDate(order.requestedDate))}</div>
        <div><strong>Delivery:</strong> ${escapeHtml(order.deliveryAddress)}</div>
        <hr style="border:none;border-top:1px solid #fecaca;margin:20px 0;" />
        <h3 style="margin:0 0 8px;">Products that were not saved</h3>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr>
            <th style="padding:8px;text-align:left;border-bottom:2px solid #fca5a5;">Order</th>
            <th style="padding:8px;text-align:left;border-bottom:2px solid #fca5a5;">Product</th>
            <th style="padding:8px;text-align:left;border-bottom:2px solid #fca5a5;">Flavour</th>
            <th style="padding:8px;text-align:center;border-bottom:2px solid #fca5a5;">Qty</th>
            <th style="padding:8px;text-align:right;border-bottom:2px solid #fca5a5;">Total</th>
          </tr></thead>
          <tbody>${productsHtml}</tbody>
        </table>
      </div>
    `,
  });
}

type AttachmentResult = {
  src: string | null;
  attachment: NonNullable<nodemailer.SendMailOptions["attachments"]>[number] | null;
};

function isAttachment(
  value: NonNullable<nodemailer.SendMailOptions["attachments"]>[number] | null
): value is NonNullable<nodemailer.SendMailOptions["attachments"]>[number] {
  return value !== null;
}

async function buildInlineAttachment(
  imageSources: Array<string | null | undefined>,
  cid: string,
  filenameBase: string,
  resize?: { width: number; height: number },
): Promise<AttachmentResult> {
  for (const imageUrl of imageSources) {
    if (!imageUrl) continue;

    let source: Buffer | null = null;
    const dataMatch = imageUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([a-zA-Z0-9+/=\s]+)$/);
    if (dataMatch) {
      source = Buffer.from(dataMatch[2].replace(/\s+/g, ""), "base64");
    } else if (/^https?:\/\//i.test(imageUrl)) {
      try {
        const response = await fetch(imageUrl, { cache: "no-store" });
        if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) continue;
        source = Buffer.from(await response.arrayBuffer());
      } catch {
        continue;
      }
    }

    if (!source?.length) continue;
    try {
      // SVG, WebP and other valid browser images are not reliably supported by email clients.
      // Convert every preview to a self-contained PNG before assigning the content ID.
      let image = sharp(source, { animated: false, failOn: "none" })
        .rotate()
        .flatten({ background: "#ffffff" });
      if (resize) {
        image = image.resize(resize.width, resize.height, { fit: "inside", withoutEnlargement: true });
      }
      const content = await image
        .png()
        .toBuffer();
      return {
        src: `cid:${cid}`,
        attachment: {
          filename: `${filenameBase}.png`,
          content,
          contentType: "image/png",
          cid,
          contentDisposition: "inline",
        },
      };
    } catch {
      // Try the next source (for example, the generated preview when a captured image is corrupt).
    }
  }

  // Do not leave clients with a broken-image placeholder when a source cannot be embedded.
  return { src: null, attachment: null };
}

function getCustomDetailsList(order: AdminOrderSummaryEmailPayload) {
  return order.customDetailsList?.length
    ? order.customDetailsList
    : order.customDetails
      ? [order.customDetails]
      : [];
}

function buildCustomTextLines(details: AdminCustomOrderDetails[], includeWeight: boolean) {
  return details.flatMap((detail) => [
    includeWeight ? `Weight: ${detail.weightKg ? `${detail.weightKg.toFixed(2)} kg` : "-"}` : null,
    `Outer colour / colours: ${detail.outerColours}`,
    `Pinstripe: ${detail.pinstripe}`,
    `Flavour: ${detail.flavor ?? "-"}`,
    `Text: ${detail.textColour}`,
    detail.heartColour ? `Heart: ${detail.heartColour}` : null,
    `Packaging: ${detail.packaging}`,
    `Custom label type: ${detail.labels}`,
    `Ingredient labels: ${detail.ingredientLabels}`,
    "",
  ]).filter((line) => line !== null) as string[];
}

async function buildCustomHtmlSections(
  details: AdminCustomOrderDetails[],
  options: {
    previewWidth: number;
    labelWidth: number;
    includeWeight: boolean;
    stacked?: boolean;
  }
) {
  const attachments: NonNullable<nodemailer.SendMailOptions["attachments"]> = [];
  const sections = await Promise.all(
    details.map(async (detail, index) => {
      // Embed the preview so mail clients do not need to load remote images. Prefer the exact
      // browser-captured design, then fall back to the persisted or generated preview URL.
      const customPreview = await buildInlineAttachment(
        [detail.imageDataUrl, detail.imageUrl, detail.fallbackImageUrl],
        `candy-design-${index}@roccandy`,
        `candy-design-${index + 1}`,
        { width: options.previewWidth * 2, height: options.previewWidth * 2 },
      );
      const labelPreview = await buildInlineAttachment(
        [detail.labelImageUrl],
        `label-design-${index}@roccandy`,
        `label-design-${index + 1}`,
        { width: options.labelWidth * 2, height: options.labelWidth * 2 },
      );
      if (customPreview.attachment) attachments.push(customPreview.attachment);
      if (labelPreview.attachment) attachments.push(labelPreview.attachment);

      const detailsHtml = `
        <div style="font-size:14px;font-weight:700;margin:0 0 4px;">Candy design</div>
        ${options.includeWeight ? `<div><strong>Weight:</strong> ${detail.weightKg ? `${detail.weightKg.toFixed(2)} kg` : "-"}</div>` : ""}
        <div><strong>Outer colour/colours:</strong> ${escapeHtml(detail.outerColours)}</div>
        <div><strong>Pinstripe:</strong> ${escapeHtml(detail.pinstripe)}</div>
        <div><strong>Flavour:</strong> ${escapeHtml(detail.flavor ?? "-")}</div>
        <div><strong>Text:</strong> ${escapeHtml(detail.textColour)}</div>
        ${detail.heartColour ? `<div><strong>Heart:</strong> ${escapeHtml(detail.heartColour)}</div>` : ""}
        <div><strong>Packaging:</strong> ${escapeHtml(detail.packaging)}</div>
        <div><strong>Custom label type:</strong> ${escapeHtml(detail.labels)}</div>
        <div><strong>Ingredient labels:</strong> ${escapeHtml(detail.ingredientLabels)}</div>
        ${labelPreview.src ? `<div style="margin-top:4px;"><img src="${escapeHtml(labelPreview.src)}" alt="Uploaded label" width="${options.labelWidth}" style="display:block;width:${options.labelWidth}px;max-width:${options.labelWidth}px;height:auto;max-height:${options.labelWidth}px;object-fit:contain;border-radius:5px;border:1px solid #e4e4e7;" /></div>` : ""}
      `;

      return options.stacked ? `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="rc-card" style="width:100%;border-collapse:collapse;margin:0 0 10px;background:#ffffff;">
          ${customPreview.src ? `<tr><td class="rc-design-image" style="padding:2px 0 0;text-align:center;">${renderCandyPreviewImage(customPreview.src, options.previewWidth, 2)}</td></tr>` : ""}
          <tr><td style="padding:2px 0 6px;vertical-align:top;font-size:13px;line-height:1.35;">${detailsHtml}</td></tr>
        </table>
      ` : `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;border-spacing:0;margin:0 0 20px;border:1px solid #e4e4e7;border-radius:10px;background:#fafafa;">
          <tr>
            ${customPreview.src ? `<td width="${options.previewWidth + 32}" style="padding:16px;vertical-align:top;">${renderCandyPreviewImage(customPreview.src, options.previewWidth)}</td>` : ""}
            <td style="padding:16px;vertical-align:top;">${detailsHtml}</td>
          </tr>
        </table>
      `;
    })
  );

  return {
    html: sections.join(""),
    attachments,
  };
}

export async function sendAdminOrderSummaryEmail(to: string[], order: AdminOrderSummaryEmailPayload) {
  const orderNumber = order.orderNumber ? `#${order.orderNumber}` : "New order";
  const subject = `Order placed ${orderNumber}`;
  const paymentAmount = Number.isFinite(order.paymentAmount) ? `$${order.paymentAmount.toFixed(2)}` : "-";
  const customDetailsList = getCustomDetailsList(order);

  const productsText = order.items
    .map((item) => {
      const labelsText = Number.isFinite(item.labelsCount ?? NaN) && Number(item.labelsCount) > 0
        ? ` | Custom labels to print: ${item.labelsCount}`
        : "";
      const flavorText = item.flavor ? ` | Flavour: ${item.flavor}` : "";
      const lineTotal = Number.isFinite(item.totalPrice ?? NaN) ? ` ($${Number(item.totalPrice).toFixed(2)})` : "";
      return `- ${item.quantity} x ${item.title}${flavorText}${labelsText}${lineTotal}`;
    })
    .join("\n");

  const lines = [
    `Order #: ${orderNumber}`,
    ...buildCustomTextLines(customDetailsList, true),
    "",
    "Order Information",
    `Date ordered: ${formatDate(order.dateOrderedIso)}`,
    `Order number: ${orderNumber}`,
    `Customer: ${order.customerName ?? "-"}`,
    `Email: ${order.customerEmail ?? "-"}`,
    `Phone: ${order.customerPhone ?? "-"}`,
    `Requested date: ${formatDate(order.requestedDate)}`,
    `Delivery address: ${order.deliveryAddress}`,
    "",
    "Products ordered",
    productsText || "-",
    `Payment amount: ${paymentAmount}`,
    `Payment method: ${order.paymentMethod ?? "-"}`,
  ].filter((line) => line !== null) as string[];

  const customSection = await buildCustomHtmlSections(customDetailsList, {
    previewWidth: 300,
    labelWidth: 130,
    includeWeight: true,
  });

  const productsHtml = order.items
    .map((item) => {
      const lineTotal = Number.isFinite(item.totalPrice ?? NaN) ? `$${Number(item.totalPrice).toFixed(2)}` : "-";
      const labelsCount = Number.isFinite(item.labelsCount ?? NaN) ? String(item.labelsCount) : "-";
      const flavor = item.flavor ?? "-";
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #e4e4e7;">${escapeHtml(item.title)}</td>
        <td style="padding:8px;border-bottom:1px solid #e4e4e7;text-align:center;">${item.quantity}</td>
        <td style="padding:8px;border-bottom:1px solid #e4e4e7;text-align:center;">${escapeHtml(flavor)}</td>
        <td style="padding:8px;border-bottom:1px solid #e4e4e7;text-align:center;">${escapeHtml(labelsCount)}</td>
        <td style="padding:8px;border-bottom:1px solid #e4e4e7;text-align:right;">${escapeHtml(lineTotal)}</td>
      </tr>`;
    })
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#18181b;max-width:720px;">
      ${customSection.html}
      <h3 style="margin:0 0 8px;">Order Information</h3>
      <div><strong>Date ordered:</strong> ${escapeHtml(formatDate(order.dateOrderedIso))}</div>
      <div><strong>Order number:</strong> ${escapeHtml(orderNumber)}</div>
      <div><strong>Customer:</strong> ${escapeHtml(order.customerName ?? "-")}</div>
      <div><strong>Email:</strong> ${escapeHtml(order.customerEmail ?? "-")}</div>
      <div><strong>Phone:</strong> ${escapeHtml(order.customerPhone ?? "-")}</div>
      <div style="font-size:36px;font-weight:700;margin:12px 0 6px;">Requested date: ${escapeHtml(formatDate(order.requestedDate))}</div>
      <div><strong>Delivery address:</strong> ${escapeHtml(order.deliveryAddress)}</div>
      <hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0;" />

      <h3 style="margin:0 0 8px;">Products ordered</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px;border-bottom:2px solid #d4d4d8;">Product</th>
            <th style="text-align:center;padding:8px;border-bottom:2px solid #d4d4d8;">Qty</th>
            <th style="text-align:center;padding:8px;border-bottom:2px solid #d4d4d8;">Flavour</th>
            <th style="text-align:center;padding:8px;border-bottom:2px solid #d4d4d8;">Custom Labels to print</th>
            <th style="text-align:right;padding:8px;border-bottom:2px solid #d4d4d8;">Line total</th>
          </tr>
        </thead>
        <tbody>${productsHtml}</tbody>
      </table>
      <div><strong>Payment amount:</strong> ${escapeHtml(paymentAmount)}</div>
      <div><strong>Payment method:</strong> ${escapeHtml(order.paymentMethod ?? "-")}</div>
    </div>
  `;

  const attachments = customSection.attachments.filter(isAttachment);

  return sendEmail({
    to,
    subject,
    text: lines.join("\n"),
    html,
    attachments: attachments.length > 0 ? attachments : undefined,
  });
}

export async function sendCustomerOrderSummaryEmail(to: string[], order: AdminOrderSummaryEmailPayload) {
  const orderNumber = order.orderNumber ?? null;
  const displayOrderNumber = orderNumber ?? "-";
  const subject = orderNumber
    ? `Roc Candy Tax Invoice #${orderNumber}`
    : "Roc Candy Tax Invoice";
  const paymentAmount = Number.isFinite(order.paymentAmount) ? `$${order.paymentAmount.toFixed(2)}` : "-";
  const gstIncluded = Number.isFinite(order.paymentAmount) ? `$${(order.paymentAmount / 11).toFixed(2)}` : "-";
  const subtotalExGst = Number.isFinite(order.paymentAmount) ? `$${(order.paymentAmount - order.paymentAmount / 11).toFixed(2)}` : "-";
  const customDetailsList = getCustomDetailsList(order);

  const productsText = order.items
    .map((item) => {
      const lineTotal = Number.isFinite(item.totalPrice ?? NaN) ? ` ($${Number(item.totalPrice).toFixed(2)})` : "";
      const flavorText = item.flavor ? ` | Flavour: ${item.flavor}` : "";
      return `- ${item.quantity} x ${item.title}${flavorText}${lineTotal}`;
    })
    .join("\n");

  const lines = [
    "Roc Candy Pty Ltd",
    `${ROC_CANDY_EMAIL} | ${ROC_CANDY_PHONE}`,
    `ABN ${ROC_CANDY_ABN}`,
    "",
    `Tax Invoice #${displayOrderNumber}`,
    "",
    "Thanks for your order. It has been confirmed and is now being prepared.",
    ...buildCustomTextLines(customDetailsList, false),
    "",
    `Invoice date: ${formatDate(order.dateOrderedIso)}`,
    "Status: PAID",
    "",
    "Bill to",
    `Customer: ${order.customerName ?? "-"}`,
    `Email: ${order.customerEmail ?? "-"}`,
    `Phone: ${order.customerPhone ?? "-"}`,
    "",
    "Order details",
    `Requested date: ${formatDate(order.requestedDate)}`,
    `Delivery address: ${order.deliveryAddress}`,
    `Payment method: ${order.paymentMethod ?? "-"}`,
    "",
    "Invoice items",
    productsText || "-",
    `Subtotal (ex GST): ${subtotalExGst}`,
    `GST (10%): ${gstIncluded}`,
    `Total paid: ${paymentAmount}`,
  ].filter((line) => line !== null) as string[];

  const customSection = await buildCustomHtmlSections(customDetailsList, {
    previewWidth: 160,
    labelWidth: 72,
    includeWeight: false,
    stacked: true,
  });
  const branding = await buildTaxInvoiceBranding();

  const productsHtml = order.items
    .map((item) => {
      const lineTotal = Number.isFinite(item.totalPrice ?? NaN) ? `$${Number(item.totalPrice).toFixed(2)}` : "-";
      const flavor = item.flavor ?? "-";
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #e4e4e7;">${escapeHtml(item.title)}</td>
        <td style="padding:8px;border-bottom:1px solid #e4e4e7;text-align:center;">${item.quantity}</td>
        <td style="padding:8px;border-bottom:1px solid #e4e4e7;text-align:center;">${escapeHtml(flavor)}</td>
        <td style="padding:8px;border-bottom:1px solid #e4e4e7;text-align:right;">${escapeHtml(lineTotal)}</td>
      </tr>`;
    })
    .join("");

  const html = `
    <style>
      @media only screen and (max-width:600px) {
        .rc-invoice { width:100% !important; max-width:100% !important; font-size:13px !important; }
        .rc-two-col, .rc-two-col tbody, .rc-two-col tr, .rc-two-col-cell { display:block !important; width:100% !important; box-sizing:border-box !important; }
        .rc-two-col-cell { border-right:0 !important; border-bottom:1px solid #e4e4e7 !important; }
        .rc-brand-name { font-size:17px !important; }
        .rc-brand-contact { font-size:12px !important; }
      }
      @media print {
        .rc-invoice { max-width:none !important; font-size:11px !important; line-height:1.3 !important; }
        .rc-card, .rc-two-col, .rc-items, .rc-totals { page-break-inside:avoid !important; break-inside:avoid !important; }
      }
    </style>
    <div class="rc-invoice" style="font-family:Arial,sans-serif;font-size:13px;line-height:1.4;color:#18181b;max-width:660px;">
      ${branding.html}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 10px;">
        <tr>
          <td style="vertical-align:top;padding:0 16px 0 0;">
            <h1 style="margin:0;font-size:22px;line-height:1.2;">Tax Invoice #${escapeHtml(displayOrderNumber)}</h1>
          </td>
          <td style="vertical-align:top;text-align:right;color:#52525b;font-size:12px;line-height:1.3;">
            <div><strong style="color:#18181b;">Invoice date</strong></div>
            <div>${escapeHtml(formatDate(order.dateOrderedIso))}</div>
            <div style="margin-top:3px;font-weight:700;color:#15803d;">PAID</div>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 9px;font-size:14px;">
        Thanks for your order. It has been confirmed and is now being prepared.
      </p>
      ${customSection.html}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="rc-two-col" style="width:100%;border-collapse:collapse;margin:0 0 18px;background:#fafafa;border:1px solid #e4e4e7;">
        <tr>
          <td width="50%" class="rc-two-col-cell" style="padding:12px;vertical-align:top;border-right:1px solid #e4e4e7;">
            <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#71717a;margin-bottom:6px;">Bill to</div>
            <div style="font-weight:700;">${escapeHtml(order.customerName ?? "-")}</div>
            <div>${escapeHtml(order.customerEmail ?? "-")}</div>
            <div>${escapeHtml(order.customerPhone ?? "-")}</div>
          </td>
          <td width="50%" class="rc-two-col-cell" style="padding:12px;vertical-align:top;">
            <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#71717a;margin-bottom:6px;">Order details</div>
            <div><strong>Requested date:</strong> ${escapeHtml(formatDate(order.requestedDate))}</div>
            <div><strong>Delivery:</strong> ${escapeHtml(order.deliveryAddress)}</div>
            <div><strong>Payment:</strong> ${escapeHtml(order.paymentMethod ?? "-")}</div>
          </td>
        </tr>
      </table>

      <h2 style="margin:0 0 8px;font-size:18px;">Invoice items</h2>
      <table class="rc-items" style="width:100%;border-collapse:collapse;margin-bottom:10px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px;border-bottom:2px solid #d4d4d8;">Product</th>
            <th style="text-align:center;padding:8px;border-bottom:2px solid #d4d4d8;">Qty</th>
            <th style="text-align:center;padding:8px;border-bottom:2px solid #d4d4d8;">Flavour</th>
            <th style="text-align:right;padding:8px;border-bottom:2px solid #d4d4d8;">Line total</th>
          </tr>
        </thead>
        <tbody>${productsHtml}</tbody>
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" class="rc-totals" style="margin:0 0 0 auto;border-collapse:collapse;min-width:280px;">
        <tr><td style="padding:5px 14px 5px 0;color:#52525b;">Subtotal (ex GST)</td><td style="padding:5px 0;text-align:right;">${escapeHtml(subtotalExGst)}</td></tr>
        <tr><td style="padding:5px 14px 5px 0;color:#52525b;">GST (10%)</td><td style="padding:5px 0;text-align:right;">${escapeHtml(gstIncluded)}</td></tr>
        <tr><td style="padding:10px 14px 0 0;border-top:2px solid #18181b;font-size:17px;font-weight:700;">Total paid</td><td style="padding:10px 0 0;border-top:2px solid #18181b;text-align:right;font-size:17px;font-weight:700;">${escapeHtml(paymentAmount)}</td></tr>
      </table>
    </div>
  `;

  const attachments = [branding.attachment, ...customSection.attachments].filter(isAttachment);

  return sendEmail({
    to,
    subject,
    text: lines.join("\n"),
    html,
    attachments: attachments.length > 0 ? attachments : undefined,
  });
}

export function getOrdersRecipients() {
  return parseEmailList(process.env.ORDERS_EMAIL ?? "order@roccandy.com.au");
}

export function getEnquiriesRecipients() {
  return parseEmailList(process.env.ENQUIRIES_EMAIL ?? "enquiries@roccandy.com.au");
}

type WebsiteEnquiryEmailInput = {
  reference: string;
  receivedAt: string;
  enquiry: WebsiteEnquiry;
  attachments?: {
    filename: string;
    contentType: string;
    content: Buffer;
  }[];
};

function attachmentNames(attachments: WebsiteEnquiryEmailInput["attachments"]) {
  return attachments?.map((attachment) => attachment.filename).join(", ") || "None";
}

function enquiryDetailsLines({ reference, receivedAt, enquiry, attachments }: WebsiteEnquiryEmailInput) {
  return [
    `Reference: ${reference}`,
    `Received: ${formatDate(receivedAt)}`,
    `Name: ${enquiry.name}`,
    `Email: ${enquiry.email}`,
    `Phone: ${enquiry.phone ?? "-"}`,
    `Organisation: ${enquiry.organisation ?? "-"}`,
    `Interested in: ${enquiryInterestLabel(enquiry.interest)}`,
    `Date required: ${enquiry.requiredDate ? formatDate(enquiry.requiredDate) : "-"}`,
    `Approximate quantity: ${enquiry.quantity ?? "-"}`,
    `Product or page context: ${enquiry.productContext ?? "-"}`,
    `Source page: ${enquiry.sourcePage ?? "-"}`,
    `Attachments: ${attachmentNames(attachments)}`,
    "",
    "Message",
    enquiry.message,
  ];
}

function enquiryDetailsHtml({ reference, receivedAt, enquiry, attachments }: WebsiteEnquiryEmailInput) {
  const detailRows = [
    ["Reference", reference],
    ["Received", formatDate(receivedAt)],
    ["Name", enquiry.name],
    ["Email", enquiry.email],
    ["Phone", enquiry.phone ?? "-"],
    ["Organisation", enquiry.organisation ?? "-"],
    ["Interested in", enquiryInterestLabel(enquiry.interest)],
    ["Date required", enquiry.requiredDate ? formatDate(enquiry.requiredDate) : "-"],
    ["Approximate quantity", enquiry.quantity ?? "-"],
    ["Product or page context", enquiry.productContext ?? "-"],
    ["Source page", enquiry.sourcePage ?? "-"],
    ["Attachments", attachmentNames(attachments)],
  ];

  return `
    <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.55;color:#18181b;max-width:680px;">
      <h2 style="margin:0 0 18px;color:#ff5f99;">New website enquiry</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tbody>
          ${detailRows
            .map(
              ([label, value]) => `<tr>
                <th style="width:180px;padding:7px 12px 7px 0;text-align:left;vertical-align:top;color:#52525b;">${escapeHtml(label)}</th>
                <td style="padding:7px 0;vertical-align:top;">${escapeHtml(value)}</td>
              </tr>`,
            )
            .join("")}
        </tbody>
      </table>
      <h3 style="margin:0 0 8px;">Message</h3>
      <div style="white-space:pre-wrap;padding:16px;border-radius:12px;background:#faf5f7;border:1px solid #f4dce6;">${escapeHtml(enquiry.message)}</div>
      <p style="margin:18px 0 0;color:#52525b;">Reply to this email to respond directly to ${escapeHtml(enquiry.name)}.</p>
    </div>
  `;
}

export async function sendWebsiteEnquiryEmails(input: WebsiteEnquiryEmailInput) {
  const recipients = getEnquiriesRecipients();
  if (!isEmailConfigured() || recipients.length === 0) {
    throw new Error("Website enquiry email is not configured.");
  }

  const enquiriesFrom = `Roc Candy Enquiries <${recipients[0]}>`;
  const interest = enquiryInterestLabel(input.enquiry.interest);
  const subject = `Website enquiry ${input.reference} — ${interest} — ${input.enquiry.name}`;
  const adminResult = await sendEmail({
    from: enquiriesFrom,
    to: recipients,
    subject,
    replyTo: input.enquiry.email,
    text: [
      "New website enquiry",
      "",
      ...enquiryDetailsLines(input),
      "",
      `Reply to this email to respond directly to ${input.enquiry.name}.`,
    ].join("\n"),
    html: enquiryDetailsHtml(input),
    attachments: input.attachments?.map((attachment) => ({
      filename: attachment.filename,
      contentType: attachment.contentType,
      content: attachment.content,
      contentDisposition: "attachment",
    })),
  });

  if ("skipped" in adminResult && adminResult.skipped) {
    throw new Error("Website enquiry email could not be sent.");
  }

  try {
    const customerResult = await sendEmail({
      from: enquiriesFrom,
      to: [input.enquiry.email],
      subject: `We received your Roc Candy enquiry — ${input.reference}`,
      replyTo: recipients[0],
      text: [
        `Hi ${input.enquiry.name},`,
        "",
        "Thanks for contacting Roc Candy. We have received your enquiry and will reply by email as soon as we can.",
        "",
        ...enquiryDetailsLines(input),
        "",
        "If your enquiry is urgent, call us on 0414 519 211.",
        "",
        "Roc Candy",
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.55;color:#18181b;max-width:680px;">
          <h2 style="margin:0 0 14px;color:#ff5f99;">Thanks for contacting Roc Candy</h2>
          <p>Hi ${escapeHtml(input.enquiry.name)},</p>
          <p>We have received your enquiry and will reply by email as soon as we can.</p>
          <p><strong>Reference:</strong> ${escapeHtml(input.reference)}</p>
          ${
            input.attachments?.length
              ? `<p><strong>Files included with your enquiry:</strong> ${escapeHtml(attachmentNames(input.attachments))}</p>`
              : ""
          }
          <p style="white-space:pre-wrap;padding:16px;border-radius:12px;background:#faf5f7;border:1px solid #f4dce6;">${escapeHtml(input.enquiry.message)}</p>
          <p>If your enquiry is urgent, call us on <a href="tel:0414519211" style="color:#ff5f99;">0414 519 211</a>.</p>
          <p>Roc Candy</p>
        </div>
      `,
    });
    if ("skipped" in customerResult && customerResult.skipped) {
      console.error("Customer enquiry acknowledgement was skipped because email is not configured.");
    }
  } catch (error) {
    console.error("Customer enquiry acknowledgement failed:", error);
  }

  return { reference: input.reference };
}
