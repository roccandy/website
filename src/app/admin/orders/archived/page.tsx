import { getOrders, getOrderSlots, getProductionSlots, type OrderRow } from "@/lib/data";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { archiveOrderInline, markAdditionalItemsShipped, refundOrder, unarchiveOrder } from "../actions";
import { RefundForm } from "../RefundForm";
import SplitAwareActionForm from "../SplitAwareActionForm";
import { PremadeGroupShipButton } from "../additional-items/PremadeGroupShipButton";
import { completionActionLabel, getPremadeSiblingMeta, getScheduleStatus } from "../productionScheduleShared";

export const metadata = {
  title: "All Orders | Roc Candy Admin",
};

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type SearchParams = {
  view?: string | string[] | undefined;
};

type FilterView = "all" | "archived" | "uncompleted";

type VisibleSubgroup = {
  suffix: string | null;
  orders: OrderRow[];
  isPremadeGroup: boolean;
  status: string;
  statusLabel: string;
  label: string;
  allRefunded: boolean;
  partiallyRefunded: boolean;
  completedAt: string | null;
  completionLabel: string | null;
  isCompleted: boolean;
  latestCompletedAt: number | null;
  earliestDueAt: number | null;
};

const FILTER_OPTIONS: { value: FilterView; label: string }[] = [
  { value: "all", label: "All orders" },
  { value: "archived", label: "Completed orders" },
  { value: "uncompleted", label: "Uncompleted orders" },
];

const formatDate = (iso: string | null) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
};

const formatDateTime = (iso: string | null) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

const resolvePremadeStatus = (status: string | null | undefined) => (status === "shipped" ? "shipped" : "pending");
const formatStatusLabel = (status: string) =>
  status === "pending completion" ? "pending" : status.replace(/_/g, " ");
const formatCompletionLabel = (pickup: boolean) => (pickup ? "Collected" : "Delivered");
const isResettableCompletedOrder = (order: OrderRow) => order.status === "archived" || order.status === "shipped";
const isRefundableOrder = (order: OrderRow) =>
  Boolean(order.paid_at && order.payment_transaction_id && !order.refunded_at && !isResettableCompletedOrder(order));
const isCompletablePremadeOrder = (order: OrderRow) => order.design_type === "premade" && order.status !== "shipped" && !order.refunded_at;
const getOrderSuffix = (orderNumber: string | null | undefined) => {
  const match = orderNumber?.match(/-(a|b)$/i);
  return match ? match[1].toLowerCase() : null;
};

const scheduleStatusBadge = (status: string) => {
  if (status === "archived") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "pending completion") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "scheduled") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "unassigned") return "border-zinc-300 bg-zinc-100 text-zinc-700";
  return "border-red-200 bg-red-50 text-red-700";
};

const premadeStatusBadge = (status: string) => {
  if (status === "shipped") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "pending") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-zinc-200 bg-zinc-50 text-zinc-600";
};

const resolveScheduleGroupStatus = (statuses: string[]) => {
  if (statuses.length === 0) return "pending";
  if (statuses.every((status) => status === "archived")) return "archived";
  if (statuses.includes("unassigned")) return "unassigned";
  if (statuses.includes("pending completion")) return "pending completion";
  if (statuses.includes("scheduled")) return "scheduled";
  return statuses[0] ?? "pending";
};

const normalizeOrderNumber = (value: string | null | undefined) => {
  if (!value) return null;
  return value.replace(/-(a|b)$/i, "");
};

const weightLabel = (kg: number | null | undefined) => {
  if (!kg || Number.isNaN(kg)) return "";
  return `${(Number(kg) * 1000).toFixed(0)} g`;
};

const toTime = (value: string | null | undefined) => {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
};

const latestIsoValue = (values: (string | null | undefined)[]) =>
  values
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => compareNullableDesc(toTime(a), toTime(b)))[0] ?? null;

const compareNullableAsc = (a: number | null, b: number | null) => {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
};

const compareNullableDesc = (a: number | null, b: number | null) => {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
};

const resolveFilterView = (value: string | string[] | undefined): FilterView => {
  const firstValue = Array.isArray(value) ? value[0] : value;
  if (firstValue === "archived" || firstValue === "uncompleted") return firstValue;
  return "all";
};

const buildViewHref = (view: FilterView) =>
  view === "all" ? "/admin/orders/archived" : `/admin/orders/archived?view=${view}`;

const resolveCompletedAt = (order: OrderRow) =>
  order.refunded_at ?? (order.design_type === "premade" ? order.shipped_at : order.archived_at);

export default async function AllOrdersPage({ searchParams }: { searchParams?: SearchParams | Promise<SearchParams> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/admin/login");

  const resolvedSearchParams = await Promise.resolve(searchParams);
  const activeView = resolveFilterView(resolvedSearchParams?.view);
  const redirectTo = buildViewHref(activeView);

  const [orders, slots, assignments] = await Promise.all([getOrders(), getProductionSlots(), getOrderSlots()]);
  const slotMap = new Map(slots.map((slot) => [slot.id, slot]));
  const assignmentByOrderId = new Map<string, (typeof assignments)[number]>();
  assignments.forEach((assignment) => {
    if (assignmentByOrderId.has(assignment.order_id)) return;
    assignmentByOrderId.set(assignment.order_id, assignment);
  });
  const todayKey = (() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = `${now.getMonth() + 1}`.padStart(2, "0");
    const day = `${now.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  })();
  const scheduleStatusById = new Map<string, string>();
  orders.forEach((order) => {
    if (order.status === "archived") {
      scheduleStatusById.set(order.id, "archived");
      return;
    }
    const assignment = assignmentByOrderId.get(order.id);
    if (!assignment) {
      scheduleStatusById.set(order.id, "unassigned");
      return;
    }
    const slotDate = slotMap.get(assignment.slot_id)?.slot_date;
    if (slotDate && slotDate < todayKey) {
      scheduleStatusById.set(order.id, "pending completion");
      return;
    }
    scheduleStatusById.set(order.id, "scheduled");
  });

  const groupedOrders = new Map<
    string,
    {
      baseOrderNumber: string | null;
      orders: OrderRow[];
    }
  >();

  orders.forEach((order) => {
    const baseNumber = normalizeOrderNumber(order.order_number);
    const key = baseNumber ? `order:${baseNumber}` : `id:${order.id}`;
    const group = groupedOrders.get(key) ?? { baseOrderNumber: baseNumber, orders: [] };
    group.orders.push(order);
    groupedOrders.set(key, group);
  });

  const groupedList = Array.from(groupedOrders.values())
    .map((group, groupIndex) => {
      const subgroupMap = new Map<string, { suffix: string | null; orders: OrderRow[] }>();
      group.orders.forEach((order) => {
        const suffix = getOrderSuffix(order.order_number);
        const key = suffix ?? "main";
        const subgroup = subgroupMap.get(key) ?? { suffix, orders: [] };
        subgroup.orders.push(order);
        subgroupMap.set(key, subgroup);
      });

      const subgroupList = Array.from(subgroupMap.values()).sort((a, b) => {
        const rank = (suffix: string | null) => (suffix === "a" ? 0 : suffix === "b" ? 1 : 2);
        return rank(a.suffix) - rank(b.suffix);
      });

      const visibleSubgroups: VisibleSubgroup[] = subgroupList
        .map((subgroup) => {
          const isPremadeGroup = subgroup.orders.every((order) => order.design_type === "premade");
          const statusList = subgroup.orders.map((order) =>
            isPremadeGroup
              ? resolvePremadeStatus(order.status)
              : scheduleStatusById.get(order.id) ?? order.status ?? "pending",
          );
          const status = isPremadeGroup
            ? statusList.every((value) => value === "shipped")
              ? "shipped"
              : "pending"
            : resolveScheduleGroupStatus(statusList);
          const refundedCount = subgroup.orders.filter((order) => Boolean(order.refunded_at)).length;
          const allRefunded = refundedCount > 0 && refundedCount === subgroup.orders.length;
          const partiallyRefunded = refundedCount > 0 && !allRefunded;
          const isPickup = subgroup.orders.every((order) => order.pickup);
          const completionTimes = subgroup.orders
            .map((order) => toTime(resolveCompletedAt(order)))
            .filter((value): value is number => value !== null);
          const dueTimes = subgroup.orders
            .map((order) => toTime(order.due_date))
            .filter((value): value is number => value !== null);
          const isCompleted = allRefunded || (isPremadeGroup ? status === "shipped" : status === "archived");

          return {
            ...subgroup,
            isPremadeGroup,
            status,
            statusLabel: formatStatusLabel(status),
            label: subgroup.suffix ? `-${subgroup.suffix}` : "order",
            allRefunded,
            partiallyRefunded,
            completedAt: latestIsoValue(subgroup.orders.map((order) => resolveCompletedAt(order))),
            completionLabel: isCompleted ? formatCompletionLabel(isPickup) : null,
            isCompleted,
            latestCompletedAt: completionTimes.length > 0 ? Math.max(...completionTimes) : null,
            earliestDueAt: dueTimes.length > 0 ? Math.min(...dueTimes) : null,
          };
        })
        .filter((subgroup) => {
          if (activeView === "archived") return subgroup.isCompleted;
          if (activeView === "uncompleted") return !subgroup.isCompleted;
          return true;
        });

      if (visibleSubgroups.length === 0) return null;

      const visibleOrders = visibleSubgroups.flatMap((subgroup) => subgroup.orders);
      const firstOrder = visibleOrders[0] ?? group.orders[0] ?? null;
      const orderNumber = group.baseOrderNumber
        ? `#${group.baseOrderNumber}`
        : firstOrder?.id
          ? `#${firstOrder.id.slice(0, 8)}`
          : "";
      const customers = visibleOrders
        .map((order) => order.customer_name ?? [order.first_name, order.last_name].filter(Boolean).join(" "))
        .filter((name) => name && name.trim());
      const uniqueCustomers = Array.from(new Set(customers));
      const customer = uniqueCustomers.length <= 1 ? uniqueCustomers[0] ?? "" : "Multiple";
      const dueDates = visibleOrders.map((order) => order.due_date).filter(Boolean);
      const uniqueDueDates = Array.from(new Set(dueDates));
      const dueDate = uniqueDueDates.length <= 1 ? formatDate(uniqueDueDates[0] ?? null) : "Multiple";
      const totalWeight = visibleOrders.reduce((sum, order) => sum + Number(order.total_weight_kg || 0), 0);
      const weight = totalWeight > 0 ? weightLabel(totalWeight) : "";
      const latestCompletedAt = visibleSubgroups
        .map((subgroup) => subgroup.latestCompletedAt)
        .filter((value): value is number => value !== null)
        .reduce<number | null>((latest, value) => (latest === null || value > latest ? value : latest), null);
      const earliestDueAt = visibleSubgroups
        .map((subgroup) => subgroup.earliestDueAt)
        .filter((value): value is number => value !== null)
        .reduce<number | null>((earliest, value) => (earliest === null || value < earliest ? value : earliest), null);
      const latestCreatedAt = visibleOrders
        .map((order) => toTime(order.created_at))
        .filter((value): value is number => value !== null)
        .reduce<number | null>((latest, value) => (latest === null || value > latest ? value : latest), null);
      const isCompleted = visibleSubgroups.every((subgroup) => subgroup.isCompleted);
      const sharedPaymentOrderIds = new Set(
        group.orders
          .filter(
            (order) =>
              Boolean(order.payment_provider) &&
              Boolean(order.payment_transaction_id) &&
              group.orders.some(
                (candidate) =>
                  candidate.id !== order.id &&
                  candidate.payment_provider === order.payment_provider &&
                  candidate.payment_transaction_id === order.payment_transaction_id,
              ),
          )
          .map((order) => order.id),
      );

      return {
        groupIndex,
        orderNumber,
        customer,
        dueDate,
        weight,
        visibleOrders,
        visibleSubgroups,
        latestCompletedAt,
        earliestDueAt,
        latestCreatedAt,
        isCompleted,
        sharedPaymentOrderIds,
      };
    })
    .filter((group): group is NonNullable<typeof group> => group !== null)
    .sort((a, b) => {
      if (activeView === "archived") {
        return compareNullableDesc(a.latestCompletedAt, b.latestCompletedAt) || compareNullableDesc(a.latestCreatedAt, b.latestCreatedAt);
      }
      if (activeView === "uncompleted") {
        return compareNullableAsc(a.earliestDueAt, b.earliestDueAt) || compareNullableDesc(a.latestCreatedAt, b.latestCreatedAt);
      }
      if (a.isCompleted !== b.isCompleted) {
        return a.isCompleted ? -1 : 1;
      }
      return a.isCompleted
        ? compareNullableDesc(a.latestCompletedAt, b.latestCompletedAt) || compareNullableDesc(a.latestCreatedAt, b.latestCreatedAt)
        : compareNullableAsc(a.earliestDueAt, b.earliestDueAt) || compareNullableDesc(a.latestCreatedAt, b.latestCreatedAt);
    });

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Admin / Production</p>
        <h2 className="admin-page-title">All Orders</h2>
        <p className="text-sm text-zinc-600">Custom and pre-made order history.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-zinc-200 bg-white p-1 shadow-sm">
          {FILTER_OPTIONS.map((option) => {
            const isActive = activeView === option.value;
            return (
              <Link
                key={option.value}
                href={buildViewHref(option.value)}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  isActive ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                }`}
              >
                {option.label}
              </Link>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-500">{groupedList.length} orders</span>
          <Link
            href="/admin/orders"
            className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
          >
            Back to schedule
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 text-[11px] uppercase tracking-[0.2em] text-zinc-500">
            <tr>
              <th className="px-3 py-3 text-left">Order #</th>
              <th className="px-3 py-3 text-left">Title</th>
              <th className="px-3 py-3 text-left">Date required</th>
              <th className="px-3 py-3 text-left">Order weight</th>
              <th className="px-3 py-3 text-left">Customer</th>
              <th className="px-3 py-3 text-left">Status</th>
              <th className="w-44 px-3 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {groupedList.flatMap((group, groupIndex) =>
              group.visibleSubgroups.map((subgroup, subgroupIndex) => {
                const rowBorderClass =
                  groupIndex > 0 && subgroupIndex === 0
                    ? "border-t-2 border-zinc-200"
                    : subgroupIndex > 0
                      ? "border-t border-zinc-100"
                      : "";
                const showGroupCells = subgroupIndex === 0;
                const rowKey = `${group.orderNumber || group.visibleOrders[0]?.id || groupIndex}-${subgroup.label}`;
                const badge = subgroup.allRefunded
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : subgroup.isPremadeGroup
                    ? premadeStatusBadge(subgroup.status)
                    : scheduleStatusBadge(subgroup.status);
                const subgroupResettableOrders = subgroup.orders.filter((order) => isResettableCompletedOrder(order));
                const subgroupRefundableOrders = subgroup.orders.filter((order) => isRefundableOrder(order));
                const subgroupCompletablePremadeOrders = subgroup.orders.filter((order) => isCompletablePremadeOrder(order));
                const subgroupRefundAmount = subgroupRefundableOrders.reduce((sum, order) => sum + Number(order.total_price ?? 0), 0);
                const premadeCompletionLabel = subgroup.orders.every((order) => order.pickup) ? "Collected" : "Delivered";
                const baseOrderNumber = normalizeOrderNumber(subgroup.orders[0]?.order_number) ?? group.orderNumber ?? null;
                const companionOrders =
                  subgroup.isPremadeGroup && baseOrderNumber
                    ? orders.filter((order) => {
                        if (normalizeOrderNumber(order.order_number) !== baseOrderNumber) return false;
                        if (subgroup.orders.some((subgroupOrder) => subgroupOrder.id === order.id)) return false;
                        if (order.design_type === "premade") return false;
                        if (order.refunded_at) return false;
                        if (order.status === "archived") return false;
                        return true;
                      })
                    : [];
                const companionScheduleIssue =
                  subgroup.isPremadeGroup && companionOrders.length > 0
                    ? (() => {
                        for (const companionOrder of companionOrders) {
                          const assignment = assignmentByOrderId.get(companionOrder.id);
                          const assignedSlotDate = assignment ? slotMap.get(assignment.slot_id)?.slot_date ?? null : null;
                          const scheduleStatus = getScheduleStatus(companionOrder, assignedSlotDate, todayKey);
                          const href = `/admin/orders?selected=${encodeURIComponent(companionOrder.id)}`;

                          if (scheduleStatus === "unassigned") {
                            return {
                              href,
                              message: "Order is unassigned, please update the production schedule or cancel.",
                            };
                          }

                          if (scheduleStatus === "scheduled" && assignedSlotDate && assignedSlotDate > todayKey) {
                            return {
                              href,
                              message: "Order is scheduled for a future date, please update the production schedule or cancel.",
                            };
                          }
                        }

                        return null;
                      })()
                    : null;
                const companionLabel =
                  companionOrders.length > 0
                    ? (() => {
                        const labels = companionOrders
                          .map(
                            (order) =>
                              order.title?.trim() ||
                              order.order_description?.trim() ||
                              `Order #${order.order_number || baseOrderNumber}`,
                          )
                          .filter(Boolean);
                        if (labels.length === 0) return "the other item in the order";
                        if (labels.length === 1) return labels[0];
                        return `${labels[0]} and ${labels.length - 1} more item${labels.length > 2 ? "s" : ""}`;
                      })()
                    : null;
                const companionOrderIds = companionOrders.map((order) => order.id).join(",");

                return (
                  <tr key={rowKey} className="bg-white">
                    <td className={`px-3 py-2 font-semibold text-zinc-900 ${rowBorderClass}`}>
                      {showGroupCells ? group.orderNumber : ""}
                    </td>
                    <td className={`px-3 py-2 text-zinc-800 ${rowBorderClass}`}>
                      <div className="space-y-2">
                        {subgroup.orders.map((order) => {
                          const title = order.title ?? "Untitled";
                          const lineNumber = order.order_number
                            ? `#${order.order_number}`
                            : order.id
                              ? `#${order.id.slice(0, 8)}`
                              : "";
                          return (
                            <div key={order.id} className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-zinc-900">{title}</p>
                                {order.refunded_at ? (
                                  <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                                    Refunded
                                  </span>
                                ) : null}
                              </div>
                              <p className="text-xs text-zinc-500">{lineNumber}</p>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td className={`px-3 py-2 text-zinc-700 ${rowBorderClass}`}>{showGroupCells ? group.dueDate : ""}</td>
                    <td className={`px-3 py-2 text-zinc-700 ${rowBorderClass}`}>{showGroupCells ? group.weight : ""}</td>
                    <td className={`px-3 py-2 text-zinc-700 ${rowBorderClass}`}>{showGroupCells ? group.customer : ""}</td>
                    <td className={`px-3 py-2 text-zinc-700 ${rowBorderClass}`}>
                      <div className="space-y-1">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge}`}>
                          {subgroup.allRefunded
                            ? "Refunded"
                            : subgroup.partiallyRefunded
                              ? "Partially refunded"
                              : subgroup.completionLabel ?? subgroup.statusLabel}
                        </span>
                        {subgroup.completedAt && subgroup.completionLabel ? (
                          <div className="text-xs text-zinc-500">
                            {subgroup.completionLabel} on {formatDateTime(subgroup.completedAt)}
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className={`w-44 max-w-44 px-3 py-2 align-top text-zinc-700 ${rowBorderClass}`}>
                      {subgroup.isPremadeGroup ? (
                        <div className="space-y-2">
                          {subgroup.status === "pending" && subgroupCompletablePremadeOrders.length > 0 ? (
                            <PremadeGroupShipButton
                              action={markAdditionalItemsShipped}
                              orderIds={subgroupCompletablePremadeOrders.map((order) => order.id).join(",")}
                              companionOrderIds={companionOrderIds || undefined}
                              baseOrderNumber={baseOrderNumber ?? subgroup.orders[0]?.order_number ?? ""}
                              companionLabel={companionLabel ?? undefined}
                              companionActionLabel={subgroup.orders.every((order) => order.pickup) ? "collected" : "delivered"}
                              buttonLabel={premadeCompletionLabel}
                              companionScheduleHref={companionScheduleIssue?.href}
                              companionScheduleMessage={companionScheduleIssue?.message}
                              redirectTo={redirectTo}
                            />
                          ) : null}
                          {subgroupResettableOrders.length > 0 ? (
                            <form action={unarchiveOrder}>
                              <input type="hidden" name="order_id" value={subgroupResettableOrders[0]?.id ?? ""} />
                              <input
                                type="hidden"
                                name="order_ids"
                                value={subgroupResettableOrders.map((order) => order.id).join(",")}
                              />
                              <input type="hidden" name="redirect_to" value={redirectTo} />
                              <button
                                type="submit"
                                className="rounded border border-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                              >
                                Mark as pending
                              </button>
                            </form>
                          ) : null}
                          {subgroupRefundableOrders.length > 0 ? (
                            <RefundForm
                              orderId={subgroupRefundableOrders[0]?.id ?? ""}
                              orderIds={subgroupRefundableOrders.map((order) => order.id)}
                              orderNumber={subgroupRefundableOrders[0]?.order_number}
                              amount={subgroupRefundAmount}
                              action={refundOrder}
                              redirectTo={redirectTo}
                              compact
                            />
                          ) : null}
                          {subgroupCompletablePremadeOrders.length === 0 &&
                          subgroupResettableOrders.length === 0 &&
                          subgroupRefundableOrders.length === 0 ? (
                            <span className="text-xs text-zinc-400">-</span>
                          ) : null}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {subgroup.orders.map((order) => {
                            const hasReset = isResettableCompletedOrder(order);
                            const hasRefund = isRefundableOrder(order);
                            const assignedSlotDate = assignmentByOrderId.get(order.id)
                              ? slotMap.get(assignmentByOrderId.get(order.id)!.slot_id)?.slot_date ?? null
                              : null;
                            const canComplete = getScheduleStatus(order, assignedSlotDate, todayKey) === "pending completion" && !order.refunded_at;
                            const premadeSiblingMeta = getPremadeSiblingMeta(orders, order);

                            return (
                              <div key={`actions-${order.id}`} className="space-y-1">
                                {canComplete ? (
                                  <SplitAwareActionForm
                                    action={archiveOrderInline}
                                    hiddenFields={[{ name: "order_id", value: order.id }]}
                                    buttonLabel={completionActionLabel(order)}
                                    buttonClassName="inline-flex items-center rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:border-emerald-300"
                                    confirmMessage={`Confirm ${order.pickup ? "collection" : "delivery"} for this order?`}
                                    companionMeta={premadeSiblingMeta}
                                  />
                                ) : null}
                                {hasReset ? (
                                  <form action={unarchiveOrder}>
                                    <input type="hidden" name="order_id" value={order.id} />
                                    <input type="hidden" name="redirect_to" value={redirectTo} />
                                    <button
                                      type="submit"
                                      className="rounded border border-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                                    >
                                      Mark as pending
                                    </button>
                                  </form>
                                ) : null}
                                {hasRefund ? (
                                  <RefundForm
                                    orderId={order.id}
                                    orderNumber={order.order_number}
                                    amount={order.total_price}
                                    action={refundOrder}
                                    redirectTo={redirectTo}
                                    compact
                                  />
                                ) : null}
                                {!canComplete && !hasReset && !hasRefund ? <span className="text-xs text-zinc-400">-</span> : null}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              }),
            )}
            {groupedList.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-sm text-zinc-500">
                  No orders in this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
