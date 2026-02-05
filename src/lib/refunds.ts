import { randomUUID } from "crypto";
import { getPayPalAccessToken } from "@/lib/paypal";

type SquareRefundResult = {
  id: string;
  status: string;
};

export async function refundSquarePayment(paymentId: string, amountCents: number, reason?: string | null) {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN?.trim();
  const locationId = process.env.SQUARE_LOCATION_ID?.trim();
  const apiBase = process.env.SQUARE_API_BASE?.trim() || "https://connect.squareup.com";
  if (!accessToken || !locationId) {
    throw new Error("Square is not configured.");
  }
  const response = await fetch(`${apiBase}/v2/refunds`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      idempotency_key: randomUUID(),
      payment_id: paymentId,
      amount_money: { amount: amountCents, currency: "AUD" },
      reason: reason?.trim() || "Customer refund",
    }),
  });
  const data = (await response.json().catch(() => ({}))) as { refund?: SquareRefundResult; errors?: Array<{ detail?: string }> };
  if (!response.ok || !data.refund?.id) {
    throw new Error(data.errors?.[0]?.detail || "Square refund failed.");
  }
  return data.refund;
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
