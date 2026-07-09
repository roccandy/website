import { randomUUID } from "crypto";
import { getPayPalAccessToken } from "@/lib/paypal";

type SquareRefundResult = {
  id: string;
  status: string;
};

type SquareRequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
};

type SquareInvoice = {
  id?: string;
  order_id?: string;
};

type SquareTender = {
  id?: string;
  payment_id?: string;
  amount_money?: {
    amount?: number;
  };
};

type SquareOrder = {
  id?: string;
  tenders?: SquareTender[];
};

function getSquareConfig() {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN?.trim();
  const locationId = process.env.SQUARE_LOCATION_ID?.trim();
  if (!accessToken || !locationId) {
    throw new Error("Square is not configured.");
  }
  return {
    accessToken,
    apiBase: process.env.SQUARE_API_BASE?.trim() || "https://connect.squareup.com",
    version: process.env.SQUARE_API_VERSION?.trim() || "2026-05-20",
  };
}

async function squareRequest<T>(path: string, options: SquareRequestOptions = {}) {
  const config = getSquareConfig();
  const response = await fetch(`${config.apiBase}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.accessToken}`,
      "Square-Version": config.version,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as {
    errors?: Array<{ detail?: string; code?: string }>;
  };
  if (!response.ok) {
    throw new Error(data.errors?.[0]?.detail || data.errors?.[0]?.code || `Square request failed (${response.status}).`);
  }
  return data as T;
}

function paymentIdForTender(tender: SquareTender) {
  return tender.payment_id?.trim() || tender.id?.trim() || null;
}

async function getSquareInvoicePaymentTender(invoiceId: string, amountCents: number) {
  const invoiceData = await squareRequest<{ invoice?: SquareInvoice }>(`/v2/invoices/${encodeURIComponent(invoiceId)}`);
  const orderId = invoiceData.invoice?.order_id?.trim();
  if (!orderId) {
    throw new Error("Square invoice payment could not be found.");
  }

  const orderData = await squareRequest<{ order?: SquareOrder }>(`/v2/orders/${encodeURIComponent(orderId)}`);
  const tenders = (orderData.order?.tenders ?? []).filter((tender) => paymentIdForTender(tender));
  if (tenders.length === 0) {
    throw new Error("Square invoice has no refundable payment yet.");
  }

  const matchingTender = tenders.find((tender) => {
    const tenderAmount = Number(tender.amount_money?.amount);
    return Number.isFinite(tenderAmount) && tenderAmount >= amountCents;
  });
  if (matchingTender) {
    return {
      paymentId: paymentIdForTender(matchingTender)!,
      orderId,
    };
  }

  if (tenders.length === 1) {
    return {
      paymentId: paymentIdForTender(tenders[0]!)!,
      orderId,
    };
  }

  throw new Error(
    "Square invoice has multiple payments. Refund this invoice in Square Dashboard, or refund one payment at a time.",
  );
}

export async function resolveSquareInvoicePaymentId(invoiceId: string, amountCents: number) {
  return getSquareInvoicePaymentTender(invoiceId, amountCents);
}

export async function refundSquarePayment(paymentId: string, amountCents: number, reason?: string | null) {
  const data = await squareRequest<{ refund?: SquareRefundResult }>("/v2/refunds", {
    method: "POST",
    body: {
      idempotency_key: randomUUID(),
      payment_id: paymentId,
      amount_money: { amount: amountCents, currency: "AUD" },
      reason: reason?.trim() || "Customer refund",
    },
  });
  if (!data.refund?.id) {
    throw new Error("Square refund failed.");
  }
  return data.refund;
}

export async function refundSquareInvoicePayment(invoiceId: string, amountCents: number, reason?: string | null) {
  const { paymentId } = await getSquareInvoicePaymentTender(invoiceId, amountCents);
  return refundSquarePayment(paymentId, amountCents, reason);
}

export async function refundPayPalCapture(captureId: string, amount: string, reason?: string | null) {
  const token = await getPayPalAccessToken();
  const apiBase = process.env.PAYPAL_API_BASE?.trim() || "https://api-m.paypal.com";
  const response = await fetch(`${apiBase}/v2/payments/captures/${captureId}/refund`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: {
        value: amount,
        currency_code: "AUD",
      },
      note_to_payer: reason?.trim() || undefined,
    }),
  });
  const data = (await response.json().catch(() => ({}))) as { id?: string; status?: string; message?: string };
  if (!response.ok || !data.id) {
    throw new Error(data.message || "PayPal refund failed.");
  }
  return data;
}
