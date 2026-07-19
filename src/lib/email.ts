import nodemailer from "nodemailer";
import type { AdminCustomOrderDetails, AdminOrderSummaryEmailPayload } from "@/lib/orderEmailSummary";
import { enquiryInterestLabel, type WebsiteEnquiry } from "@/lib/enquiry";

type EmailPayload = {
  to: string[];
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

const CUSTOMER_WEBSITE_FEEDBACK_NOTE =
  "Our website is new. If you notice any issues or have feedback, please contact enquiries@roccandy.com.au.";

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
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "";
  if (!transporter || !from) {
    console.warn("Email disabled: missing SMTP configuration.");
    return { skipped: true };
  }

  const to = payload.to.filter(Boolean);
  if (to.length === 0) {
    return { skipped: true };
  }

  await transporter.sendMail({
    from,
    to,
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
  const orderNumber = order.orderNumber ? `#${order.orderNumber}` : null;
  const subject = orderNumber
    ? `RocCandy Order confirmation ${orderNumber}`
    : "RocCandy Order confirmation";
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
    "Tax invoice",
    "",
    `Thanks for your order!`,
    CUSTOMER_WEBSITE_FEEDBACK_NOTE,
    "",
    `Order #: ${orderNumber ?? "-"}`,
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

function renderCandyPreviewImage(imageSrc: string | null, width: number) {
  if (!imageSrc) return "";
  return `<img src="${escapeHtml(imageSrc)}" alt="Candy design" width="${width}" style="display:block;width:${width}px;max-width:100%;height:auto;border-radius:12px;margin:0 auto 12px;" />`;
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

type AttachmentResult = {
  src: string | null;
  attachment: NonNullable<nodemailer.SendMailOptions["attachments"]>[number] | null;
  externalUrl: string | null;
};

function isAttachment(
  value: NonNullable<nodemailer.SendMailOptions["attachments"]>[number] | null
): value is NonNullable<nodemailer.SendMailOptions["attachments"]>[number] {
  return value !== null;
}

async function buildInlineAttachment(
  imageUrl: string | null | undefined,
  cid: string,
  filenameBase: string
): Promise<AttachmentResult> {
  if (!imageUrl) {
    return { src: null, attachment: null, externalUrl: null };
  }

  const dataMatch = imageUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([a-zA-Z0-9+/=\s]+)$/);
  if (dataMatch) {
    const contentType = dataMatch[1] || "image/png";
    const ext = contentType.includes("jpeg")
      ? "jpg"
      : contentType.includes("webp")
        ? "webp"
        : contentType.includes("gif")
          ? "gif"
          : contentType.includes("svg")
            ? "svg"
            : "png";
    const content = Buffer.from(dataMatch[2].replace(/\s+/g, ""), "base64");
    return {
      src: `cid:${cid}`,
      externalUrl: null,
      attachment: {
        filename: `${filenameBase}.${ext}`,
        content,
        contentType,
        cid,
        contentDisposition: "inline",
      },
    };
  }

  if (!/^https?:\/\//i.test(imageUrl)) {
    return { src: imageUrl, attachment: null, externalUrl: imageUrl };
  }
  try {
    const response = await fetch(imageUrl, { cache: "no-store" });
    if (!response.ok) {
      return { src: imageUrl, attachment: null, externalUrl: imageUrl };
    }
    const contentType = response.headers.get("content-type") || "image/png";
    if (!contentType.startsWith("image/")) {
      return { src: imageUrl, attachment: null, externalUrl: imageUrl };
    }
    const ext = contentType.includes("jpeg")
      ? "jpg"
      : contentType.includes("webp")
        ? "webp"
        : contentType.includes("gif")
          ? "gif"
          : contentType.includes("svg")
            ? "svg"
            : "png";
    const content = Buffer.from(await response.arrayBuffer());
    return {
      src: `cid:${cid}`,
      externalUrl: imageUrl,
      attachment: {
        filename: `${filenameBase}.${ext}`,
        content,
        contentType,
        cid,
        contentDisposition: "inline",
      },
    };
  } catch {
    return { src: imageUrl, attachment: null, externalUrl: imageUrl };
  }
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
    `Custom order: ${detail.orderNumber ? `#${detail.orderNumber}` : "-"}`,
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
  }
) {
  const attachments: NonNullable<nodemailer.SendMailOptions["attachments"]> = [];
  const sections = await Promise.all(
    details.map(async (detail, index) => {
      const customPreview = await buildInlineAttachment(
        detail.imageDataUrl ?? detail.imageUrl ?? null,
        `candy-design-${index}@roccandy`,
        `candy-design-${index + 1}`
      );
      const labelPreview = await buildInlineAttachment(
        detail.labelImageUrl ?? null,
        `label-design-${index}@roccandy`,
        `label-design-${index + 1}`
      );
      if (customPreview.attachment) attachments.push(customPreview.attachment);
      if (labelPreview.attachment) attachments.push(labelPreview.attachment);

      const orderNumber = detail.orderNumber ? `#${detail.orderNumber}` : "-";
      return `
        ${renderCandyPreviewImage(customPreview.src, options.previewWidth)}
        <div style="font-size:16px;font-weight:700;margin-bottom:8px;">${escapeHtml(orderNumber)}</div>
        ${
          options.includeWeight
            ? `<div style="font-size:24px;font-weight:700;margin-bottom:4px;">Weight: ${detail.weightKg ? `${detail.weightKg.toFixed(2)} kg` : "-"}</div>`
            : ""
        }
        <div><strong>Outer Colour/Colours:</strong> ${escapeHtml(detail.outerColours)}</div>
        <div><strong>Pinstripe:</strong> ${escapeHtml(detail.pinstripe)}</div>
        <div><strong>Flavour:</strong> ${escapeHtml(detail.flavor ?? "-")}</div>
        <div><strong>Text:</strong> ${escapeHtml(detail.textColour)}</div>
        ${detail.heartColour ? `<div><strong>Heart:</strong> ${escapeHtml(detail.heartColour)}</div>` : ""}
        <div><strong>Packaging:</strong> ${escapeHtml(detail.packaging)}</div>
        <div><strong>Custom Label type:</strong> ${escapeHtml(detail.labels)}</div>
        ${
          labelPreview.src
            ? `<div style="margin-top:10px;"><img src="${escapeHtml(labelPreview.src)}" alt="Uploaded label" width="${options.labelWidth}" style="display:block;max-width:100%;width:${options.labelWidth}px;border-radius:10px;border:1px solid #e4e4e7;" /></div>`
            : ""
        }
        ${
          labelPreview.externalUrl
            ? `<div style="margin-top:6px;"><a href="${escapeHtml(labelPreview.externalUrl)}" target="_blank" rel="noopener noreferrer" style="font-size:12px;color:#2563eb;text-decoration:underline;">Open label image</a></div>`
            : ""
        }
        <div style="margin-top:8px;"><strong>Ingredient labels:</strong> ${escapeHtml(detail.ingredientLabels)}</div>
        <hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0;" />
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
      const labelsText = Number.isFinite(item.labelsCount ?? NaN) ? ` | Custom labels to print: ${item.labelsCount}` : "";
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
  const orderNumber = order.orderNumber ? `#${order.orderNumber}` : null;
  const displayOrderNumber = orderNumber ?? "-";
  const subject = orderNumber
    ? `RocCandy Order confirmation ${orderNumber}`
    : "RocCandy Order confirmation";
  const paymentAmount = Number.isFinite(order.paymentAmount) ? `$${order.paymentAmount.toFixed(2)}` : "-";
  const gstIncluded = Number.isFinite(order.paymentAmount) ? `$${(order.paymentAmount / 11).toFixed(2)}` : "-";
  const customDetailsList = getCustomDetailsList(order);

  const productsText = order.items
    .map((item) => {
      const lineTotal = Number.isFinite(item.totalPrice ?? NaN) ? ` ($${Number(item.totalPrice).toFixed(2)})` : "";
      const flavorText = item.flavor ? ` | Flavour: ${item.flavor}` : "";
      return `- ${item.quantity} x ${item.title}${flavorText}${lineTotal}`;
    })
    .join("\n");

  const lines = [
    "Tax invoice",
    "",
    "Thanks for your order. It has been confirmed and is now being prepared.",
    CUSTOMER_WEBSITE_FEEDBACK_NOTE,
    "",
    `Order #: ${displayOrderNumber}`,
    ...buildCustomTextLines(customDetailsList, false),
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
    `GST included (10%): ${gstIncluded}`,
    `Payment method: ${order.paymentMethod ?? "-"}`,
  ].filter((line) => line !== null) as string[];

  const customSection = await buildCustomHtmlSections(customDetailsList, {
    previewWidth: 180,
    labelWidth: 260,
    includeWeight: false,
  });

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
    <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#18181b;max-width:720px;">
      <div style="display:inline-block;margin:0 0 10px;padding:5px 10px;border:1px solid #d4d4d8;border-radius:6px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#52525b;">Tax invoice</div>
      <p style="margin:0 0 14px;font-size:15px;">
        Thanks for your order. It has been confirmed and is now being prepared.
      </p>
      <p style="margin:0 0 14px;font-size:14px;color:#52525b;">
        Our website is new. If you notice any issues or have feedback, please contact
        <a href="mailto:enquiries@roccandy.com.au" style="color:#2563eb;text-decoration:underline;">enquiries@roccandy.com.au</a>.
      </p>
      ${customSection.html}
      <h3 style="margin:0 0 8px;">Order Information</h3>
      <div><strong>Date ordered:</strong> ${escapeHtml(formatDate(order.dateOrderedIso))}</div>
      <div><strong>Order number:</strong> ${escapeHtml(displayOrderNumber)}</div>
      <div><strong>Customer:</strong> ${escapeHtml(order.customerName ?? "-")}</div>
      <div><strong>Email:</strong> ${escapeHtml(order.customerEmail ?? "-")}</div>
      <div><strong>Phone:</strong> ${escapeHtml(order.customerPhone ?? "-")}</div>
      <div><strong>Requested date:</strong> ${escapeHtml(formatDate(order.requestedDate))}</div>
      <div><strong>Delivery address:</strong> ${escapeHtml(order.deliveryAddress)}</div>
      <hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0;" />

      <h3 style="margin:0 0 8px;">Products ordered</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
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
      <div><strong>Payment amount:</strong> ${escapeHtml(paymentAmount)}</div>
      <div><strong>GST included (10%):</strong> ${escapeHtml(gstIncluded)}</div>
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
};

function enquiryDetailsLines({ reference, receivedAt, enquiry }: WebsiteEnquiryEmailInput) {
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
    "",
    "Message",
    enquiry.message,
  ];
}

function enquiryDetailsHtml({ reference, receivedAt, enquiry }: WebsiteEnquiryEmailInput) {
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

  const interest = enquiryInterestLabel(input.enquiry.interest);
  const subject = `Website enquiry ${input.reference} — ${interest} — ${input.enquiry.name}`;
  const adminResult = await sendEmail({
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
  });

  if ("skipped" in adminResult && adminResult.skipped) {
    throw new Error("Website enquiry email could not be sent.");
  }

  try {
    const customerResult = await sendEmail({
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
