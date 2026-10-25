import type { OrderRow } from "./data";

export function verifiedSquarePaymentPatch(invoice: { status?: string; version?: number; updated_at?: string; payment_requests?: Array<{ total_completed_amount_money?: { amount?: number; currency?: string } }> }, expectedCents: number) {
  if (invoice.status !== "PAID") throw new Error("Square has not confirmed full payment. Record the bank transfer against this invoice in Square first, then check again. No payment has been recorded here.");
  const completed = invoice.payment_requests?.reduce((sum, request) => sum + Number(request.total_completed_amount_money?.amount || 0), 0);
  if (expectedCents <= 0 || completed !== expectedCents || invoice.payment_requests?.some(request => request.total_completed_amount_money?.currency !== "AUD")) throw new Error("The paid Square amount does not match this invoice. Review it before recording payment.");
  return { square_invoice_status: "PAID", square_invoice_version: invoice.version, square_invoice_error: null };
}

export function manualPaymentDetails(orders: Pick<OrderRow, "total_price">[], input: { amount: unknown; date: unknown; reference: unknown }, now = new Date()) {
  if (input.amount != null && input.amount !== "" && !/^\d+(?:\.\d{1,2})?$/.test(String(input.amount).trim())) throw new Error("Enter the full invoice amount received using at most two decimal places.");
  const total = orders.reduce((sum, order) => sum + Math.round(Number(order.total_price || 0) * 100), 0);
  const amount = input.amount == null || input.amount === "" ? total : Math.round(Number(input.amount) * 100);
  if (!Number.isFinite(amount) || total <= 0 || amount !== total) throw new Error("Enter the full invoice amount received. Partial payments must be recorded in Square.");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Perth" }).format(now);
  const date = typeof input.date === "string" && input.date ? input.date : today;
  const parsed = new Date(`${date}T00:00:00+08:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Perth" }).format(parsed) !== date || date > today) throw new Error("Choose a valid payment date, no later than today.");
  const reference = typeof input.reference === "string" ? input.reference.trim() : "";
  if (reference.length > 200) throw new Error("Payment reference must be 200 characters or fewer.");
  return { amountCents: amount, paidAt: date === today ? now.toISOString() : parsed.toISOString(), reference };
}
