import { supabaseAdminClient } from "@/lib/supabase/admin";

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
