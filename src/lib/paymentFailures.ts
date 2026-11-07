import { supabaseAdminClient } from "@/lib/supabase/admin";

export type PaymentFailureRecord = {
  id: string;
  provider: "square" | "paypal";
  stage: string;
  message: string;
  customer_email: string | null;
  order_total: number | null;
  payment_transaction_id: string | null;
  order_number: string | null;
  created_at: string;
};

type PaymentFailurePayload = {
  provider: "square" | "paypal";
  stage: string;
  message: string;
  customerEmail?: string | null;
  orderTotal?: number | null;
  transactionId?: string | null;
  orderNumber?: string | null;
  checkoutSnapshot?: unknown;
};

export async function logPaymentFailure(payload: PaymentFailurePayload) {
  try {
    await supabaseAdminClient.from("payment_failures").insert({
      provider: payload.provider,
      stage: payload.stage,
      message: payload.message,
      customer_email: payload.customerEmail ?? null,
      order_total: payload.orderTotal ?? null,
      payment_transaction_id: payload.transactionId ?? null,
      order_number: payload.orderNumber ?? null,
      checkout_snapshot: payload.checkoutSnapshot ?? null,
    });
  } catch (error) {
    console.error("Failed to log payment failure:", error);
  }
}

export async function listOpenPaymentFailures() {
  const { data, error } = await supabaseAdminClient
    .from("payment_failures")
    .select("id,provider,stage,message,customer_email,order_total,payment_transaction_id,order_number,created_at")
    // Browser-side setup, validation, and declined-payment telemetry is useful
    // for engineering but is not an order-recovery task. This queue is only
    // for a payment which succeeded before order finalisation failed.
    .eq("stage", "order_finalization")
    .is("resolved_at", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("Unable to load payment recovery items. Apply the payment-recovery SQL migration, then try again.");
  return (data ?? []) as PaymentFailureRecord[];
}

export async function resolvePaymentFailure(input: {
  id: string;
  resolvedByEmail: string | null;
  note: string | null;
}) {
  const { error } = await supabaseAdminClient
    .from("payment_failures")
    .update({
      resolved_at: new Date().toISOString(),
      resolved_by_email: input.resolvedByEmail,
      resolution_note: input.note,
    })
    .eq("id", input.id)
    .is("resolved_at", null);
  if (error) throw new Error("Unable to close this payment recovery item.");
}
