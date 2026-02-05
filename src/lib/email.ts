import nodemailer from "nodemailer";

type EmailPayload = {
  to: string[];
  subject: string;
  text: string;
  html?: string;
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
  const orderNumber = order.orderNumber ? `#${order.orderNumber}` : "your order";
  const subject = `Order confirmation ${orderNumber}`;
  const totalPrice =
    Number.isFinite(order.totalPrice ?? NaN) && order.totalPrice !== null
      ? `$${Number(order.totalPrice).toFixed(2)}`
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
    `Thanks for your order!`,
    `Order #: ${order.orderNumber ? `#${order.orderNumber}` : "-"}`,
    `Payment method: ${order.paymentMethod ?? "-"}`,
    `Due date: ${order.dueDate ?? "-"}`,
    `${deliveryLabel}: ${addressParts || "-"}`,
    deliveryNote,
    "",
    "Items:",
    ...order.items.map((item) => `- ${item.quantity} x ${item.title}`),
    "",
    `Total: ${totalPrice}`,
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

export function getOrdersRecipients() {
  return parseEmailList(process.env.ORDERS_EMAIL ?? "order@roccandy.com.au");
}
