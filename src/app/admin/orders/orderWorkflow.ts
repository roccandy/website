import type { OrderRow, OrderSlot, ProductionSlot } from "@/lib/data";
import { isAdminPremadeOrder } from "@/lib/adminPremadeOrder";
import {
  batchWeightsForOrder,
  nextAssignableKgForOrder,
  productionKgForOrder,
} from "./productionScheduleShared";

export function orderWorkflow(
  order: OrderRow,
  assignments: OrderSlot[],
  slots: ProductionSlot[],
  today: string,
) {
  const own = assignments.filter(
    (assignment) => assignment.order_id === order.id,
  );
  const slotMap = new Map(slots.map((slot) => [slot.id, slot]));
  const dates = own
    .map((assignment) => slotMap.get(assignment.slot_id)?.slot_date)
    .filter((date): date is string => Boolean(date));
  const paid = Boolean(
    order.paid_at || order.square_invoice_status?.toUpperCase() === "PAID",
  );
  const totalCents = Math.max(
    0,
    Math.round(Number(order.total_price ?? 0) * 100),
  );
  const refundedCents =
    Math.max(0, Math.round(Number(order.refunded_amount ?? 0) * 100)) ||
    ((order.refunded_at || order.status === "refunded") &&
    order.status !== "partially-refunded"
      ? totalCents
      : 0);
  const hasRefund = Boolean(
    order.refunded_at ||
      refundedCents > 0 ||
      order.status === "refunded" ||
      order.status === "partially-refunded",
  );
  const fullRefund =
    hasRefund && (refundedCents >= totalCents || order.status === "refunded");
  const partialRefund = hasRefund && !fullRefund;
  const closed = Boolean(
    order.archived_at ||
      order.shipped_at ||
      [
        "archived",
        "shipped",
        "completed",
        "complete",
        "collected",
        "delivered",
        "cancelled",
        "canceled",
      ].includes(order.status),
  );
  const blocked =
    closed ||
    hasRefund ||
    ["failed", "test", "draft", "pending_payment"].includes(order.status);
  const internal = isAdminPremadeOrder(order);
  const premade = order.design_type === "premade" && !internal;
  const planned = batchWeightsForOrder(order);
  const remainingKg = Math.max(
    0,
    productionKgForOrder(order) -
      own.reduce(
        (sum, assignment) => sum + Number(assignment.kg_assigned || 0),
        0,
      ),
  );
  const fullyAssigned =
    own.length >= planned.length &&
    dates.length === own.length &&
    remainingKg < 0.02 &&
    own.length > 0;
  const recordedMade =
    order.made || ["made", "pending completion"].includes(order.status);
  const productionDatesPassed =
    fullyAssigned && dates.every((date) => date < today);
  const canComplete =
    !blocked &&
    (paid || internal) &&
    (premade ||
      recordedMade ||
      (fullyAssigned && dates.every((date) => date <= today)));
  const nextKg = Math.min(remainingKg, nextAssignableKgForOrder(order, own));
  const canDrag = !blocked && !premade && !recordedMade && nextKg > 0.01;
  const label = closed
    ? "Closed"
    : fullRefund
      ? "Fully refunded"
      : partialRefund
        ? "Partially refunded — review"
        : order.status === "test"
          ? "Test order"
          : !paid && !internal
            ? "Payment unconfirmed"
            : premade
              ? "Ready for fulfilment review"
              : recordedMade
                ? "Made — fulfilment open"
                : productionDatesPassed
                  ? "Production dates passed — review"
                  : fullyAssigned
                    ? "Scheduled"
                    : own.length
                      ? "Partially scheduled"
                      : "Needs scheduling";
  const href = `/admin/orders/${encodeURIComponent(order.id)}`;
  const scheduleHref = `/admin/orders?selected=${encodeURIComponent(order.id)}#order-${encodeURIComponent(order.id)}`;
  return {
    own,
    dates,
    paid,
    totalCents,
    refundedCents,
    partialRefund,
    fullRefund,
    hasRefund,
    closed,
    blocked,
    internal,
    premade,
    remainingKg,
    fullyAssigned,
    recordedMade,
    productionDatesPassed,
    canComplete,
    canDrag,
    nextKg,
    label,
    href,
    scheduleHref,
  };
}
