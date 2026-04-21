import { getOrders, getOrderSlots, getProductionSlots } from "@/lib/data";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { normalizeBaseOrderNumber } from "@/lib/orderNumbers";
import { markAdditionalItemsPending, markAdditionalItemsShipped } from "../actions";
import { PremadeGroupShipButton } from "./PremadeGroupShipButton";
import { dateKey, getScheduleStatus } from "../productionScheduleShared";
import { isVisibleOnPremadeOrders } from "../scheduleVisibility";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type SearchParams = {
  focus?: string;
};

const formatDate = (iso: string | null) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
};

const formatQuantity = (quantity: number | null | undefined) => {
  if (!Number.isFinite(quantity ?? NaN) || Number(quantity) <= 0) return "-";
  const value = Number(quantity);
  return Number.isInteger(value) ? `${value}` : `${value.toFixed(2)}`;
};

const formatMoney = (amount: number | null | undefined) => {
  if (!Number.isFinite(amount ?? NaN)) return "-";
  return `$${Number(amount).toFixed(2)}`;
};

const statusBadge = (status: string) => {
  if (status === "shipped") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "pending") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-zinc-200 bg-zinc-50 text-zinc-600";
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const resolveShippedAt = (orders: { shipped_at: string | null; created_at: string }[]) => {
  const shippedTimes = orders
    .map((order) => (order.shipped_at ? new Date(order.shipped_at).getTime() : null))
    .filter((value): value is number => value !== null && Number.isFinite(value));
  if (shippedTimes.length > 0) return new Date(Math.max(...shippedTimes));
  return null;
};

const shouldShowPremade = (order: { status: string | null; shipped_at: string | null }) => {
  if (order.status !== "shipped") return true;
  if (!order.shipped_at) return true;
  const ageMs = Date.now() - new Date(order.shipped_at).getTime();
  return ageMs <= ONE_DAY_MS;
};

const renderCountdown = (shippedAt: Date | null) => {
  if (!shippedAt) return null;
  const elapsed = Math.max(0, Date.now() - shippedAt.getTime());
  const remaining = Math.max(0, ONE_DAY_MS - elapsed);
  const remainingHours = Math.floor(remaining / (60 * 60 * 1000));
  const remainingMinutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  const remainingLabel = `${remainingHours}h ${remainingMinutes}m`;
  return (
    <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Hides in {remainingLabel}</div>
  );
};

const shippedOnLabel = (shippedAt: Date | null) => {
  if (!shippedAt) return null;
  return `Shipped on ${formatDate(shippedAt.toISOString())}`;
};

export default async function AdditionalItemsPage({ searchParams }: { searchParams?: SearchParams | Promise<SearchParams> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/admin/login");
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const focusedGroup = resolvedSearchParams?.focus?.trim() || null;

  const [orders, assignments, slots] = await Promise.all([getOrders(), getOrderSlots(), getProductionSlots()]);
  const todayKey = dateKey(new Date());
  const slotById = new Map(slots.map((slot) => [slot.id, slot]));
  const assignmentByOrderId = new Map<string, (typeof assignments)[number]>();
  assignments.forEach((assignment) => {
    if (!assignmentByOrderId.has(assignment.order_id)) {
      assignmentByOrderId.set(assignment.order_id, assignment);
    }
  });
  const additionalItems = orders
    .filter(isVisibleOnPremadeOrders)
    .filter((order) => shouldShowPremade(order))
    .sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    });
  const groupedItems = new Map<
    string,
    {
      orderNumber: string | null;
      orders: typeof additionalItems;
      latestDate: string | null;
    }
  >();
  additionalItems.forEach((order) => {
    const key = order.order_number ? `order:${order.order_number}` : `id:${order.id}`;
    const group = groupedItems.get(key) ?? { orderNumber: order.order_number ?? null, orders: [], latestDate: null };
    group.orders.push(order);
    if (order.created_at && (!group.latestDate || order.created_at > group.latestDate)) {
      group.latestDate = order.created_at;
    }
    groupedItems.set(key, group);
  });
  const groupedList = Array.from(groupedItems.values()).sort((a, b) => {
    const aTime = a.latestDate ? new Date(a.latestDate).getTime() : 0;
    const bTime = b.latestDate ? new Date(b.latestDate).getTime() : 0;
    return bTime - aTime;
  });
  const summaryLabel =
    groupedList.length === additionalItems.length
      ? `${additionalItems.length} items`
      : `${groupedList.length} orders / ${additionalItems.length} items`;

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Admin / Production</p>
        <h2 className="admin-page-title">Pre-made orders</h2>
        <p className="text-sm text-zinc-600">Premade candy orders that need shipping updates.</p>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-500">{summaryLabel}</span>
        <Link
          href="/admin/orders"
          className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
        >
          Back to schedule
        </Link>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 text-[11px] uppercase tracking-[0.2em] text-zinc-500">
            <tr>
              <th className="px-3 py-3 text-left">Order #</th>
              <th className="px-3 py-3 text-left">Premade item</th>
              <th className="px-3 py-3 text-left">Qty</th>
              <th className="px-3 py-3 text-left">Customer</th>
              <th className="px-3 py-3 text-left">Quote order</th>
              <th className="px-3 py-3 text-left">Ordered</th>
              <th className="px-3 py-3 text-left">Total</th>
              <th className="px-3 py-3 text-left">Status</th>
              <th className="px-3 py-3 text-left">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {groupedList.map((group) => {
              const groupOrders = group.orders;
              const firstOrder = groupOrders[0];
              const orderNumber = group.orderNumber
                ? `#${group.orderNumber}`
                : firstOrder?.id
                  ? `#${firstOrder.id.slice(0, 8)}`
                  : "-";
              const customerName =
                groupOrders
                  .map((order) => order.customer_name ?? [order.first_name, order.last_name].filter(Boolean).join(" "))
                  .find((name) => name && name.trim()) ?? "";
              const customer = customerName || "-";
              const statuses = groupOrders.map((order) => (order.status ?? "pending").toString());
              const isShipped = statuses.length > 0 && statuses.every((status) => status === "shipped");
              const isRefunded = groupOrders.some((order) => Boolean(order.refunded_at));
              const pickup = groupOrders.every((order) => Boolean(order.pickup));
              const status = isRefunded
                ? "refunded"
                : isShipped
                  ? "shipped"
                  : statuses.includes("pending")
                    ? "pending"
                    : statuses[0] ?? "pending";
              const statusLabel =
                status === "shipped" && pickup ? "collected" : status.replace(/_/g, " ");
              const quoteOrders = groupOrders.map((order) => order.notes?.trim()).filter(Boolean);
              const quoteOrder = quoteOrders.length > 0 ? Array.from(new Set(quoteOrders)).join(" | ") : "-";
              const orderIds = groupOrders.map((order) => order.id).filter(Boolean).join(",");
              const quantityTotal = groupOrders.reduce((sum, order) => sum + Number(order.quantity || 0), 0);
              const totalQuantityLabel = quantityTotal > 0 ? formatQuantity(quantityTotal) : "-";
              const totals = groupOrders
                .map((order) => Number(order.total_price))
                .filter((value) => Number.isFinite(value));
              const totalPriceLabel =
                totals.length > 0 ? formatMoney(totals.reduce((sum, value) => sum + value, 0)) : "-";
              const orderedDate = group.latestDate ? formatDate(group.latestDate) : "";
              const shippedAt = isShipped ? resolveShippedAt(groupOrders) : null;
              const groupAnchor = `premade-group-${(group.orderNumber?.trim() || firstOrder?.id || "group").replace(/[^a-zA-Z0-9_-]/g, "-")}`;
              const groupKey = (group.orderNumber?.trim() || firstOrder?.id || "group").replace(/[^a-zA-Z0-9_-]/g, "-");
              const isFocused = focusedGroup === groupKey;
              const baseOrderNumber = normalizeBaseOrderNumber(group.orderNumber ?? firstOrder?.order_number) ?? null;
              const companionOrders =
                baseOrderNumber
                  ? orders.filter((order) => {
                      if (normalizeBaseOrderNumber(order.order_number) !== baseOrderNumber) return false;
                      if (groupOrders.some((groupOrder) => groupOrder.id === order.id)) return false;
                      if (order.design_type === "premade") return false;
                      if (order.refunded_at) return false;
                      if (order.status === "archived") return false;
                      return true;
                    })
                  : [];
              const companionScheduleIssue = (() => {
                for (const companionOrder of companionOrders) {
                  const assignment = assignmentByOrderId.get(companionOrder.id);
                  const assignedSlotDate = assignment ? slotById.get(assignment.slot_id)?.slot_date ?? null : null;
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
              })();
              const companionOrderIds = companionOrders.map((order) => order.id).join(",");
              const companionLabel = (() => {
                if (companionOrders.length === 0) return null;
                const labels = companionOrders
                  .map((order) => order.title?.trim() || order.order_description?.trim() || `Order #${order.order_number || baseOrderNumber}`)
                  .filter(Boolean);
                if (labels.length === 0) return "the other item in the order";
                if (labels.length === 1) return labels[0];
                return `${labels[0]} and ${labels.length - 1} more item${labels.length > 2 ? "s" : ""}`;
              })();
              const completionActionLabel = pickup ? "collected" : "delivered";
              const primaryActionLabel = pickup ? "Mark collected" : "Mark shipped";
              const completedButtonLabel = pickup ? "Collected" : "Shipped";
              const completedDateLabel = (() => {
                const label = shippedOnLabel(shippedAt);
                if (!label) return null;
                return pickup ? label.replace(/^Shipped on/i, "Collected on") : label;
              })();

              return (
                <tr
                  key={`${orderNumber}-${orderIds}`}
                  id={groupAnchor}
                  className={isFocused ? "bg-rose-50" : "bg-white"}
                >
                  <td className="px-3 py-2 font-semibold text-zinc-900">{orderNumber}</td>
                  <td className="px-3 py-2 text-zinc-800">
                    <div className="space-y-2">
                      {groupOrders.map((order) => {
                        const title = order.title?.trim() || order.order_description?.trim() || "Additional item";
                        const description = order.title?.trim() ? order.order_description?.trim() : "";
                        const qty = formatQuantity(order.quantity);
                        const qtyLabel = qty !== "-" ? `x ${qty}` : "";
                        return (
                          <div key={order.id} className="space-y-1">
                            <p className="font-semibold text-zinc-900">
                              {title}
                              {qtyLabel ? <span className="ml-2 text-xs font-semibold text-zinc-500">{qtyLabel}</span> : null}
                            </p>
                            {description ? <p className="text-xs text-zinc-500">{description}</p> : null}
                          </div>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-zinc-700">{totalQuantityLabel}</td>
                  <td className="px-3 py-2 text-zinc-700">{customer}</td>
                  <td className="px-3 py-2 text-zinc-700">{quoteOrder}</td>
                  <td className="px-3 py-2 text-zinc-700">{orderedDate}</td>
                  <td className="px-3 py-2 text-zinc-700">{totalPriceLabel}</td>
                  <td className="px-3 py-2 text-zinc-700">
                    {status === "shipped" ? (
                      <div className="space-y-1">
                        {renderCountdown(shippedAt)}
                        {completedDateLabel ? (
                          <div className="text-xs text-zinc-500">{completedDateLabel}</div>
                        ) : null}
                      </div>
                    ) : (
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                          status === "refunded"
                            ? "border-rose-200 bg-rose-50 text-rose-700"
                            : statusBadge(status)
                        }`}
                      >
                        {statusLabel}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-zinc-700">
                    {isRefunded ? (
                      <span className="text-xs text-zinc-400">Refunded</span>
                    ) : isShipped ? (
                      <form action={markAdditionalItemsPending}>
                        <input type="hidden" name="order_ids" value={orderIds} />
                        <button
                          type="submit"
                          className="rounded border border-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-600 hover:border-zinc-300 hover:text-zinc-800"
                        >
                          {completedButtonLabel}
                        </button>
                      </form>
                    ) : (
                      <PremadeGroupShipButton
                        action={markAdditionalItemsShipped}
                        orderIds={orderIds}
                        companionOrderIds={companionOrderIds}
                        baseOrderNumber={baseOrderNumber ?? group.orderNumber ?? firstOrder?.order_number ?? orderNumber.replace(/^#/, "")}
                        companionLabel={companionLabel ?? undefined}
                        companionActionLabel={companionLabel ? completionActionLabel : undefined}
                        buttonLabel={primaryActionLabel}
                        companionScheduleHref={companionScheduleIssue?.href}
                        companionScheduleMessage={companionScheduleIssue?.message}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
            {groupedList.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-sm text-zinc-500">
                  No additional items yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
