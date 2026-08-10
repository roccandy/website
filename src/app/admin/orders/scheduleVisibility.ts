import type { OrderRow } from "@/lib/data";
import { isAdminPremadeOrder } from "@/lib/adminPremadeOrder";

type AdminManagedCustomOrderSource = Pick<OrderRow, "design_type" | "woo_order_id" | "woo_payment_url">;
type AdminManagedCustomOrderPaymentSource = AdminManagedCustomOrderSource &
  Pick<
    OrderRow,
    "paid_at" | "payment_provider" | "square_invoice_id" | "square_invoice_sent_at" | "square_invoice_status" | "status"
  >;

export type AdminInvoicePaymentStatus = "draft" | "unpaid" | "paid";

const SENT_SQUARE_INVOICE_STATUSES = new Set(["UNPAID", "PARTIALLY_PAID", "PAID"]);

export function isRefundedOrder(order: OrderRow) {
  return Boolean(order.refunded_at);
}

export function isAdminManagedCustomOrder(order: AdminManagedCustomOrderSource | null | undefined) {
  if (!order) return false;
  const source = order as Partial<AdminManagedCustomOrderPaymentSource>;
  if (order.design_type === "premade") return false;
  if (source.payment_provider === "square_invoice" || source.square_invoice_id) return true;
  if (source.payment_provider) return false;
  if (source.status === "pending_payment") return false;
  if (!order.woo_order_id && !order.woo_payment_url) return true;
  return source.status === "pending" || source.status === "unassigned";
}

export function isAdminManagedCustomOrderUnpaid(order: AdminManagedCustomOrderPaymentSource | null | undefined) {
  if (!order) return false;
  if (!isAdminManagedCustomOrder(order)) return false;
  return !order.paid_at;
}

/**
 * The production schedule needs a customer-facing payment flag, rather than
 * Square's more granular lifecycle status. A draft becomes unpaid only once it
 * has been published/sent; payment always takes precedence over those fields.
 */
export function adminInvoicePaymentStatus(
  order: AdminManagedCustomOrderPaymentSource | null | undefined,
): AdminInvoicePaymentStatus | null {
  if (!order || !isAdminManagedCustomOrder(order)) return null;

  const squareStatus = order.square_invoice_status?.trim().toUpperCase() ?? "";
  if (order.paid_at || squareStatus === "PAID") return "paid";
  if (order.square_invoice_sent_at || SENT_SQUARE_INVOICE_STATUSES.has(squareStatus)) return "unpaid";
  return "draft";
}

export function isVisibleOnProductionSchedule(order: OrderRow) {
  return isVisibleOnProductionScheduleWithAssignments(order);
}

export function isVisibleOnProductionScheduleWithAssignments(
  order: OrderRow,
  assignedSlotDates: string[] = [],
  todayKey = new Date().toISOString().slice(0, 10),
) {
  const isStandalonePremade = isAdminPremadeOrder(order);
  if ((order.design_type === "premade" && !isStandalonePremade) || order.status === "archived" || isRefundedOrder(order)) {
    return false;
  }

  // Pre-made stock is a one-day production task. Keep its completed slot in
  // the calendar as history, but remove it from the active schedule list on
  // the following day.
  if (isStandalonePremade && assignedSlotDates.length > 0 && assignedSlotDates.every((slotDate) => slotDate < todayKey)) {
    return false;
  }

  return true;
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
