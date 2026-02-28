import nodemailer from "nodemailer";
import type { AdminOrderSummaryEmailPayload } from "@/lib/orderEmailSummary";

type EmailPayload = {
  to: string[];
  subject: string;
  text: string;
  html?: string;
  attachments?: nodemailer.SendMailOptions["attachments"];
};

type OrderEmailPayload = {
  orderNumber?: string | null;
  title?: string | null;
  designType?: string | null;
  quantity?: number | null;
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
};

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

  const lines = [
    `A refund has been processed.`,
    `Order #: ${refund.orderNumber ? `#${refund.orderNumber}` : "-"}`,
    `Amount: ${amount}`,
    `Payment method: ${refund.paymentMethod ?? "-"}`,
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

export async function sendAdminOrderSummaryEmail(to: string[], order: AdminOrderSummaryEmailPayload) {
  const orderNumber = order.orderNumber ? `#${order.orderNumber}` : "New order";
  const subject = `Order placed ${orderNumber}`;
  const paymentAmount = Number.isFinite(order.paymentAmount) ? `$${order.paymentAmount.toFixed(2)}` : "-";

  const productsText = order.items
    .map((item) => {
      const lineTotal = Number.isFinite(item.totalPrice ?? NaN) ? ` ($${Number(item.totalPrice).toFixed(2)})` : "";
      return `- ${item.quantity} x ${item.title}${lineTotal}`;
    })
    .join("\n");

  const lines = [
    `Order #: ${orderNumber}`,
    order.customDetails ? `Weight: ${order.customDetails.weightKg ? `${order.customDetails.weightKg.toFixed(2)} kg` : "-"}` : null,
    order.customDetails ? `Outer colour / colours: ${order.customDetails.outerColours}` : null,
    order.customDetails ? `Pinstripe: ${order.customDetails.pinstripe}` : null,
    order.customDetails ? `Text: ${order.customDetails.textColour}` : null,
    order.customDetails?.heartColour ? `Heart: ${order.customDetails.heartColour}` : null,
    order.customDetails ? `Packaging: ${order.customDetails.packaging}` : null,
    order.customDetails ? `Labels: ${order.customDetails.labels}` : null,
    order.customDetails ? `Ingredient labels: ${order.customDetails.ingredientLabels}` : null,
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

  const customPreview = await buildInlineAttachment(
    order.customDetails?.imageDataUrl ?? order.customDetails?.imageUrl ?? null,
    "candy-design@roccandy",
    "candy-design"
  );
  const labelPreview = await buildInlineAttachment(
    order.customDetails?.labelImageUrl ?? null,
    "label-design@roccandy",
    "label-design"
  );
  const customImageSrc = customPreview.src;
  const labelImageSrc = labelPreview.src;
  const customSection = order.customDetails
    ? `
      ${customImageSrc ? `<img src="${escapeHtml(customImageSrc)}" alt="Candy design" width="420" style="display:block;max-width:100%;width:420px;border-radius:12px;margin-bottom:12px;" />` : ""}
      <div style="font-size:16px;font-weight:700;margin-bottom:8px;">${escapeHtml(orderNumber)}</div>
      <div style="font-size:24px;font-weight:700;margin-bottom:4px;">Weight: ${order.customDetails.weightKg ? `${order.customDetails.weightKg.toFixed(2)} kg` : "-"}</div>
      <div><strong>Outer Colour/Colours:</strong> ${escapeHtml(order.customDetails.outerColours)}</div>
      <div><strong>Pinstripe:</strong> ${escapeHtml(order.customDetails.pinstripe)}</div>
      <div><strong>Text:</strong> ${escapeHtml(order.customDetails.textColour)}</div>
      ${order.customDetails.heartColour ? `<div><strong>Heart:</strong> ${escapeHtml(order.customDetails.heartColour)}</div>` : ""}
      <div><strong>Packaging:</strong> ${escapeHtml(order.customDetails.packaging)}</div>
      <div><strong>Labels:</strong> ${escapeHtml(order.customDetails.labels)}</div>
      ${labelImageSrc ? `<div style="margin-top:10px;"><img src="${escapeHtml(labelImageSrc)}" alt="Uploaded label" width="260" style="display:block;max-width:100%;width:260px;border-radius:10px;border:1px solid #e4e4e7;" /></div>` : ""}
      ${labelPreview.externalUrl ? `<div style="margin-top:6px;"><a href="${escapeHtml(labelPreview.externalUrl)}" target="_blank" rel="noopener noreferrer" style="font-size:12px;color:#2563eb;text-decoration:underline;">Open label image</a></div>` : ""}
      <div style="margin-top:8px;"><strong>Ingredient labels:</strong> ${escapeHtml(order.customDetails.ingredientLabels)}</div>
      <hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0;" />
    `
    : "";

  const productsHtml = order.items
    .map((item) => {
      const lineTotal = Number.isFinite(item.totalPrice ?? NaN) ? `$${Number(item.totalPrice).toFixed(2)}` : "-";
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #e4e4e7;">${escapeHtml(item.title)}</td>
        <td style="padding:8px;border-bottom:1px solid #e4e4e7;text-align:center;">${item.quantity}</td>
        <td style="padding:8px;border-bottom:1px solid #e4e4e7;text-align:right;">${escapeHtml(lineTotal)}</td>
      </tr>`;
    })
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#18181b;max-width:720px;">
      ${customSection}
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
            <th style="text-align:right;padding:8px;border-bottom:2px solid #d4d4d8;">Line total</th>
          </tr>
        </thead>
        <tbody>${productsHtml}</tbody>
      </table>
      <div><strong>Payment amount:</strong> ${escapeHtml(paymentAmount)}</div>
      <div><strong>Payment method:</strong> ${escapeHtml(order.paymentMethod ?? "-")}</div>
    </div>
  `;

  const attachments = [customPreview.attachment, labelPreview.attachment].filter(isAttachment);

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

  const productsText = order.items
    .map((item) => {
      const lineTotal = Number.isFinite(item.totalPrice ?? NaN) ? ` ($${Number(item.totalPrice).toFixed(2)})` : "";
      return `- ${item.quantity} x ${item.title}${lineTotal}`;
    })
    .join("\n");

  const lines = [
    "Tax invoice",
    "",
    "Thanks for your order. It has been confirmed and is now being prepared.",
    "",
    `Order #: ${displayOrderNumber}`,
    order.customDetails ? `Outer colour / colours: ${order.customDetails.outerColours}` : null,
    order.customDetails ? `Pinstripe: ${order.customDetails.pinstripe}` : null,
    order.customDetails ? `Text: ${order.customDetails.textColour}` : null,
    order.customDetails?.heartColour ? `Heart: ${order.customDetails.heartColour}` : null,
    order.customDetails ? `Packaging: ${order.customDetails.packaging}` : null,
    order.customDetails ? `Labels: ${order.customDetails.labels}` : null,
    order.customDetails ? `Ingredient labels: ${order.customDetails.ingredientLabels}` : null,
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

  const customPreview = await buildInlineAttachment(
    order.customDetails?.imageDataUrl ?? order.customDetails?.imageUrl ?? null,
    "candy-design@roccandy",
    "candy-design"
  );
  const labelPreview = await buildInlineAttachment(
    order.customDetails?.labelImageUrl ?? null,
    "label-design@roccandy",
    "label-design"
  );
  const customImageSrc = customPreview.src;
  const labelImageSrc = labelPreview.src;
  const customSection = order.customDetails
    ? `
      ${customImageSrc ? `<img src="${escapeHtml(customImageSrc)}" alt="Candy design" width="210" style="display:block;max-width:100%;width:210px;border-radius:12px;margin-bottom:12px;" />` : ""}
      <div style="font-size:16px;font-weight:700;margin-bottom:8px;">${escapeHtml(displayOrderNumber)}</div>
      <div><strong>Outer Colour/Colours:</strong> ${escapeHtml(order.customDetails.outerColours)}</div>
      <div><strong>Pinstripe:</strong> ${escapeHtml(order.customDetails.pinstripe)}</div>
      <div><strong>Text:</strong> ${escapeHtml(order.customDetails.textColour)}</div>
      ${order.customDetails.heartColour ? `<div><strong>Heart:</strong> ${escapeHtml(order.customDetails.heartColour)}</div>` : ""}
      <div><strong>Packaging:</strong> ${escapeHtml(order.customDetails.packaging)}</div>
      <div><strong>Labels:</strong> ${escapeHtml(order.customDetails.labels)}</div>
      ${labelImageSrc ? `<div style="margin-top:10px;"><img src="${escapeHtml(labelImageSrc)}" alt="Uploaded label" width="260" style="display:block;max-width:100%;width:260px;border-radius:10px;border:1px solid #e4e4e7;" /></div>` : ""}
      ${labelPreview.externalUrl ? `<div style="margin-top:6px;"><a href="${escapeHtml(labelPreview.externalUrl)}" target="_blank" rel="noopener noreferrer" style="font-size:12px;color:#2563eb;text-decoration:underline;">Open label image</a></div>` : ""}
      <div style="margin-top:8px;"><strong>Ingredient labels:</strong> ${escapeHtml(order.customDetails.ingredientLabels)}</div>
      <hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0;" />
    `
    : "";

  const productsHtml = order.items
    .map((item) => {
      const lineTotal = Number.isFinite(item.totalPrice ?? NaN) ? `$${Number(item.totalPrice).toFixed(2)}` : "-";
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #e4e4e7;">${escapeHtml(item.title)}</td>
        <td style="padding:8px;border-bottom:1px solid #e4e4e7;text-align:center;">${item.quantity}</td>
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
      ${customSection}
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

  const attachments = [customPreview.attachment, labelPreview.attachment].filter(isAttachment);

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
