import type { OrderRow } from "@/lib/data";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { updateWooOrder } from "@/lib/woo";

type ServerClient = typeof supabaseAdminClient;

type RefundPersistenceInput = {
  client: ServerClient;
  order: OrderRow;
  refundReason: string | null;
  refundedAt?: string;
};

type RefundPersistenceResult = {
  sharedPayment: boolean;
  fullyRefundedPayment: boolean;
};

async function updateRefundRecord(
  client: ServerClient,
  orderId: string,
  refundedAt: string,
  refundReason: string | null,
  wooOrderStatus: string
) {
  const refundUpdateWithReason = await client
    .from("orders")
    .update({
      status: "refunded",
      refunded_at: refundedAt,
      refund_reason: refundReason,
      woo_order_status: wooOrderStatus,
    })
    .eq("id", orderId);

  if (!refundUpdateWithReason.error) return;

  const missingColumn = /refund_reason/i.test(refundUpdateWithReason.error.message ?? "");
  if (!missingColumn) {
    throw new Error(refundUpdateWithReason.error.message);
  }

  const refundUpdateFallback = await client
    .from("orders")
    .update({
      status: "refunded",
      refunded_at: refundedAt,
      woo_order_status: wooOrderStatus,
    })
    .eq("id", orderId);

  if (refundUpdateFallback.error) {
    throw new Error(refundUpdateFallback.error.message);
  }
}

export async function persistOrderRefund({
  client,
  order,
  refundReason,
  refundedAt = new Date().toISOString(),
}: RefundPersistenceInput): Promise<RefundPersistenceResult> {
  const provider = order.payment_provider;
  const transactionId = order.payment_transaction_id;
  if (!provider || !transactionId) {
    throw new Error("Payment details missing.");
  }

  const { data: relatedOrders, error: relatedOrdersError } = await client
    .from("orders")
    .select("id,woo_order_id,refunded_at")
    .eq("payment_provider", provider)
    .eq("payment_transaction_id", transactionId);

  if (relatedOrdersError) {
    throw new Error(relatedOrdersError.message);
  }

  const normalizedRelatedOrders = relatedOrders ?? [];
  const sharedPayment = normalizedRelatedOrders.length > 1;
  const remainingRelatedOrders = normalizedRelatedOrders.filter(
    (relatedOrder) => relatedOrder.id !== order.id && !relatedOrder.refunded_at
  );
  const fullyRefundedPayment = remainingRelatedOrders.length === 0;

  await updateRefundRecord(
    client,
    order.id,
    refundedAt,
    refundReason,
    fullyRefundedPayment ? "refunded" : "partially-refunded"
  );

  if (!fullyRefundedPayment) {
    return { sharedPayment, fullyRefundedPayment };
  }

  const relatedOrderIds = normalizedRelatedOrders.map((relatedOrder) => relatedOrder.id);
  if (relatedOrderIds.length > 1) {
    const { error: updateRelatedStatusError } = await client
      .from("orders")
      .update({ woo_order_status: "refunded" })
      .in("id", relatedOrderIds);
    if (updateRelatedStatusError) {
      throw new Error(updateRelatedStatusError.message);
    }
  }

  const wooOrderIds = Array.from(
    new Set(
      normalizedRelatedOrders
        .map((relatedOrder) => relatedOrder.woo_order_id)
        .filter((wooOrderId): wooOrderId is string => Boolean(wooOrderId))
    )
  );

  for (const wooOrderId of wooOrderIds) {
    await updateWooOrder(wooOrderId, { status: "refunded" });
  }

  return { sharedPayment, fullyRefundedPayment };
}
