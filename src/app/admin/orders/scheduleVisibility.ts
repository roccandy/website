import type { OrderRow } from "@/lib/data";

export function isRefundedOrder(order: OrderRow) {
  return Boolean(order.refunded_at);
}

export function isVisibleOnProductionSchedule(order: OrderRow) {
  return order.design_type !== "premade" && order.status !== "archived" && !isRefundedOrder(order);
}

export function isVisibleOnPremadeOrders(order: OrderRow) {
  return (
    order.design_type === "premade" &&
    order.status !== "shipped" &&
    order.status !== "refunded" &&
    order.status !== "archived" &&
    !isRefundedOrder(order)
  );
}
