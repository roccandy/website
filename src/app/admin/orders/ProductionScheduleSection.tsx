"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OrderRow, OrderSlot, ProductionDayNote, ProductionSlot, SettingsRow } from "@/lib/data";
import { archiveOrderInline, assignOrderToSlot, upsertProductionDayNote } from "./actions";
import AssignmentCalendarModal from "./AssignmentCalendarModal";
import OrderTitleWithLogo from "./OrderTitleWithLogo";
import SplitAwareActionForm from "./SplitAwareActionForm";
import {
  buildAssignmentBySlotKey,
  buildSlotIdByKey,
  canCompleteOrderForSlotDate,
  dateKey,
  formatDayMonthLabel,
  formatDate,
  formatDueDateDistance,
  formatMonthLabel,
  formatOrderDescription,
  formatWeekdayDayMonthLabel,
  formatWeekdayShortLabel,
  getScheduleStatus,
  getPremadeSiblingMeta,
  isScheduleDateBlocked,
  productionCompletionActionLabel,
  statusCard,
  weightLabel,
} from "./productionScheduleShared";

type Props = {
  orders: OrderRow[];
  slots: ProductionSlot[];
  assignments: OrderSlot[];
  settings: SettingsRow;
  unassignedOrders: OrderRow[];
  dayNotes: ProductionDayNote[];
};

const isCompletedProductionOrder = (order: Pick<OrderRow, "status">) =>
  order.status === "archived" || order.status === "shipped";

export default function ProductionScheduleSection({
  orders,
  slots,
  assignments,
  settings,
  unassignedOrders,
  dayNotes,
}: Props) {
  const router = useRouter();
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<"calendar" | "week">("calendar");
  const [slotPicker, setSlotPicker] = useState<{ date: string; slotIndex: number } | null>(null);
  const [assignmentModalOrderId, setAssignmentModalOrderId] = useState<string | null>(null);
  const [draggingAssignmentId, setDraggingAssignmentId] = useState<string | null>(null);
  const [hoveredDropSlotKey, setHoveredDropSlotKey] = useState<string | null>(null);
  const [isDropPending, startDropTransition] = useTransition();
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savingNoteDate, setSavingNoteDate] = useState<string | null>(null);
  const [isNotePending, startNoteTransition] = useTransition();
  const [expandedCompletedCalendarAssignments, setExpandedCompletedCalendarAssignments] = useState<Set<string>>(
    () => new Set(),
  );

  const todayKey = dateKey(new Date());
  const ordersById = useMemo(() => new Map(orders.map((order) => [order.id, order])), [orders]);
  const slotMap = useMemo(() => new Map(slots.map((slot) => [slot.id, slot])), [slots]);
  const assignmentBySlotKey = useMemo(() => buildAssignmentBySlotKey(assignments, slots), [assignments, slots]);
  const slotIdByKey = useMemo(() => buildSlotIdByKey(slots), [slots]);
  const assignmentById = useMemo(() => new Map(assignments.map((assignment) => [assignment.id, assignment])), [assignments]);
  const dayNoteByDate = useMemo(() => new Map(dayNotes.map((note) => [note.note_date, note])), [dayNotes]);
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
        return !isScheduleDateBlocked(day, settings).blocked;
      }),
    [calendarDays, calendarMonth, settings],
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
    () => weekDays.filter((day) => !isScheduleDateBlocked(day, settings).blocked),
    [settings, weekDays],
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
  const emitToast = (tone: "success" | "error", message: string) => {
    window.dispatchEvent(new CustomEvent("toast", { detail: { tone, message } }));
  };
  const refreshAfterAssignment = () => {
    setHoveredDropSlotKey(null);
    router.refresh();
  };
  const runAssignmentAction = async (formData: FormData) => {
    formData.set("response_mode", "inline");
    const result = await assignOrderToSlot(formData);
    if (result?.message) {
      emitToast(result.tone, result.message);
    }
    if (result?.ok) {
      refreshAfterAssignment();
    }
  };
  const toggleCompletedCalendarAssignment = (assignmentId: string) => {
    setExpandedCompletedCalendarAssignments((current) => {
      const next = new Set(current);
      if (next.has(assignmentId)) {
        next.delete(assignmentId);
      } else {
        next.add(assignmentId);
      }
      return next;
    });
  };
  const submitDayNote = (noteDate: string, note: string) => {
    setSavingNoteDate(noteDate);
    startNoteTransition(async () => {
      const formData = new FormData();
      formData.set("note_date", noteDate);
      formData.set("note", note);
      const result = await upsertProductionDayNote(formData);
      if (result?.message) {
        emitToast(result.tone, result.message);
      }
      if (result?.ok) {
        setNoteDrafts((current) => {
          const next = { ...current };
          delete next[noteDate];
          return next;
        });
        router.refresh();
      }
      setSavingNoteDate(null);
    });
  };
  const renderDayNoteForm = (noteDate: string, compact = false) => {
    const savedNote = dayNoteByDate.get(noteDate)?.note ?? "";
    const draft = noteDrafts[noteDate] ?? savedNote;
    const isSaving = isNotePending && savingNoteDate === noteDate;

    return (
      <form
        className={`border-t border-zinc-100 ${compact ? "mt-1.5 pt-1.5" : "mt-2 pt-2"}`}
        onSubmit={(event) => {
          event.preventDefault();
          submitDayNote(noteDate, draft);
        }}
      >
        <div className="flex items-center gap-1.5">
          <label className="sr-only" htmlFor={`production-note-${noteDate}`}>
            Notes
          </label>
          <input
            id={`production-note-${noteDate}`}
            value={draft}
            onChange={(event) => setNoteDrafts((current) => ({ ...current, [noteDate]: event.target.value }))}
            placeholder="Notes"
            className={`min-w-0 flex-1 rounded border border-zinc-200 bg-white px-2 text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none ${
              compact ? "h-7 text-[10px]" : "h-8 text-xs"
            }`}
          />
          <button
            type="submit"
            disabled={isSaving || draft === savedNote}
            aria-label={isSaving ? "Saving note" : "Save note"}
            className={`inline-flex shrink-0 items-center justify-center rounded border border-zinc-200 bg-zinc-50 font-semibold text-zinc-700 hover:border-zinc-300 disabled:cursor-not-allowed disabled:opacity-50 ${
              compact ? "h-7 px-2 text-[9px]" : "h-8 px-2.5 text-[11px]"
            }`}
          >
            {isSaving ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700" />
            ) : (
              "Save"
            )}
          </button>
        </div>
      </form>
    );
  };

  return (
    <>
      <div id="production-calendar" className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="admin-card-title text-zinc-900">Production Calendar</h3>
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
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                          {formatWeekdayShortLabel(day)}
                        </p>
                        <p className="text-sm font-semibold text-zinc-900">
                          {formatDayMonthLabel(day)}
                        </p>
                      </div>
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
                        const dueDateDistance = order ? formatDueDateDistance(order.due_date) : "";
                        const canCompleteSlotOrder = order ? canCompleteOrderForSlotDate(order, key) : false;
                        const premadeSiblingMeta = order ? getPremadeSiblingMeta(orders, order) : null;
                        const canDragSlotOrder = key >= todayKey;
                        const isCompletedCalendarOrder = order ? isCompletedProductionOrder(order) : false;
                        const isCollapsedCompletedCalendarOrder =
                          Boolean(assignment) &&
                          isCompletedCalendarOrder &&
                          !expandedCompletedCalendarAssignments.has(assignment?.id ?? "");
                        return (
                          <div
                            key={slotKey}
                            className={`rounded border border-dashed p-1 ${
                              hoveredDropSlotKey === slotKey
                                ? "border-blue-500 ring-2 ring-blue-200"
                                : "border-zinc-200"
                            } ${draggingAssignmentId && !assignment && !isDropPending ? "hover:border-blue-300 hover:bg-blue-50/40" : ""}`}
                            onDragOver={(event) => {
                              if (!draggingAssignmentId || assignment || key < todayKey || isDropPending) return;
                              event.preventDefault();
                              if (hoveredDropSlotKey !== slotKey) setHoveredDropSlotKey(slotKey);
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
                                await runAssignmentAction(formData);
                              });
                            }}
                          >
                            {assignment && order ? (
                              <div
                                draggable={canDragSlotOrder && !isCompletedCalendarOrder}
                                onDragStart={() => {
                                  setDraggingAssignmentId(assignment.id);
                                  setHoveredDropSlotKey(null);
                                }}
                                onDragEnd={() => {
                                  setDraggingAssignmentId(null);
                                  setHoveredDropSlotKey(null);
                                }}
                                className={`rounded-md border px-2 py-1.5 text-[10px] ${statusCard(
                                  getScheduleStatus(order, key, todayKey),
                                )}`}
                              >
                                {isCollapsedCompletedCalendarOrder ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleCompletedCalendarAssignment(assignment.id)}
                                    className="block w-full truncate whitespace-nowrap text-left text-[13px] font-semibold leading-tight text-zinc-900"
                                    aria-expanded="false"
                                    title={title}
                                  >
                                    <OrderTitleWithLogo
                                      order={order}
                                      title={title}
                                      className="block max-w-full truncate whitespace-nowrap"
                                      logoClassName="h-4 w-4"
                                      imageClassName="h-5 w-5"
                                    />
                                  </button>
                                ) : (
                                  <div className="space-y-1.5">
                                    {isCompletedCalendarOrder ? (
                                      <button
                                        type="button"
                                        onClick={() => toggleCompletedCalendarAssignment(assignment.id)}
                                        className="block w-full truncate whitespace-nowrap text-left text-[13px] font-semibold leading-tight text-zinc-900"
                                        aria-expanded="true"
                                        title={title}
                                      >
                                        <OrderTitleWithLogo
                                          order={order}
                                          title={title}
                                          className="block max-w-full truncate whitespace-nowrap"
                                          logoClassName="h-4 w-4"
                                          imageClassName="h-5 w-5"
                                        />
                                      </button>
                                    ) : (
                                      <p
                                        className="truncate whitespace-nowrap text-[13px] font-semibold leading-tight text-zinc-900"
                                        title={title}
                                      >
                                        <OrderTitleWithLogo
                                          order={order}
                                          title={title}
                                          className="block max-w-full truncate whitespace-nowrap"
                                          logoClassName="h-4 w-4"
                                          imageClassName="h-5 w-5"
                                        />
                                      </p>
                                    )}
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0 flex-1 space-y-0 text-[9px] text-zinc-700">
                                        <p>{weightLabel(order.total_weight_kg)}</p>
                                        <p className="flex flex-wrap gap-x-1">
                                          <span className="whitespace-nowrap">{formatDate(order.due_date)}</span>
                                          {dueDateDistance ? (
                                            <span className="whitespace-nowrap text-zinc-400">{dueDateDistance}</span>
                                          ) : null}
                                        </p>
                                      </div>
                                      <div className="flex w-[5.4rem] shrink-0 flex-col items-stretch gap-1">
                                        {printTarget ? (
                                          <a
                                            href={`/admin/orders/${encodeURIComponent(printTarget)}/print?id=${encodeURIComponent(printTarget)}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="rounded border border-zinc-200 bg-white px-2 py-1 text-center text-[8px] font-semibold text-zinc-700 hover:border-zinc-300"
                                          >
                                            Print
                                          </a>
                                        ) : null}
                                        {canCompleteSlotOrder ? (
                                          <SplitAwareActionForm
                                            action={archiveOrderInline}
                                            hiddenFields={[{ name: "order_id", value: order.id }]}
                                            buttonLabel={productionCompletionActionLabel(order)}
                                            buttonClassName="w-full rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-center text-[8px] font-semibold text-emerald-700 hover:border-emerald-300"
                                            confirmMessage={`Confirm ${order.pickup ? "collection" : "delivery"} for this order? It will move out of the production schedule.`}
                                            companionMeta={premadeSiblingMeta}
                                          />
                                        ) : (
                                          <button
                                            type="button"
                                            disabled
                                            className="w-full cursor-not-allowed rounded border border-zinc-200 bg-zinc-100 px-2 py-1 text-center text-[8px] font-semibold text-zinc-400"
                                          >
                                            {productionCompletionActionLabel(order)}
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => setAssignmentModalOrderId(order.id)}
                                          className="w-full rounded border border-blue-200 bg-blue-50 px-2 py-1 text-center text-[8px] font-semibold text-blue-700 hover:border-blue-300"
                                        >
                                          Change
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-2 rounded px-1 py-0.5">
                                <span className="text-[9px] font-medium text-zinc-400">Empty</span>
                                <button
                                  type="button"
                                  onClick={() => setSlotPicker({ date: key, slotIndex })}
                                  className={`rounded px-2 py-1 text-[9px] font-semibold ${
                                    key < todayKey
                                      ? "border border-zinc-200 bg-zinc-100 text-zinc-400 hover:border-zinc-300"
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
                    {renderDayNoteForm(key, true)}
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
                const label = formatWeekdayDayMonthLabel(day);
                return (
                  <div
                    key={key}
                    className={`rounded-lg border px-3 py-3 ${isToday ? "border-slate-900 ring-2 ring-slate-900" : "border-zinc-200 bg-white"}`}
                  >
                    <div className="flex items-center text-sm">
                      <span className="font-semibold text-zinc-900">{label}</span>
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
                        const dueDateDistance = order ? formatDueDateDistance(order.due_date) : "";
                        const canCompleteSlotOrder = order ? canCompleteOrderForSlotDate(order, key) : false;
                        const premadeSiblingMeta = order ? getPremadeSiblingMeta(orders, order) : null;
                        const canDragSlotOrder = key >= todayKey;
                        return (
                          <div
                            key={slotKey}
                            className={`rounded border border-dashed px-3 py-2 text-xs ${
                              hoveredDropSlotKey === slotKey
                                ? "border-blue-500 ring-2 ring-blue-200"
                                : "border-zinc-200"
                            } ${draggingAssignmentId && !assignment && !isDropPending ? "hover:border-blue-300 hover:bg-blue-50/40" : ""}`}
                            onDragOver={(event) => {
                              if (!draggingAssignmentId || assignment || key < todayKey || isDropPending) return;
                              event.preventDefault();
                              if (hoveredDropSlotKey !== slotKey) setHoveredDropSlotKey(slotKey);
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
                                await runAssignmentAction(formData);
                              });
                            }}
                          >
                            {assignment && order ? (
                              <div
                                draggable={canDragSlotOrder}
                                onDragStart={() => {
                                  setDraggingAssignmentId(assignment.id);
                                  setHoveredDropSlotKey(null);
                                }}
                                onDragEnd={() => {
                                  setDraggingAssignmentId(null);
                                  setHoveredDropSlotKey(null);
                                }}
                                className={`mt-1 rounded-md border px-3 py-2 ${statusCard(getScheduleStatus(order, key, todayKey))}`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-base font-semibold leading-tight text-zinc-900">
                                      <OrderTitleWithLogo order={order} title={title} />
                                    </p>
                                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-700">
                                      <span>{weightLabel(order.total_weight_kg)}</span>
                                      <span className="flex flex-wrap gap-x-1">
                                        <span className="whitespace-nowrap">Due {formatDate(order.due_date)}</span>
                                        {dueDateDistance ? (
                                          <span className="whitespace-nowrap text-zinc-400">{dueDateDistance}</span>
                                        ) : null}
                                      </span>
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
                                      <SplitAwareActionForm
                                        action={archiveOrderInline}
                                        hiddenFields={[{ name: "order_id", value: order.id }]}
                                        buttonLabel={productionCompletionActionLabel(order)}
                                        buttonClassName="w-full rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-center text-[11px] font-semibold text-emerald-700 hover:border-emerald-300"
                                        confirmMessage={`Confirm ${order.pickup ? "collection" : "delivery"} for this order? It will move out of the production schedule.`}
                                        companionMeta={premadeSiblingMeta}
                                      />
                                    ) : (
                                      <button
                                        type="button"
                                        disabled
                                        className="w-full cursor-not-allowed rounded border border-zinc-200 bg-zinc-100 px-2 py-1 text-center text-[11px] font-semibold text-zinc-400"
                                      >
                                        {productionCompletionActionLabel(order)}
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => setAssignmentModalOrderId(order.id)}
                                      className="w-full rounded border border-blue-200 bg-blue-50 px-2 py-1 text-center text-[11px] font-semibold text-blue-700 hover:border-blue-300"
                                    >
                                      Change
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-zinc-400">Empty</span>
                                <button
                                  type="button"
                                  onClick={() => setSlotPicker({ date: key, slotIndex })}
                                  className={`rounded px-2 py-1 text-[11px] font-semibold ${
                                    key < todayKey
                                      ? "border border-zinc-200 bg-zinc-100 text-zinc-400 hover:border-zinc-300"
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
                    {renderDayNoteForm(key)}
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
              <h4 className="admin-card-title text-zinc-900">Select order</h4>
              <button
                type="button"
                onClick={closeSlotPicker}
                className="rounded border border-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-600 hover:border-zinc-300"
              >
                Close
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {slotPicker.date < todayKey ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  This day is in the past. Only assign here if you are backfilling production history.
                </p>
              ) : null}
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
                    <div key={order.id}>
                      <button
                        type="button"
                        onClick={() => {
                          if (slotPicker.date < todayKey) {
                            const confirmed = window.confirm(
                              "This date is in the past. Assigning an order to a past production day should only be used for backfilling. Continue?",
                            );
                            if (!confirmed) return;
                          }
                          startDropTransition(async () => {
                            const formData = new FormData();
                            formData.set("order_id", order.id);
                            formData.set("slot_id", selectedSlotId);
                            formData.set("slot_date", slotPicker.date);
                            formData.set("slot_index", String(slotPicker.slotIndex));
                            formData.set("kg_assigned", String(assignableKg));
                            closeSlotPicker();
                            await runAssignmentAction(formData);
                          });
                        }}
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left text-xs font-semibold text-zinc-800 hover:border-zinc-300"
                      >
                        <OrderTitleWithLogo
                          order={order}
                          title={order.title ?? "Untitled"}
                          logoClassName="h-4 w-4"
                          imageClassName="h-5 w-5"
                        />
                      </button>
                    </div>
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
          allOrders={orders}
          assignment={assignmentModalAssignment}
          assignments={assignments}
          slots={slots}
          settings={settings}
          onClose={closeAssignmentModal}
        />
      ) : null}
    </>
  );
}
