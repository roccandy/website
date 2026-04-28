import Link from "next/link";
import { requireAdminSession } from "@/lib/adminAuth";
import { getOrders, getOrderSlots, getPackagingOptions, getProductionSlots, type OrderRow } from "@/lib/data";
import {
  dateKey,
  formatDate,
  formatOrderDescription,
  weightLabel,
} from "@/app/admin/orders/productionScheduleShared";
import { isVisibleOnProductionSchedule } from "@/app/admin/orders/scheduleVisibility";

export const metadata = {
  title: "Production Orders | Roc Candy Admin",
};

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type WeekWindow = {
  label: string;
  start: string;
  end: string;
};

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = start.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + mondayOffset);
  return start;
}

function buildWeekWindows(today = new Date()): WeekWindow[] {
  const thisWeekStart = startOfWeek(today);
  const nextWeekStart = addDays(thisWeekStart, 7);
  return [
    {
      label: "This week",
      start: dateKey(thisWeekStart),
      end: dateKey(addDays(thisWeekStart, 6)),
    },
    {
      label: "Next week",
      start: dateKey(nextWeekStart),
      end: dateKey(addDays(nextWeekStart, 6)),
    },
  ];
}

function isInWindow(order: OrderRow, window: WeekWindow) {
  const dueDate = order.due_date ?? "";
  return dueDate >= window.start && dueDate <= window.end;
}

function sortProductionOrders(a: OrderRow, b: OrderRow) {
  const aDate = a.due_date ?? "9999-12-31";
  const bDate = b.due_date ?? "9999-12-31";
  if (aDate !== bDate) return aDate.localeCompare(bDate);
  return (a.order_number ?? a.id).localeCompare(b.order_number ?? b.id);
}

function orderDisplayName(order: OrderRow) {
  return order.title?.trim() || order.design_text?.trim() || order.customer_name?.trim() || "Untitled order";
}

function printHref(order: OrderRow) {
  const target = order.id || order.order_number || "";
  return `/admin/orders/${encodeURIComponent(target)}/print?id=${encodeURIComponent(target)}`;
}

export default async function ProductionOrdersPage() {
  await requireAdminSession();

  const [orders, packagingOptions, assignments, slots] = await Promise.all([
    getOrders(),
    getPackagingOptions(),
    getOrderSlots(),
    getProductionSlots(),
  ]);

  const packagingById = new Map(packagingOptions.map((option) => [option.id, option]));
  const slotById = new Map(slots.map((slot) => [slot.id, slot]));
  const assignedProductionDateByOrderId = new Map<string, string>();
  for (const assignment of assignments) {
    if (assignedProductionDateByOrderId.has(assignment.order_id)) continue;
    const slot = slotById.get(assignment.slot_id);
    if (slot) assignedProductionDateByOrderId.set(assignment.order_id, slot.slot_date);
  }

  const visibleOrders = orders.filter(isVisibleOnProductionSchedule).sort(sortProductionOrders);
  const weekWindows = buildWeekWindows();
  const ordersByWeek = weekWindows.map((window) => ({
    ...window,
    orders: visibleOrders.filter((order) => isInWindow(order, window)),
  }));
  const totalOrders = ordersByWeek.reduce((sum, window) => sum + window.orders.length, 0);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Admin / Production</p>
          <h1 className="admin-page-title text-zinc-900">Production orders</h1>
          <p className="text-sm text-zinc-600">
            Read-only order list for this week and next week. Print access only.
          </p>
        </div>
        <div className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800">
          {totalOrders} order{totalOrders === 1 ? "" : "s"}
        </div>
      </div>

      {ordersByWeek.map((window) => (
        <section key={window.label} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-3">
            <div>
              <h2 className="admin-card-title text-zinc-900">{window.label}</h2>
              <p className="text-xs text-zinc-500">
                {formatDate(window.start)} to {formatDate(window.end)}
              </p>
            </div>
            <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-600">
              {window.orders.length} order{window.orders.length === 1 ? "" : "s"}
            </span>
          </div>

          {window.orders.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-white text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Date required</th>
                    <th className="px-4 py-3 text-left">Production date</th>
                    <th className="px-4 py-3 text-left">Order</th>
                    <th className="px-4 py-3 text-left">Customer</th>
                    <th className="px-4 py-3 text-left">Description</th>
                    <th className="px-4 py-3 text-left">Weight</th>
                    <th className="px-4 py-3 text-left">Delivery</th>
                    <th className="px-4 py-3 text-left">Print</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {window.orders.map((order) => {
                    const packaging = packagingById.get(order.packaging_option_id ?? "") ?? null;
                    const productionDate = assignedProductionDateByOrderId.get(order.id) ?? null;
                    return (
                      <tr key={order.id} className="align-top">
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-zinc-900">
                          {formatDate(order.due_date) || "-"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-zinc-700">
                          {formatDate(productionDate) || "Unassigned"}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-zinc-900">
                            {order.order_number ? `#${order.order_number}` : `#${order.id.slice(0, 8)}`}
                          </p>
                          <p className="mt-1 max-w-56 text-xs text-zinc-500">{orderDisplayName(order)}</p>
                        </td>
                        <td className="px-4 py-3 text-zinc-700">
                          <p>{order.customer_name || [order.first_name, order.last_name].filter(Boolean).join(" ") || "-"}</p>
                          {order.organization_name ? (
                            <p className="mt-1 text-xs text-zinc-500">{order.organization_name}</p>
                          ) : null}
                        </td>
                        <td className="max-w-md px-4 py-3 text-zinc-700">
                          {formatOrderDescription(order, packaging) || "-"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-zinc-700">
                          {weightLabel(order.total_weight_kg) || "-"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-zinc-700">
                          {order.pickup ? "Pickup" : `Delivery${order.state ? ` - ${order.state}` : ""}`}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <Link
                            href={printHref(order)}
                            target="_blank"
                            className="inline-flex rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-900"
                          >
                            Print order
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-4 py-8 text-sm text-zinc-500">No orders due in this week.</div>
          )}
        </section>
      ))}
    </section>
  );
}
