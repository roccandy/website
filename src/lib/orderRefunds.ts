import type { OrderRow } from "@/lib/data";
import { supabaseAdminClient } from "@/lib/supabase/admin";

type ServerClient = typeof supabaseAdminClient;

type RefundPersistenceInput = {
  client: ServerClient;
  order: OrderRow;
  refundAmount: number;
  refundReason: string | null;
  refundedAt?: string;
};

type GroupRefundPersistenceInput = {
  client: ServerClient;
  orders: OrderRow[];
  refundAmount: number;
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
  refundedAmount: number,
  orderStatus: string
) {
  const refundUpdateWithReason = await client
    .from("orders")
    .update({
      status: orderStatus,
      refunded_at: refundedAt,
      refund_reason: refundReason,
      refunded_amount: refundedAmount,
    })
    .eq("id", orderId);

  if (!refundUpdateWithReason.error) return;

  const missingColumn = /refund_reason|refunded_amount/i.test(refundUpdateWithReason.error.message ?? "");
  if (!missingColumn) {
    throw new Error(refundUpdateWithReason.error.message);
  }

  const refundUpdateFallback = await client
    .from("orders")
    .update({
      status: orderStatus,
      refunded_at: refundedAt,
    })
    .eq("id", orderId);

  if (refundUpdateFallback.error) {
    throw new Error(refundUpdateFallback.error.message);
  }
}

const toMoneyCents = (value: number) => Math.round(value * 100);
const fromMoneyCents = (value: number) => value / 100;

const orderTotalCents = (order: Pick<OrderRow, "total_price">) =>
  Math.max(0, toMoneyCents(Number(order.total_price ?? 0)));

const refundedCents = (order: Pick<OrderRow, "refunded_amount" | "refunded_at" | "status" | "total_price">) => {
  const stored = Number(order.refunded_amount);
  if (Number.isFinite(stored) && stored > 0) return toMoneyCents(stored);
  if (order.refunded_at && order.status !== "partially-refunded") return orderTotalCents(order);
  return 0;
};

const remainingRefundCents = (order: Pick<OrderRow, "refunded_amount" | "refunded_at" | "status" | "total_price">) =>
  Math.max(0, orderTotalCents(order) - refundedCents(order));

export async function persistOrderRefund({
  client,
  order,
  refundAmount,
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
    .select("id,refunded_at,status,total_price,refunded_amount")
    .eq("payment_provider", provider)
    .eq("payment_transaction_id", transactionId);

  if (relatedOrdersError) {
    throw new Error(relatedOrdersError.message);
  }

  const normalizedRelatedOrders = relatedOrders ?? [];
  const sharedPayment = normalizedRelatedOrders.length > 1;
  const remainingRelatedOrders = normalizedRelatedOrders.filter(
    (relatedOrder) => relatedOrder.id !== order.id && remainingRefundCents(relatedOrder) > 0
  );
  const refundCents = toMoneyCents(refundAmount);
  const nextRefundedCents = Math.min(orderTotalCents(order), refundedCents(order) + refundCents);
  const isPartialRefund = nextRefundedCents < orderTotalCents(order);
  const fullyRefundedPayment = !isPartialRefund && remainingRelatedOrders.length === 0;
  const orderStatus = isPartialRefund ? "partially-refunded" : "refunded";

  await updateRefundRecord(
    client,
    order.id,
    refundedAt,
    refundReason,
    fromMoneyCents(nextRefundedCents),
    orderStatus
  );

  if (!fullyRefundedPayment) {
    return { sharedPayment, fullyRefundedPayment };
  }

  const relatedOrderIds = normalizedRelatedOrders.map((relatedOrder) => relatedOrder.id);
  if (relatedOrderIds.length > 1) {
    const { error: updateRelatedStatusError } = await client
      .from("orders")
      .update({ status: "refunded" })
      .in("id", relatedOrderIds);
    if (updateRelatedStatusError) {
      throw new Error(updateRelatedStatusError.message);
    }
  }

  return { sharedPayment, fullyRefundedPayment };
}

export async function persistOrderRefunds({
  client,
  orders,
  refundAmount,
  refundReason,
  refundedAt = new Date().toISOString(),
}: GroupRefundPersistenceInput): Promise<RefundPersistenceResult> {
  const normalizedOrders = orders.filter(Boolean);
  if (normalizedOrders.length === 0) {
    throw new Error("No orders to refund.");
  }

  const provider = normalizedOrders[0]?.payment_provider;
  const transactionId = normalizedOrders[0]?.payment_transaction_id;
  if (!provider || !transactionId) {
    throw new Error("Payment details missing.");
  }

  const hasMismatchedPayment = normalizedOrders.some(
    (order) => order.payment_provider !== provider || order.payment_transaction_id !== transactionId,
  );
  if (hasMismatchedPayment) {
    throw new Error("Orders must share the same payment to refund together.");
  }

  const { data: relatedOrders, error: relatedOrdersError } = await client
    .from("orders")
    .select("id,refunded_at,status,total_price,refunded_amount")
    .eq("payment_provider", provider)
    .eq("payment_transaction_id", transactionId);

  if (relatedOrdersError) {
    throw new Error(relatedOrdersError.message);
  }

  const normalizedRelatedOrders = relatedOrders ?? [];
  const refundedOrderIds = new Set(normalizedOrders.map((order) => order.id));
  const sharedPayment = normalizedRelatedOrders.length > 1;
  const remainingRelatedOrders = normalizedRelatedOrders.filter(
    (relatedOrder) => !refundedOrderIds.has(relatedOrder.id) && remainingRefundCents(relatedOrder) > 0,
  );
  let remainingRefundToAllocateCents = toMoneyCents(refundAmount);
  const allocations = normalizedOrders.map((order) => {
    const availableCents = remainingRefundCents(order);
    const allocatedCents = Math.min(availableCents, remainingRefundToAllocateCents);
    remainingRefundToAllocateCents -= allocatedCents;
    const nextRefundedCents = Math.min(orderTotalCents(order), refundedCents(order) + allocatedCents);
    return { order, nextRefundedCents };
  });
  const selectedFullyRefunded = allocations.every(({ order, nextRefundedCents }) => nextRefundedCents >= orderTotalCents(order));
  const fullyRefundedPayment = selectedFullyRefunded && remainingRelatedOrders.length === 0;

  for (const { order, nextRefundedCents } of allocations) {
    const orderStatus = nextRefundedCents >= orderTotalCents(order) ? "refunded" : "partially-refunded";
    await updateRefundRecord(
      client,
      order.id,
      refundedAt,
      refundReason,
      fromMoneyCents(nextRefundedCents),
      orderStatus
    );
  }

  if (!fullyRefundedPayment) {
    return { sharedPayment, fullyRefundedPayment };
  }

  const relatedOrderIds = normalizedRelatedOrders.map((relatedOrder) => relatedOrder.id);
  if (relatedOrderIds.length > 1) {
    const { error: updateRelatedStatusError } = await client
      .from("orders")
      .update({ status: "refunded" })
      .in("id", relatedOrderIds);
    if (updateRelatedStatusError) {
      throw new Error(updateRelatedStatusError.message);
    }
  }

  return { sharedPayment, fullyRefundedPayment };
}
