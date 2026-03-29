"use client";

import { useMemo, useState, useTransition } from "react";
import type { OrderRow, OrderSlot, ProductionBlock, ProductionSlot, SettingsRow } from "@/lib/data";
import { addManualBlock, archiveOrder, assignOrderToSlot } from "./actions";
import AssignmentCalendarModal from "./AssignmentCalendarModal";
import {
  buildAssignmentBySlotKey,
  buildSlotIdByKey,
  canCompleteOrderForSlotDate,
  completionActionLabel,
  dateKey,
  formatDate,
  formatMonthLabel,
  formatOrderDescription,
  getScheduleStatus,
  isScheduleDateBlocked,
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
  const [assignmentModalOrderId, setAssignmentModalOrderId] = useState<string | null>(null);
  const [draggingAssignmentId, setDraggingAssignmentId] = useState<string | null>(null);
  const [isDropPending, startDropTransition] = useTransition();

  const todayKey = dateKey(new Date());
  const ordersById = useMemo(() => new Map(orders.map((order) => [order.id, order])), [orders]);
  const slotMap = useMemo(() => new Map(slots.map((slot) => [slot.id, slot])), [slots]);
  const assignmentBySlotKey = useMemo(() => buildAssignmentBySlotKey(assignments, slots), [assignments, slots]);
  const slotIdByKey = useMemo(() => buildSlotIdByKey(slots), [slots]);
  const assignmentById = useMemo(() => new Map(assignments.map((assignment) => [assignment.id, assignment])), [assignments]);
  const assignmentByOrderId = useMemo(() => {
    const map = new Map<string, { assignment: OrderSlot; slot: ProductionSlot | null }>();
    assignments.forEach((assignment) => {
      if (map.has(assignment.order_id)) return;
      map.set(assignment.order_id, {
        assignment,
        slot: slotMap.get(assignment.slot_id) ?? null,
      });
    });
    return map;
  }, [assignments, slotMap]);

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const start = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startOffset = (start.getDay() + 6) % 7;
    const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
    return Array.from({ length: totalCells }, (_, idx) => new Date(year, month, idx - startOffset + 1));
  }, [calendarMonth]);
  const visibleCalendarDays = useMemo(
    () =>
      calendarDays.filter((day) => {
        if (day.getMonth() !== calendarMonth.getMonth()) return false;
        return !isScheduleDateBlocked(day, settings, blocks).blocked;
      }),
    [blocks, calendarDays, calendarMonth, settings],
  );

  const weekDays = useMemo(() => {
    const anchor = new Date(calendarMonth);
    anchor.setDate(anchor.getDate() - 1);
    return Array.from({ length: 14 }, (_, idx) => {
      const next = new Date(anchor);
      next.setDate(anchor.getDate() + idx);
      return next;
    });
  }, [calendarMonth]);
  const visibleWeekDays = useMemo(
    () => weekDays.filter((day) => !isScheduleDateBlocked(day, settings, blocks).blocked),
    [blocks, settings, weekDays],
  );

  const slotsPerDay = Math.max(1, Number(settings.production_slots_per_day) || 1);
  const assignmentModalOrder = useMemo(
    () => orders.find((order) => order.id === assignmentModalOrderId) ?? null,
    [assignmentModalOrderId, orders],
  );
  const assignmentModalAssignment = assignmentModalOrder
    ? assignmentByOrderId.get(assignmentModalOrder.id) ?? null
    : null;

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
  const closeAssignmentModal = () => setAssignmentModalOrderId(null);

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
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {visibleCalendarDays.length === 0 ? (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-500 sm:col-span-2 lg:col-span-5">
                No production days are visible for this month.
              </div>
            ) : (
              visibleCalendarDays.map((day) => {
                const key = dateKey(day);
                const isToday = dateKey(new Date()) === key;
                return (
                  <div
                    key={key}
                    className={`rounded-lg border bg-white px-2.5 py-2 ${isToday ? "border-slate-900 ring-2 ring-slate-900" : "border-zinc-200"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                          {day.toLocaleDateString(undefined, { weekday: "short" })}
                        </p>
                        <p className="text-sm font-semibold text-zinc-900">
                          {day.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                        </p>
                      </div>
                      <form action={addManualBlock}>
                        <input type="hidden" name="date" value={key} />
                        <button
                          type="submit"
                          className="rounded border border-zinc-200 bg-white px-2 py-1 text-[10px] font-semibold text-zinc-600 hover:border-zinc-300"
                        >
                          Block
                        </button>
                      </form>
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {Array.from({ length: slotsPerDay }, (_, idx) => {
                        const slotIndex = idx + 1;
                        const slotKey = `${key}:${slotIndex}`;
                        const assignment = assignmentBySlotKey.get(slotKey);
                        const order = assignment ? ordersById.get(assignment.order_id) : null;
                        const printTarget = order?.id ?? order?.order_number;
                        const title =
                          order?.title || (order ? formatOrderDescription(order) : "") || order?.order_number || "Order";
                        const canCompleteSlotOrder = order ? canCompleteOrderForSlotDate(order, key) : false;
                        const canReassignSlotOrder = key >= todayKey;
                        return (
                          <div
                            key={slotKey}
                            className={`rounded border border-dashed border-zinc-200 p-1 ${draggingAssignmentId && !assignment && !isDropPending ? "hover:border-blue-300 hover:bg-blue-50/40" : ""}`}
                            onDragOver={(event) => {
                              if (!draggingAssignmentId || assignment || key < todayKey || isDropPending) return;
                              event.preventDefault();
                            }}
                            onDrop={(event) => {
                              if (!draggingAssignmentId || assignment || key < todayKey || isDropPending) return;
                              event.preventDefault();
                              const draggedAssignment = assignmentById.get(draggingAssignmentId);
                              if (!draggedAssignment) return;
                              const draggedOrder = ordersById.get(draggedAssignment.order_id);
                              if (!draggedOrder) return;
                              startDropTransition(async () => {
                                const formData = new FormData();
                                formData.set("assignment_id", draggedAssignment.id);
                                formData.set("order_id", draggedOrder.id);
                                formData.set("slot_id", slotIdByKey.get(slotKey) ?? "");
                                formData.set("slot_date", key);
                                formData.set("slot_index", String(slotIndex));
                                formData.set(
                                  "kg_assigned",
                                  String(
                                    Number.isFinite(Number(draggedOrder.total_weight_kg)) && Number(draggedOrder.total_weight_kg) > 0
                                      ? Number(draggedOrder.total_weight_kg)
                                      : 0.01,
                                  ),
                                );
                                setDraggingAssignmentId(null);
                                await assignOrderToSlot(formData);
                              });
                            }}
                          >
                            {assignment && order ? (
                              <div
                                draggable={canReassignSlotOrder}
                                onDragStart={() => setDraggingAssignmentId(assignment.id)}
                                onDragEnd={() => setDraggingAssignmentId(null)}
                                className={`rounded-md border px-2 py-1.5 text-[10px] ${statusCard(
                                  getScheduleStatus(order, key, todayKey),
                                )}`}
                              >
                                <div className="min-w-0">
                                  <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Title</p>
                                  <p className="mt-0.5 break-words text-[13px] font-semibold leading-tight text-zinc-900">{title}</p>
                                  <div className="mt-1 space-y-0 text-[9px] text-zinc-700">
                                    <p>{weightLabel(order.total_weight_kg)}</p>
                                    <p>Due {formatDate(order.due_date)}</p>
                                  </div>
                                </div>
                                <div className="mt-1.5 flex flex-col items-stretch gap-1">
                                  {printTarget ? (
                                    <a
                                      href={`/admin/orders/${encodeURIComponent(printTarget)}/print?id=${encodeURIComponent(printTarget)}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="rounded border border-zinc-200 bg-white px-2 py-1 text-center text-[9px] font-semibold text-zinc-700 hover:border-zinc-300"
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
                                        className="w-full rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-center text-[9px] font-semibold text-emerald-700 hover:border-emerald-300"
                                      >
                                        {completionActionLabel(order)}
                                      </button>
                                    </form>
                                  ) : null}
                                  {canReassignSlotOrder ? (
                                    <button
                                      type="button"
                                      onClick={() => setAssignmentModalOrderId(order.id)}
                                      className="w-full rounded border border-blue-200 bg-blue-50 px-2 py-1 text-center text-[9px] font-semibold text-blue-700 hover:border-blue-300"
                                    >
                                      Change assignment
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-2 rounded px-1 py-0.5">
                                <span className="text-[9px] font-medium text-zinc-400">Empty</span>
                                <button
                                  type="button"
                                  disabled={key < todayKey}
                                  onClick={() => setSlotPicker({ date: key, slotIndex })}
                                  className={`rounded px-2 py-1 text-[9px] font-semibold ${
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
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {visibleWeekDays.length === 0 ? (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-500">
                No production days are visible in this range.
              </div>
            ) : (
              visibleWeekDays.map((day) => {
                const key = dateKey(day);
                const isToday = dateKey(new Date()) === key;
                const label = day.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
                return (
                  <div
                    key={key}
                    className={`rounded-lg border px-3 py-3 ${isToday ? "border-slate-900 ring-2 ring-slate-900" : "border-zinc-200 bg-white"}`}
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-zinc-900">{label}</span>
                      <form action={addManualBlock}>
                        <input type="hidden" name="date" value={key} />
                        <button
                          type="submit"
                          className="rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-600 hover:border-zinc-300"
                        >
                          Block day
                        </button>
                      </form>
                    </div>
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
                        const canReassignSlotOrder = key >= todayKey;
                        return (
                          <div
                            key={slotKey}
                            className={`rounded border border-dashed border-zinc-200 px-3 py-2 text-xs ${draggingAssignmentId && !assignment && !isDropPending ? "hover:border-blue-300 hover:bg-blue-50/40" : ""}`}
                            onDragOver={(event) => {
                              if (!draggingAssignmentId || assignment || key < todayKey || isDropPending) return;
                              event.preventDefault();
                            }}
                            onDrop={(event) => {
                              if (!draggingAssignmentId || assignment || key < todayKey || isDropPending) return;
                              event.preventDefault();
                              const draggedAssignment = assignmentById.get(draggingAssignmentId);
                              if (!draggedAssignment) return;
                              const draggedOrder = ordersById.get(draggedAssignment.order_id);
                              if (!draggedOrder) return;
                              startDropTransition(async () => {
                                const formData = new FormData();
                                formData.set("assignment_id", draggedAssignment.id);
                                formData.set("order_id", draggedOrder.id);
                                formData.set("slot_id", slotIdByKey.get(slotKey) ?? "");
                                formData.set("slot_date", key);
                                formData.set("slot_index", String(slotIndex));
                                formData.set(
                                  "kg_assigned",
                                  String(
                                    Number.isFinite(Number(draggedOrder.total_weight_kg)) && Number(draggedOrder.total_weight_kg) > 0
                                      ? Number(draggedOrder.total_weight_kg)
                                      : 0.01,
                                  ),
                                );
                                setDraggingAssignmentId(null);
                                await assignOrderToSlot(formData);
                              });
                            }}
                          >
                            {assignment && order ? (
                              <div
                                draggable={canReassignSlotOrder}
                                onDragStart={() => setDraggingAssignmentId(assignment.id)}
                                onDragEnd={() => setDraggingAssignmentId(null)}
                                className={`mt-1 rounded-md border px-3 py-2 ${statusCard(getScheduleStatus(order, key, todayKey))}`}
                              >
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
                                    {canReassignSlotOrder ? (
                                      <button
                                        type="button"
                                        onClick={() => setAssignmentModalOrderId(order.id)}
                                        className="w-full rounded border border-blue-200 bg-blue-50 px-2 py-1 text-center text-[11px] font-semibold text-blue-700 hover:border-blue-300"
                                      >
                                        Change assignment
                                      </button>
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
                  </div>
                );
              })
            )}
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
      {assignmentModalOrder ? (
        <AssignmentCalendarModal
          order={assignmentModalOrder}
          assignment={assignmentModalAssignment}
          assignments={assignments}
          slots={slots}
          blocks={blocks}
          settings={settings}
          onClose={closeAssignmentModal}
        />
      ) : null}
    </>
  );
}
