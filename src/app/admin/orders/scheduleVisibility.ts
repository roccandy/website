import type { OrderRow } from "@/lib/data";
import { isAdminPremadeOrder } from "@/lib/adminPremadeOrder";

type AdminManagedCustomOrderSource = Pick<OrderRow, "design_type" | "woo_order_id" | "woo_payment_url">;
type AdminManagedCustomOrderPaymentSource = AdminManagedCustomOrderSource &
  Pick<OrderRow, "paid_at" | "payment_provider" | "square_invoice_id" | "status">;

export function isRefundedOrder(order: OrderRow) {
  return Boolean(order.refunded_at);
}

export function isAdminManagedCustomOrder(order: AdminManagedCustomOrderSource | null | undefined) {
  if (!order) return false;
  const source = order as Partial<AdminManagedCustomOrderPaymentSource>;
  if (order.design_type === "premade") return false;
  if (source.payment_provider === "square_invoice" || source.square_invoice_id) return true;
  if (source.status === "pending_payment") return false;
  if (!order.woo_order_id && !order.woo_payment_url) return true;
  return source.status === "pending" || source.status === "unassigned";
}

export function isAdminManagedCustomOrderUnpaid(order: AdminManagedCustomOrderPaymentSource | null | undefined) {
  if (!order) return false;
  if (!isAdminManagedCustomOrder(order)) return false;
  return !order.paid_at;
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
