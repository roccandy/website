import Link from "next/link";
import { requireAdminSession } from "@/lib/adminAuth";
import { getOrders, type OrderRow } from "@/lib/data";
import {
  dateKey,
  formatDate,
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

function candyText(order: OrderRow) {
  return order.design_text?.trim() || order.title?.trim() || "-";
}

function customerLabel(order: OrderRow) {
  return order.customer_name || [order.first_name, order.last_name].filter(Boolean).join(" ") || "";
}

function printHref(order: OrderRow) {
  const target = order.id || order.order_number || "";
  return `/admin/orders/${encodeURIComponent(target)}/print?id=${encodeURIComponent(target)}`;
}

export default async function ProductionOrdersPage() {
  await requireAdminSession();

  const orders = await getOrders();

  const visibleOrders = orders.filter(isVisibleOnProductionSchedule).sort(sortProductionOrders);
  const weekWindows = buildWeekWindows();
  const ordersByWeek = weekWindows.map((window) => ({
    ...window,
    days: window.days.map((day) => ({
      date: day,
      orders: visibleOrders.filter((order) => isInWindow(order, { ...window, start: day, end: day })),
    })),
  }));
  const totalOrders = ordersByWeek.reduce(
    (sum, window) => sum + window.days.reduce((daySum, day) => daySum + day.orders.length, 0),
    0
  );

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Admin / Production</p>
          <h1 className="admin-page-title text-zinc-900">Production orders</h1>
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
              {window.days.reduce((sum, day) => sum + day.orders.length, 0)} order
              {window.days.reduce((sum, day) => sum + day.orders.length, 0) === 1 ? "" : "s"}
            </span>
          </div>

          <div className="divide-y divide-zinc-100">
            {window.days.map((day) => (
              <section key={day.date} className="grid gap-4 px-4 py-4 lg:grid-cols-[10rem,1fr]">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-zinc-900">
                    {new Date(`${day.date}T00:00:00`).toLocaleDateString("en-AU", { weekday: "long" })}
                  </p>
                  <p className="text-xs text-zinc-500">{formatDate(day.date)}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                    {day.orders.length} order{day.orders.length === 1 ? "" : "s"}
                  </p>
                </div>

                {day.orders.length ? (
                  <div className="grid gap-3 xl:grid-cols-2">
                    {day.orders.map((order) => {
                      const customer = customerLabel(order);
                      const organization = order.organization_name?.trim();
                      const candy = candyText(order);
                      const orderName = orderDisplayName(order);
                      const isCandyTextSameAsTitle = candy.toLowerCase() === orderName.toLowerCase();
                      return (
                        <article key={order.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                                {order.order_number ? `#${order.order_number}` : `#${order.id.slice(0, 8)}`}
                              </p>
                              <h3 className="mt-1 text-lg font-semibold leading-tight text-zinc-950">{orderName}</h3>
                            </div>
                            <Link
                              href={printHref(order)}
                              target="_blank"
                              className="shrink-0 rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-900"
                            >
                              Print
                            </Link>
                          </div>

                          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                              Candy text
                            </p>
                            <p className="mt-1 text-xl font-semibold leading-snug text-zinc-950">{candy}</p>
                          </div>

                          {!isCandyTextSameAsTitle || customer || organization ? (
                            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                              {!isCandyTextSameAsTitle ? <span>Order title: {orderName}</span> : null}
                              {customer ? <span>Customer: {customer}</span> : null}
                              {organization ? <span>Organisation: {organization}</span> : null}
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-5 text-sm text-zinc-400">
                    No orders
                  </div>
                )}
              </section>
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}
