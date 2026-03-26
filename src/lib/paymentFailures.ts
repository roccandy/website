import { supabaseAdminClient } from "@/lib/supabase/admin";

type PaymentFailurePayload = {
  provider: "square" | "paypal";
  stage: string;
  message: string;
  customerEmail?: string | null;
  orderTotal?: number | null;
};

export async function logPaymentFailure(payload: PaymentFailurePayload) {
  try {
    await supabaseAdminClient.from("payment_failures").insert({
      provider: payload.provider,
      stage: payload.stage,
      message: payload.message,
      customer_email: payload.customerEmail ?? null,
      order_total: payload.orderTotal ?? null,
    });
  } catch (error) {
    console.error("Failed to log payment failure:", error);
  }
}
