import type { OrderRow } from "@/lib/data";
import { isAdminPremadeOrder } from "@/lib/adminPremadeOrder";

export function isRefundedOrder(order: OrderRow) {
  return Boolean(order.refunded_at);
}

export function isVisibleOnProductionSchedule(order: OrderRow) {
  const isStandalonePremade = isAdminPremadeOrder(order);
  return (order.design_type !== "premade" || isStandalonePremade) && order.status !== "archived" && !isRefundedOrder(order);
}

export function isVisibleOnPremadeOrders(order: OrderRow) {
  return (
    order.design_type === "premade" &&
    !isAdminPremadeOrder(order) &&
    order.status !== "shipped" &&
    order.status !== "refunded" &&
    order.status !== "archived" &&
    !isRefundedOrder(order)
  );
}
