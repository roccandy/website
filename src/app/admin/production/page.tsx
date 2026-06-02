import Link from "next/link";
import Image from "next/image";
import { requireAdminSession } from "@/lib/adminAuth";
import { getOrders, getOrderSlots, getProductionSlots, type OrderRow } from "@/lib/data";
import OrderTitleWithLogo from "@/app/admin/orders/OrderTitleWithLogo";
import { CandyPreview } from "@/app/quote/CandyPreview";
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

type CandyPreviewMode = "" | "rainbow" | "pinstripe" | "two_colour";

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

function candyDesignText(order: OrderRow) {
  return order.design_text?.trim() || "";
}

function normalizeHeart(value: string) {
  return value
    .replace(/\ufe0f/g, "")
    .replace(/\s*[\u2665\u2764]\s*/g, " ❤️ ")
    .replace(/\s+/g, " ")
    .trim();
}

function isBrandedOrder(order: OrderRow) {
  return order.category_id === "branded" || order.design_type === "branded";
}

function isWeddingOrder(order: OrderRow) {
  return Boolean(order.category_id?.startsWith("weddings"));
}

function candyContentLabel(order: OrderRow) {
  const rawText = candyDesignText(order);
  if (!rawText && !isBrandedOrder(order)) return "Blank Candy";
  const text = normalizeHeart(rawText);
  if (isBrandedOrder(order)) return "Logo:";
  if (order.category_id === "custom-7-14") return `Text 7-14: ${text}`;
  if (order.category_id === "weddings-initials") return `Wedding Initials: ${text}`;
  if (order.category_id === "weddings-both-names") return `Wedding Names: ${text}`;
  return `Text 1-6: ${text}`;
}

function previewPropsForOrder(order: OrderRow) {
  const designText = order.design_text ? normalizeHeart(order.design_text) : "";
  const hasHeart = designText.includes("❤️");
  const [lineOne, lineTwo] = hasHeart ? designText.split("❤️").map((part) => part.trim()) : ["", ""];
  const isBranded = isBrandedOrder(order);
  const isWedding = isWeddingOrder(order);
  const mode: CandyPreviewMode =
    order.jacket_type === "rainbow" || order.jacket_type === "pinstripe" || order.jacket_type === "two_colour"
      ? order.jacket_type
      : "";

  return {
    designText: !isBranded && !isWedding ? designText : undefined,
    lineOne: isWedding ? lineOne : undefined,
    lineTwo: isWedding ? lineTwo : undefined,
    showHeart: isWedding,
    mode,
    showPinstripe: order.jacket === "pinstripe" || order.jacket === "two_colour_pinstripe",
    colorOne: order.jacket_color_one || "#b7b7b7",
    colorTwo: order.jacket_color_two || order.jacket_color_one || "#b7b7b7",
    logoUrl: isBranded ? order.logo_url : undefined,
    textColor: order.text_color || "#b7b7b7",
    heartColor: order.heart_color || order.text_color || "#b7b7b7",
    isInitials: order.category_id === "weddings-initials",
  };
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

          <div className="divide-y divide-zinc-200">
            {window.days.map((day) => {
              const isToday = day.date === todayKey;
              return (
              <section
                key={day.date}
                className={`space-y-2 px-3 py-3 ${
                  isToday ? "bg-emerald-50/75 ring-1 ring-inset ring-emerald-200" : ""
                }`}
              >
                <div>
                  <p className="whitespace-nowrap text-xs font-semibold text-zinc-900">
                    {new Date(`${day.date}T00:00:00`).toLocaleDateString("en-AU", { weekday: "long" })}{" "}
                    <span className={`text-[11px] ${isToday ? "font-semibold text-emerald-800" : "text-zinc-500"}`}>
                      {formatDayDate(day.date)}
                    </span>
                  </p>
                </div>

                {day.orders.length ? (
                  <div className="overflow-x-auto pb-1">
                    <div className="space-y-1.5" style={{ minWidth: 920 }}>
                      {day.orders.map((order, index) => {
                        const orderName = `${index + 1}. ${orderDisplayName(order)}`;
                        const isBranded = isBrandedOrder(order);
                        const previewProps = previewPropsForOrder(order);
                        return (
                          <div
                            key={order.id}
                            className="grid items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm shadow-sm"
                            style={{ gridTemplateColumns: "88px minmax(0, 1fr) minmax(0, 1fr) 104px 150px" }}
                          >
                            <div className="flex h-14 w-20 items-center justify-center pr-4">
                              <CandyPreview {...previewProps} dimensions={{ width: 78, height: 56 }} zoom={1} />
                            </div>
                            <h3 className="truncate whitespace-nowrap text-[15px] font-semibold leading-tight text-zinc-950">
                              <OrderTitleWithLogo order={order} title={orderName} className="max-w-full whitespace-nowrap" />
                            </h3>
                            <div className="min-w-0 px-2">
                              {isBranded && order.logo_url ? (
                                <div className="flex min-w-0 items-center gap-2 whitespace-nowrap">
                                  <span className="shrink-0 text-sm font-semibold leading-snug text-zinc-950">Logo:</span>
                                  <Image
                                    src={order.logo_url}
                                    alt="Candy logo"
                                    width={30}
                                    height={30}
                                    unoptimized
                                    className="h-8 w-8 shrink-0 object-contain"
                                  />
                                </div>
                              ) : (
                                <p className="truncate whitespace-nowrap text-sm font-semibold leading-snug text-zinc-950">
                                  {candyContentLabel(order)}
                                </p>
                              )}
                            </div>
                            <p className="whitespace-nowrap text-lg font-bold text-zinc-900">
                              {weightLabel(order.total_weight_kg) || "-"}
                            </p>
                            <Link
                              href={printHref(order)}
                              target="_blank"
                              className="inline-flex w-full items-center justify-center whitespace-nowrap rounded-md border border-zinc-900 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-800"
                            >
                              See Order Details
                            </Link>
                          </div>
                        );
                      })}
                    </div>
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
