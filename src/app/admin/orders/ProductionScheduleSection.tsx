"use client";

import { useMemo, useState } from "react";
import type { OrderRow, OrderSlot, ProductionBlock, ProductionSlot, SettingsRow } from "@/lib/data";
import { addManualBlock, addOpenOverride, archiveOrder, assignOrderToSlot, deleteAssignment, removeManualBlock } from "./actions";
import {
  canCompleteOrderForSlotDate,
  completionActionLabel,
  dateKey,
  formatDate,
  formatMonthLabel,
  formatOrderDescription,
  getScheduleStatus,
  isManualBlock,
  isOpenOverride,
  statusCard,
  weightLabel,
} from "./productionScheduleShared";

type Props = {
  orders: OrderRow[];
  slots: ProductionSlot[];
  assignments: OrderSlot[];
  blocks: ProductionBlock[];
  settings: SettingsRow;
  unassignedOrders: OrderRow[];
};

const blockedStyle = {
  backgroundImage:
    "repeating-linear-gradient(135deg, rgba(250, 204, 21, 0.35) 0 12px, rgba(17, 24, 39, 0.18) 12px 24px)",
};

export default function ProductionScheduleSection({
  orders,
  slots,
  assignments,
  blocks,
  settings,
  unassignedOrders,
}: Props) {
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<"calendar" | "week">("week");
  const [slotPicker, setSlotPicker] = useState<{ date: string; slotIndex: number } | null>(null);

  const todayKey = dateKey(new Date());
  const ordersById = useMemo(() => new Map(orders.map((order) => [order.id, order])), [orders]);
  const slotMap = useMemo(() => new Map(slots.map((slot) => [slot.id, slot])), [slots]);
  const blockRanges = useMemo(
    () =>
      blocks.map((block) => ({
        id: block.id,
        start: block.start_date,
        end: block.end_date,
        reason: block.reason,
      })),
    [blocks],
  );

  const isBlockedByDefault = (date: Date) => {
    const day = date.getDay();
    if (day === 0) return settings.no_production_sun;
    if (day === 1) return settings.no_production_mon;
    if (day === 2) return settings.no_production_tue;
    if (day === 3) return settings.no_production_wed;
    if (day === 4) return settings.no_production_thu;
    if (day === 5) return settings.no_production_fri;
    return settings.no_production_sat;
  };

  const blockReasonForDate = (key: string) => {
    const matches = blockRanges.filter((block) => key >= block.start && key <= block.end);
    const explicit = matches.find((block) => !isOpenOverride(block.reason));
    return explicit ? explicit.reason : null;
  };

  const hasOpenOverrideForDate = (key: string) =>
    blockRanges.some((block) => key >= block.start && key <= block.end && isOpenOverride(block.reason));

  const assignmentBySlotKey = useMemo(() => {
    const map = new Map<string, OrderSlot>();
    assignments.forEach((assignment) => {
      const slot = slotMap.get(assignment.slot_id);
      if (!slot) return;
      map.set(`${slot.slot_date}:${slot.slot_index}`, assignment);
    });
    return map;
  }, [assignments, slotMap]);

  const slotIdByKey = useMemo(() => {
    const map = new Map<string, string>();
    slots.forEach((slot) => {
      const key = `${slot.slot_date}:${slot.slot_index}`;
      if (!map.has(key)) {
        map.set(key, slot.id);
      }
    });
    return map;
  }, [slots]);

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const start = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startOffset = (start.getDay() + 6) % 7;
    const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
    return Array.from({ length: totalCells }, (_, idx) => new Date(year, month, idx - startOffset + 1));
  }, [calendarMonth]);

  const weekDays = useMemo(() => {
    const anchor = new Date(calendarMonth);
    anchor.setDate(anchor.getDate() - 1);
    return Array.from({ length: 14 }, (_, idx) => {
      const next = new Date(anchor);
      next.setDate(anchor.getDate() + idx);
      return next;
    });
  }, [calendarMonth]);

  const slotsPerDay = Math.max(1, Number(settings.production_slots_per_day) || 1);

  const movePrev = () => {
    if (viewMode === "calendar") {
      setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
      return;
    }
    const next = new Date(calendarMonth);
    next.setDate(calendarMonth.getDate() - 7);
    setCalendarMonth(next);
  };

  const moveNext = () => {
    if (viewMode === "calendar") {
      setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));
      return;
    }
    const next = new Date(calendarMonth);
    next.setDate(calendarMonth.getDate() + 7);
    setCalendarMonth(next);
  };

  const closeSlotPicker = () => setSlotPicker(null);

  return (
    <>
      <div id="production-calendar" className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-zinc-900">Production Calendar</h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex overflow-hidden rounded-full border border-zinc-200">
              <button
                type="button"
                onClick={() => setViewMode("week")}
                className={`px-3 py-1 text-xs font-semibold ${
                  viewMode === "week" ? "bg-zinc-900 text-white" : "bg-white text-zinc-700"
                }`}
              >
                Week list
              </button>
              <button
                type="button"
                onClick={() => setViewMode("calendar")}
                className={`px-3 py-1 text-xs font-semibold ${
                  viewMode === "calendar" ? "bg-zinc-900 text-white" : "bg-white text-zinc-700"
                }`}
              >
                Calendar
              </button>
            </div>
            <button
              type="button"
              onClick={movePrev}
              className="rounded border border-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
            >
              Prev
            </button>
            <span className="text-sm font-semibold text-zinc-800">{formatMonthLabel(calendarMonth)}</span>
            <button
              type="button"
              onClick={moveNext}
              className="rounded border border-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
            >
              Next
            </button>
          </div>
        </div>
        {viewMode === "calendar" ? (
          <>
            <div className="mt-3 grid grid-cols-7 gap-2 text-[11px] uppercase tracking-[0.2em] text-zinc-400">
              {"Mon Tue Wed Thu Fri Sat Sun".split(" ").map((day) => (
                <div key={day} className="text-center">
                  {day}
                </div>
              ))}
            </div>

            <div className="mt-2 grid grid-cols-7 gap-2">
              {calendarDays.map((day) => {
                const key = dateKey(day);
                const inMonth = day.getMonth() === calendarMonth.getMonth();
                const defaultBlocked = isBlockedByDefault(day);
                const reason = blockReasonForDate(key);
                const hasOpenOverride = hasOpenOverrideForDate(key);
                const blocked = (defaultBlocked && !hasOpenOverride) || Boolean(reason);
                const blockedLabel = reason ?? "Blocked";
                const isToday = dateKey(new Date()) === key;
                return (
                  <div
                    key={key}
                    className={`min-h-[140px] rounded-lg border px-2 py-2 ${
                      inMonth ? "border-zinc-200" : "border-zinc-100 text-zinc-300"
                    } ${blocked ? "border-zinc-300 bg-white" : "bg-white"} ${isToday ? "ring-2 ring-slate-900" : ""}`}
                    style={blocked ? blockedStyle : undefined}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className={`${inMonth ? "text-zinc-700" : "text-zinc-300"}`}>{day.getDate()}</span>
                      {!blocked ? (
                        <form action={addManualBlock}>
                          <input type="hidden" name="date" value={key} />
                          <button
                            type="submit"
                            className="rounded border border-zinc-200 bg-white px-2 py-1 text-[10px] font-semibold text-zinc-600 hover:border-zinc-300"
                          >
                            Block
                          </button>
                        </form>
                      ) : null}
                    </div>
                    <div className="mt-2 space-y-2">
                      {blocked ? (
                        <div className="rounded border border-dashed border-zinc-300 bg-white/80 px-2 py-2 text-[10px]">
                          <p className="font-semibold text-zinc-700">{blockedLabel}</p>
                          {defaultBlocked && !reason && !hasOpenOverride && (
                            <form action={addOpenOverride} className="mt-2">
                              <input type="hidden" name="date" value={key} />
                              <button
                                type="submit"
                                className="rounded border border-zinc-200 bg-white px-2 py-1 text-[10px] font-semibold text-zinc-600 hover:border-zinc-300"
                              >
                                Unblock
                              </button>
                            </form>
                          )}
                          {reason && isManualBlock(reason) && (
                            <form action={removeManualBlock} className="mt-2">
                              <input type="hidden" name="date" value={key} />
                              <button
                                type="submit"
                                className="rounded border border-zinc-200 bg-white px-2 py-1 text-[10px] font-semibold text-zinc-600 hover:border-zinc-300"
                              >
                                Unblock
                              </button>
                            </form>
                          )}
                        </div>
                      ) : (
                        <>
                          {Array.from({ length: slotsPerDay }, (_, idx) => {
                            const slotIndex = idx + 1;
                            const slotKey = `${key}:${slotIndex}`;
                            const assignment = assignmentBySlotKey.get(slotKey);
                            const order = assignment ? ordersById.get(assignment.order_id) : null;
                            const printTarget = order?.id ?? order?.order_number;
                            const title =
                              order?.title ||
                              (order ? formatOrderDescription(order) : "") ||
                              order?.order_number ||
                              "Order";
                            const canCompleteSlotOrder = order ? canCompleteOrderForSlotDate(order, key) : false;
                            const canUnassignSlotOrder = key >= todayKey;
                            return (
                              <div key={slotKey} className="rounded border border-dashed border-zinc-200 p-1.5">
                                {assignment && order ? (
                                  <div
                                    className={`rounded-md border px-2.5 py-2 text-[11px] ${statusCard(
                                      getScheduleStatus(order, key, todayKey),
                                    )}`}
                                  >
                                    <div className="min-w-0">
                                      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Title</p>
                                      <p className="mt-0.5 break-words text-sm font-semibold leading-tight text-zinc-900">{title}</p>
                                      <div className="mt-1 space-y-0.5 text-[10px] text-zinc-700">
                                        <p>{weightLabel(order.total_weight_kg)}</p>
                                        <p>Due {formatDate(order.due_date)}</p>
                                      </div>
                                    </div>
                                    <div className="mt-2 flex flex-col items-stretch gap-1">
                                      {printTarget ? (
                                        <a
                                          href={`/admin/orders/${encodeURIComponent(printTarget)}/print?id=${encodeURIComponent(printTarget)}`}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="rounded border border-zinc-200 bg-white px-2 py-1 text-center text-[10px] font-semibold text-zinc-700 hover:border-zinc-300"
                                        >
                                          Print order
                                        </a>
                                      ) : null}
                                      {canCompleteSlotOrder ? (
                                        <form
                                          action={archiveOrder}
                                          onSubmit={(event) => {
                                            const confirmed = window.confirm(
                                              `Confirm ${order.pickup ? "collection" : "delivery"} for this order? It will move out of the production schedule.`
                                            );
                                            if (!confirmed) {
                                              event.preventDefault();
                                            }
                                          }}
                                        >
                                          <input type="hidden" name="order_id" value={order.id} />
                                          <button
                                            type="submit"
                                            className="w-full rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-center text-[10px] font-semibold text-emerald-700 hover:border-emerald-300"
                                          >
                                            {completionActionLabel(order)}
                                          </button>
                                        </form>
                                      ) : null}
                                      {canUnassignSlotOrder ? (
                                        <form action={deleteAssignment}>
                                          <input type="hidden" name="assignment_id" value={assignment.id} />
                                          <button
                                            type="submit"
                                            className="w-full rounded border border-rose-200 bg-rose-50 px-2 py-1 text-center text-[10px] font-semibold text-rose-700 hover:border-rose-300"
                                          >
                                            Unassign
                                          </button>
                                        </form>
                                      ) : null}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between gap-2 rounded px-1 py-0.5">
                                    <span className="text-[10px] font-medium text-zinc-400">Empty</span>
                                    <button
                                      type="button"
                                      disabled={key < todayKey}
                                      onClick={() => setSlotPicker({ date: key, slotIndex })}
                                      className={`rounded px-2 py-1 text-[10px] font-semibold ${
                                        key < todayKey
                                          ? "border border-zinc-200 bg-zinc-100 text-zinc-400"
                                          : "border border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800"
                                      }`}
                                    >
                                      {key < todayKey ? "Past date" : "Assign"}
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="mt-3 space-y-3">
            {weekDays.map((day) => {
              const key = dateKey(day);
              const defaultBlocked = isBlockedByDefault(day);
              const reason = blockReasonForDate(key);
              const hasOpenOverride = hasOpenOverrideForDate(key);
              const blocked = (defaultBlocked && !hasOpenOverride) || Boolean(reason);
              const blockedLabel = reason ?? "Blocked";
              const isToday = dateKey(new Date()) === key;
              const label = day.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
              return (
                <div
                  key={key}
                  className={`rounded-lg border px-3 py-3 ${
                    blocked ? "border-zinc-300 bg-white" : "border-zinc-200 bg-white"
                  } ${isToday ? "ring-2 ring-slate-900" : ""}`}
                  style={blocked ? blockedStyle : undefined}
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-zinc-900">{label}</span>
                    {!blocked ? (
                      <form action={addManualBlock}>
                        <input type="hidden" name="date" value={key} />
                        <button
                          type="submit"
                          className="rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-600 hover:border-zinc-300"
                        >
                          Block day
                        </button>
                      </form>
                    ) : null}
                  </div>
                  {blocked ? (
                    <div className="mt-3 rounded border border-dashed border-zinc-300 bg-white/80 px-3 py-2 text-xs">
                      <p className="font-semibold text-zinc-700">{blockedLabel}</p>
                      {defaultBlocked && !reason && !hasOpenOverride && (
                        <form action={addOpenOverride} className="mt-2">
                          <input type="hidden" name="date" value={key} />
                          <button
                            type="submit"
                            className="rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-600 hover:border-zinc-300"
                          >
                            Unblock
                          </button>
                        </form>
                      )}
                      {reason && isManualBlock(reason) && (
                        <form action={removeManualBlock} className="mt-2">
                          <input type="hidden" name="date" value={key} />
                          <button
                            type="submit"
                            className="rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-600 hover:border-zinc-300"
                          >
                            Unblock
                          </button>
                        </form>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 grid gap-2">
                      {Array.from({ length: slotsPerDay }, (_, idx) => {
                        const slotIndex = idx + 1;
                        const slotKey = `${key}:${slotIndex}`;
                        const assignment = assignmentBySlotKey.get(slotKey);
                        const order = assignment ? ordersById.get(assignment.order_id) : null;
                        const printTarget = order?.id ?? order?.order_number;
                        const title =
                          order?.title || (order ? formatOrderDescription(order) : "") || order?.order_number || "Order";
                        const canCompleteSlotOrder = order ? canCompleteOrderForSlotDate(order, key) : false;
                        const canUnassignSlotOrder = key >= todayKey;
                        return (
                          <div key={slotKey} className="rounded border border-dashed border-zinc-200 px-3 py-2 text-xs">
                            {assignment && order ? (
                              <div className={`mt-1 rounded-md border px-3 py-2 ${statusCard(getScheduleStatus(order, key, todayKey))}`}>
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Title</p>
                                    <p className="mt-0.5 text-base font-semibold leading-tight text-zinc-900">{title}</p>
                                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-700">
                                      <span>{weightLabel(order.total_weight_kg)}</span>
                                      <span>Due {formatDate(order.due_date)}</span>
                                      <span>{order.pickup ? "Pickup" : "Delivery"}</span>
                                    </div>
                                  </div>
                                  <div className="flex w-[9.5rem] shrink-0 flex-col items-stretch gap-1">
                                    {printTarget ? (
                                      <a
                                        href={`/admin/orders/${encodeURIComponent(printTarget)}/print?id=${encodeURIComponent(printTarget)}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="rounded border border-zinc-200 bg-white px-2 py-1 text-center text-[11px] font-semibold text-zinc-700 hover:border-zinc-300"
                                      >
                                        Print order
                                      </a>
                                    ) : null}
                                    {canCompleteSlotOrder ? (
                                      <form
                                        action={archiveOrder}
                                        onSubmit={(event) => {
                                          const confirmed = window.confirm(
                                            `Confirm ${order.pickup ? "collection" : "delivery"} for this order? It will move out of the production schedule.`
                                          );
                                          if (!confirmed) {
                                            event.preventDefault();
                                          }
                                        }}
                                      >
                                        <input type="hidden" name="order_id" value={order.id} />
                                        <button
                                          type="submit"
                                          className="w-full rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-center text-[11px] font-semibold text-emerald-700 hover:border-emerald-300"
                                        >
                                          {completionActionLabel(order)}
                                        </button>
                                      </form>
                                    ) : null}
                                    {canUnassignSlotOrder ? (
                                      <form action={deleteAssignment}>
                                        <input type="hidden" name="assignment_id" value={assignment.id} />
                                        <button
                                          type="submit"
                                          className="w-full rounded border border-rose-200 bg-rose-50 px-2 py-1 text-center text-[11px] font-semibold text-rose-700 hover:border-rose-300"
                                        >
                                          Unassign
                                        </button>
                                      </form>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-zinc-400">Empty</span>
                                <button
                                  type="button"
                                  disabled={key < todayKey}
                                  onClick={() => setSlotPicker({ date: key, slotIndex })}
                                  className={`rounded px-2 py-1 text-[11px] font-semibold ${
                                    key < todayKey
                                      ? "border border-zinc-200 bg-zinc-100 text-zinc-400"
                                      : "border border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800"
                                  }`}
                                >
                                  {key < todayKey ? "Past date" : "Assign"}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      {slotPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeSlotPicker}>
          <div
            className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-4 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-zinc-900">Select order</h4>
              <button
                type="button"
                onClick={closeSlotPicker}
                className="rounded border border-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-600 hover:border-zinc-300"
              >
                Close
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {unassignedOrders.length === 0 ? (
                <p className="text-xs text-zinc-500">No unassigned orders.</p>
              ) : (
                unassignedOrders.map((order) => {
                  const selectedSlotKey = `${slotPicker.date}:${slotPicker.slotIndex}`;
                  const selectedSlotId = slotIdByKey.get(selectedSlotKey) ?? "";
                  const orderWeightKg = Number(order.total_weight_kg);
                  const assignableKg =
                    Number.isFinite(orderWeightKg) && orderWeightKg > 0
                      ? orderWeightKg
                      : 0.01;

                  return (
                    <form key={order.id} action={assignOrderToSlot}>
                      <input type="hidden" name="order_id" value={order.id} />
                      <input type="hidden" name="slot_id" value={selectedSlotId} />
                      <input type="hidden" name="slot_date" value={slotPicker.date} />
                      <input type="hidden" name="slot_index" value={slotPicker.slotIndex} />
                      <input type="hidden" name="kg_assigned" value={assignableKg} />
                      <button
                        type="submit"
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left text-xs font-semibold text-zinc-800 hover:border-zinc-300"
                      >
                        {order.title ?? "Untitled"}
                      </button>
                    </form>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
