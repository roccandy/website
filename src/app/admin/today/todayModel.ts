import type {
  OrderRow,
  OrderSlot,
  ProductionDayNote,
  ProductionSlot,
} from "@/lib/data";
import { isAdminPremadeOrder } from "@/lib/adminPremadeOrder";
import { normalizeBaseOrderNumber } from "@/lib/orderNumbers";
import { batchWeightsForOrder } from "../orders/productionScheduleShared";
import { addDays, cents, daysBetween, perthDate } from "../stats-v2/statsModel";

export type TodayOrder = Pick<
  OrderRow,
  | "id"
  | "order_number"
  | "title"
  | "customer_name"
  | "first_name"
  | "last_name"
  | "created_at"
  | "due_date"
  | "design_type"
  | "category_id"
  | "notes"
  | "total_price"
  | "total_weight_kg"
  | "admin_batch_weights_kg"
  | "made"
  | "pickup"
  | "status"
  | "paid_at"
  | "payment_provider"
  | "payment_method"
  | "woo_order_id"
  | "woo_payment_url"
  | "square_invoice_id"
  | "square_invoice_status"
  | "square_invoice_sent_at"
  | "square_invoice_due_date"
  | "square_invoice_error"
  | "refunded_at"
  | "refund_reason"
  | "refunded_amount"
  | "archived_at"
  | "shipped_at"
>;
export type WorkCategory = "schedule" | "payments" | "dispatch" | "review";
export type WorkIssue = {
  category: WorkCategory;
  label: string;
  detail: string;
  action: string;
  href: string;
  priority: number;
};
export type TodayWorkItem = {
  id: string;
  number: string;
  title: string;
  customer: string;
  due: string | null;
  weight: number;
  lines: number;
  fulfillment: string;
  issues: WorkIssue[];
  priority: number;
};
export type AgendaBatch = {
  id: string;
  number: string;
  title: string;
  weight: number;
  href: string;
  slotIndex: number;
};
export type AgendaDay = {
  date: string;
  batches: AgendaBatch[];
  note: string | null;
};
export type TodayHubData = {
  loadedAt: string;
  today: string;
  items: TodayWorkItem[];
  agenda: AgendaDay[];
  counts: {
    attention: number;
    urgent: number;
    schedule: number;
    payments: number;
    dispatch: number;
    review: number;
    dueSoon: number;
    active: number;
  };
};
const clean = (value: string | null | undefined) => value?.trim() || "";
const kg = (value: unknown) =>
  Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
const isPaid = (row: TodayOrder) =>
  Boolean(row.paid_at || row.square_invoice_status?.toUpperCase() === "PAID");

export function isOpenTodayOrder(row: TodayOrder) {
  const status = clean(row.status).toLowerCase();
  if (
    [
      "archived",
      "shipped",
      "completed",
      "complete",
      "collected",
      "delivered",
      "cancelled",
      "canceled",
      "failed",
      "draft",
      "test",
      "refunded",
    ].includes(status) ||
    row.archived_at ||
    row.shipped_at
  )
    return false;
  const price = cents(row.total_price);
  if (
    row.refunded_at &&
    ((cents(row.refunded_amount) >= price && price > 0) ||
      (!row.refunded_amount && status !== "partially-refunded"))
  )
    return false;
  // Incomplete public checkouts are not confirmed orders for staff to produce.
  if (
    status === "pending_payment" &&
    !isPaid(row) &&
    !row.square_invoice_id &&
    !isAdminPremadeOrder(row)
  )
    return false;
  return true;
}

/** Read-only work queue: no inferred production completion or customer messages. */
export function buildTodayHub(
  orders: TodayOrder[],
  slots: Pick<ProductionSlot, "id" | "slot_date" | "slot_index">[],
  assignments: Pick<OrderSlot, "id" | "order_id" | "slot_id" | "kg_assigned">[],
  notes: Pick<ProductionDayNote, "note_date" | "note">[],
  loadedAt: string,
): TodayHubData {
  const today = perthDate(loadedAt);
  const slotMap = new Map(slots.map((slot) => [slot.id, slot]));
  const assignmentsByOrder = new Map<string, typeof assignments>();
  for (const assignment of assignments) {
    if (!slotMap.has(assignment.slot_id)) continue;
    assignmentsByOrder.set(assignment.order_id, [
      ...(assignmentsByOrder.get(assignment.order_id) ?? []),
      assignment,
    ]);
  }
  const active = orders.filter((row) => {
    if (!isOpenTodayOrder(row)) return false;
    const assigned = assignmentsByOrder.get(row.id) ?? [];
    // Match the schedule's existing one-day lifecycle for internal stock runs.
    return !(
      isAdminPremadeOrder(row) &&
      assigned.length > 0 &&
      assigned.every(
        (assignment) => slotMap.get(assignment.slot_id)!.slot_date < today,
      )
    );
  });
  const groups = new Map<string, TodayOrder[]>();
  for (const row of active) {
    const key =
      normalizeBaseOrderNumber(row.order_number) ??
      (clean(row.order_number) || row.id);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const seenInvoices = new Set<string>();
  const items: TodayWorkItem[] = [];
  for (const [number, rows] of groups) {
    const sorted = [...rows].sort(
      (a, b) =>
        (a.due_date || "9999").localeCompare(b.due_date || "9999") ||
        a.id.localeCompare(b.id),
    );
    const first = sorted[0];
    const issues: WorkIssue[] = [];
    const due =
      sorted
        .map((row) => row.due_date)
        .filter((date): date is string => Boolean(date))
        .sort()[0] ?? null;
    for (const row of sorted) {
      const href = `/admin/orders/${encodeURIComponent(row.id)}`;
      // The existing schedule hides refunded rows, including partial refunds.
      // Keep those follow-ups reachable through the order editor instead.
      const scheduleHref = row.refunded_at
        ? href
        : `/admin/orders?selected=${encodeURIComponent(row.id)}#order-${encodeURIComponent(row.id)}`;
      const internal = isAdminPremadeOrder(row);
      const premade = row.design_type === "premade" && !internal;
      if (
        row.refunded_at ||
        row.status === "partially-refunded" ||
        cents(row.refunded_amount) > 0
      ) {
        const refunded = cents(row.refunded_amount);
        const remaining = Math.max(0, cents(row.total_price) - refunded);
        const money = (value: number) =>
          new Intl.NumberFormat("en-AU", {
            style: "currency",
            currency: "AUD",
          }).format(value / 100);
        issues.push({
          category: "review",
          label: "Partially refunded order still open",
          detail: `${refunded > 0 ? `${money(refunded)} refunded; ${money(remaining)} was not refunded (not a new debt). ` : "A partial refund is recorded. "}${row.refund_reason ? `Recorded reason: ${row.refund_reason}. ` : ""}Confirm whether any goods still need making or fulfilment, or close the order if resolved.`,
          action: "Review refund & status",
          href: `${href}#order-payment`,
          priority: 80,
        });
        continue;
      }
      const invoiceKey = row.square_invoice_id || row.id;
      if (!internal && !isPaid(row) && !seenInvoices.has(invoiceKey)) {
        const invoiceHref = row.square_invoice_id ? `${href}/invoice` : href;
        const sent = Boolean(
          row.square_invoice_sent_at ||
            ["UNPAID", "PARTIALLY_PAID"].includes(
              row.square_invoice_status?.toUpperCase() ?? "",
            ),
        );
        if (
          ["CANCELED", "CANCELLED", "FAILED"].includes(
            row.square_invoice_status?.toUpperCase() ?? "",
          )
        ) {
          issues.push({
            category: "payments",
            label: "Invoice needs review",
            detail:
              "The invoice is cancelled or failed, but the order is still open. Check whether the order should proceed.",
            action: "Review invoice",
            href: invoiceHref,
            priority: 95,
          });
          seenInvoices.add(invoiceKey);
        } else if (row.square_invoice_error) {
          issues.push({
            category: "payments",
            label: "Invoice needs review",
            detail:
              "An invoice error is recorded. Check it before sending again.",
            action: "Review invoice",
            href: invoiceHref,
            priority: 95,
          });
          seenInvoices.add(invoiceKey);
        } else if (
          sent &&
          row.square_invoice_due_date &&
          row.square_invoice_due_date < today
        ) {
          issues.push({
            category: "payments",
            label: "Invoice overdue",
            detail: `${daysBetween(row.square_invoice_due_date, today)} days past the invoice due date. Confirm payment or follow up.`,
            action: "Review payment",
            href: invoiceHref,
            priority: 90,
          });
          seenInvoices.add(invoiceKey);
        } else if (row.square_invoice_id && !sent) {
          issues.push({
            category: "payments",
            label: "Invoice not sent",
            detail: "An invoice draft is saved and waiting for review.",
            action: "Review & send",
            href: invoiceHref,
            priority: 65,
          });
          seenInvoices.add(invoiceKey);
        } else if (
          row.square_invoice_id ||
          row.payment_provider === "square_invoice" ||
          (!row.payment_provider && !row.woo_order_id && !row.woo_payment_url)
        ) {
          issues.push({
            category: "payments",
            label: "Payment unconfirmed",
            detail: /deposit|transfer/i.test(row.payment_method ?? "")
              ? "Check the bank transfer and update the payment record."
              : "Check the payment record before progressing this order.",
            action: "Check payment",
            href: invoiceHref,
            priority: 50,
          });
          seenInvoices.add(invoiceKey);
        }
      }
      if (!internal && row.due_date && row.due_date < today)
        issues.push({
          category: "review",
          label: "Required date passed",
          detail:
            "The order is still open. Check fulfilment or update its required date.",
          action: "Review order",
          href,
          priority: 100,
        });
      if (!premade) {
        const assigned = assignmentsByOrder.get(row.id) ?? [];
        const planned = batchWeightsForOrder(row);
        const remaining = Math.max(
          0,
          planned.reduce((sum, value) => sum + value, 0) -
            assigned.reduce((sum, value) => sum + kg(value.kg_assigned), 0),
        );
        const recordedMade = Boolean(
          row.made || ["made", "pending completion"].includes(row.status),
        );
        if (
          !recordedMade &&
          (remaining > 0.01 || assigned.length < planned.length)
        )
          issues.push({
            category: "schedule",
            label: assigned.length ? "Finish scheduling" : "Needs scheduling",
            detail: `${remaining.toFixed(1)} kg remaining to allocate${assigned.length ? ` · ${assigned.length} of ${planned.length} batches assigned` : ""}.`,
            action: "Choose dates",
            href: scheduleHref,
            priority:
              row.due_date && row.due_date <= addDays(today, 7) ? 85 : 60,
          });
        if (!internal && !row.due_date)
          issues.push({
            category: "review",
            label: "Required date missing",
            detail:
              "Add the customer’s required date so the order can be prioritised.",
            action: "Add date",
            href,
            priority: 70,
          });
        if (
          !recordedMade &&
          assigned.length >= planned.length &&
          assigned.length > 0 &&
          assigned.every(
            (assignment) => slotMap.get(assignment.slot_id)!.slot_date < today,
          )
        )
          issues.push({
            category: "review",
            label: "Production dates passed",
            detail:
              "Check whether production is finished before arranging dispatch or collection.",
            action: "Check progress",
            href: scheduleHref,
            priority: 55,
          });
        if (!internal && recordedMade)
          issues.push({
            category: "dispatch",
            label: row.pickup ? "Arrange collection" : "Arrange dispatch",
            detail: "Production is recorded as made; fulfilment is still open.",
            action: "Open order",
            href: scheduleHref,
            priority: 75,
          });
      } else if (isPaid(row))
        issues.push({
          category: "dispatch",
          label: row.pickup ? "Pre-made pickup" : "Pre-made dispatch",
          detail:
            "Paid pre-made order awaiting fulfilment. Check the items and packing.",
          action: row.refunded_at ? "Review order" : "Open pre-made orders",
          href: row.refunded_at ? href : "/admin/orders/additional-items",
          priority: 70,
        });
    }
    const unique = issues
      .sort((a, b) => b.priority - a.priority)
      .filter(
        (issue, index, all) =>
          all.findIndex(
            (candidate) =>
              candidate.category === issue.category &&
              candidate.label === issue.label,
          ) === index,
      )
      .map((issue) => {
        const matching = issues.filter(
          (candidate) =>
            candidate.category === issue.category &&
            candidate.label === issue.label,
        );
        return matching.length > 1
          ? {
              ...issue,
              detail: `${matching.length} order items need this step. Open the linked item first; the remaining items stay in this queue.`,
            }
          : issue;
      });
    if (!unique.length) continue;
    items.push({
      id: first.id,
      number,
      title:
        clean(first.title) || clean(first.customer_name) || "Untitled order",
      customer: sorted.every(isAdminPremadeOrder)
        ? "Internal stock"
        : clean(first.customer_name) ||
          [clean(first.first_name), clean(first.last_name)]
            .filter(Boolean)
            .join(" ") ||
          "Customer not recorded",
      due,
      weight: sorted.reduce((sum, row) => sum + kg(row.total_weight_kg), 0),
      lines: rows.length,
      fulfillment: sorted.every(isAdminPremadeOrder)
        ? "Internal stock"
        : sorted.every((row) => row.pickup)
          ? "Pickup"
          : sorted.every((row) => !row.pickup)
            ? "Delivery"
            : "Mixed fulfilment",
      issues: unique,
      priority: unique[0].priority,
    });
  }
  items.sort(
    (a, b) =>
      b.priority - a.priority ||
      (a.due || "9999").localeCompare(b.due || "9999") ||
      a.number.localeCompare(b.number),
  );
  const activeMap = new Map(active.map((row) => [row.id, row]));
  const agenda: AgendaDay[] = Array.from({ length: 7 }, (_, day) => {
    const date = addDays(today, day);
    return {
      date,
      note: notes.find((note) => note.note_date === date)?.note || null,
      batches: assignments
        .filter(
          (assignment) =>
            activeMap.has(assignment.order_id) &&
            !activeMap.get(assignment.order_id)?.refunded_at &&
            slotMap.get(assignment.slot_id)?.slot_date === date,
        )
        .map((assignment) => {
          const row = activeMap.get(assignment.order_id)!;
          return {
            id: assignment.id,
            number: row.order_number || row.id.slice(0, 8),
            title: row.title || row.customer_name || "Untitled order",
            weight: kg(assignment.kg_assigned),
            href: row.refunded_at
              ? `/admin/orders/${encodeURIComponent(row.id)}`
              : `/admin/orders?selected=${encodeURIComponent(row.id)}#order-${encodeURIComponent(row.id)}`,
            slotIndex: slotMap.get(assignment.slot_id)!.slot_index,
          };
        })
        .sort((a, b) => a.slotIndex - b.slotIndex),
    };
  });
  const categoryCount = (category: WorkCategory) =>
    items.filter((item) =>
      item.issues.some((issue) => issue.category === category),
    ).length;
  return {
    loadedAt,
    today,
    items,
    agenda,
    counts: {
      attention: items.length,
      urgent: items.filter((item) => item.priority >= 85).length,
      schedule: categoryCount("schedule"),
      payments: categoryCount("payments"),
      dispatch: categoryCount("dispatch"),
      review: categoryCount("review"),
      dueSoon: [...groups.values()].filter((rows) =>
        rows.some(
          (row) =>
            row.due_date &&
            row.due_date >= today &&
            row.due_date <= addDays(today, 6),
        ),
      ).length,
      active: groups.size,
    },
  };
}
