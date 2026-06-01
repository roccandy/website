import Link from "next/link";
import { requireAdminSession } from "@/lib/adminAuth";
import { getOrders, getOrderSlots, getProductionSlots, type OrderRow } from "@/lib/data";
import {
  dateKey,
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
  days: string[];
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
      days: Array.from({ length: 7 }, (_, index) => dateKey(addDays(thisWeekStart, index))),
    },
    {
      label: "Next week",
      start: dateKey(nextWeekStart),
      end: dateKey(addDays(nextWeekStart, 6)),
      days: Array.from({ length: 7 }, (_, index) => dateKey(addDays(nextWeekStart, index))),
    },
  ];
}

function scheduleDateForOrder(order: OrderRow, assignedProductionDateByOrderId: Map<string, string>) {
  return assignedProductionDateByOrderId.get(order.id) ?? "";
}

function isInWindow(order: OrderRow, window: Pick<WeekWindow, "start" | "end">, assignedProductionDateByOrderId: Map<string, string>) {
  const scheduleDate = scheduleDateForOrder(order, assignedProductionDateByOrderId);
  return scheduleDate >= window.start && scheduleDate <= window.end;
}

function sortProductionOrders(a: OrderRow, b: OrderRow, assignedProductionDateByOrderId: Map<string, string>) {
  const aDate = scheduleDateForOrder(a, assignedProductionDateByOrderId) || "9999-12-31";
  const bDate = scheduleDateForOrder(b, assignedProductionDateByOrderId) || "9999-12-31";
  if (aDate !== bDate) return aDate.localeCompare(bDate);
  return (a.order_number ?? a.id).localeCompare(b.order_number ?? b.id);
}

function orderDisplayName(order: OrderRow) {
  return order.title?.trim() || order.design_text?.trim() || order.customer_name?.trim() || "Untitled order";
}

function candyText(order: OrderRow) {
  return order.design_text?.trim() || order.title?.trim() || "-";
}

function formatDayDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

function printHref(order: OrderRow) {
  const target = order.id || order.order_number || "";
  return `/admin/orders/${encodeURIComponent(target)}/print?id=${encodeURIComponent(target)}`;
}

export default async function ProductionOrdersPage() {
  await requireAdminSession();

  const [orders, assignments, slots] = await Promise.all([
    getOrders(),
    getOrderSlots(),
    getProductionSlots(),
  ]);

  const slotById = new Map(slots.map((slot) => [slot.id, slot]));
  const assignedProductionDateByOrderId = new Map<string, string>();
  for (const assignment of assignments) {
    if (assignedProductionDateByOrderId.has(assignment.order_id)) continue;
    const slot = slotById.get(assignment.slot_id);
    if (slot?.slot_date) {
      assignedProductionDateByOrderId.set(assignment.order_id, slot.slot_date);
    }
  }

  const visibleOrders = orders
    .filter((order) => isVisibleOnProductionSchedule(order) && assignedProductionDateByOrderId.has(order.id))
    .sort((a, b) => sortProductionOrders(a, b, assignedProductionDateByOrderId));
  const weekWindows = buildWeekWindows();
  const ordersByWeek = weekWindows.map((window) => ({
    ...window,
    days: window.days.map((day) => ({
      date: day,
      orders: visibleOrders.filter((order) => isInWindow(order, { start: day, end: day }, assignedProductionDateByOrderId)),
    })),
  }));
  const todayKey = dateKey(new Date());
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Admin / Production</p>
          <h1 className="admin-page-title text-zinc-900">Production orders</h1>
        </div>
      </div>

      {ordersByWeek.map((window) => (
        <section key={window.label} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-2">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">{window.label}</h2>
              <p className="text-[11px] text-zinc-500">
                {formatDayDate(window.start)} to {formatDayDate(window.end)}
              </p>
            </div>
          </div>

          <div className="space-y-1.5 p-2">
            {window.days.map((day) => {
              const isToday = day.date === todayKey;
              return (
              <section
                key={day.date}
                className={`grid gap-2 px-3 py-2 lg:grid-cols-[8rem,1fr] ${
                  isToday ? "bg-emerald-50/75 ring-1 ring-inset ring-emerald-200" : ""
                }`}
              >
                <div className="flex items-baseline justify-between gap-2 lg:block lg:space-y-0.5">
                  <div className="flex items-center gap-2 lg:block">
                    <p className="text-xs font-semibold text-zinc-900">
                      {new Date(`${day.date}T00:00:00`).toLocaleDateString("en-AU", { weekday: "long" })}
                    </p>
                  </div>
                  <p className={`text-[11px] ${isToday ? "font-semibold text-emerald-800" : "text-zinc-500"}`}>
                    {formatDayDate(day.date)}
                  </p>
                </div>

                {day.orders.length ? (
                  <div className="space-y-1.5">
                    {day.orders.map((order) => {
                      const candy = candyText(order);
                      const orderName = orderDisplayName(order);
                      return (
                        <article
                          key={order.id}
                          className="grid gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_7rem_auto] lg:items-center"
                        >
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-semibold leading-tight text-zinc-950">{orderName}</h3>
                          </div>

                          <div className="min-w-0 rounded-md border border-amber-200 bg-amber-50 px-2 py-1">
                            <p className="truncate text-sm font-semibold leading-snug text-zinc-950">{candy}</p>
                          </div>

                          <p className="text-xs font-semibold text-zinc-700">{weightLabel(order.total_weight_kg) || "-"}</p>
                          <Link
                            href={printHref(order)}
                            target="_blank"
                            className="shrink-0 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-900"
                          >
                            Print
                          </Link>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-400">
                    No orders
                  </div>
                )}
              </section>
              );
            })}
          </div>
        </section>
      ))}
    </section>
  );
}
