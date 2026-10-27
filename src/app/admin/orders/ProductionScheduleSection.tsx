"use client";

import { AdminSubmitButton } from "@/components/AdminSubmitButton";
import { useMemo, useState, useTransition, type DragEvent } from "react";
import { ArrowRight } from "lucide-react";
import { orderDropPlan, PRODUCTION_ORDER_DRAG_TYPE } from "./productionDrag";
import { useRouter } from "next/navigation";
import { useAdminViewState } from "../useAdminViewState";
import { AdminModalPortal } from "../AdminModalPortal";
import type { OrderRow, OrderSlot, ProductionDayNote, ProductionSlot, SettingsRow } from "@/lib/data";
import { isAdminPremadeOrder } from "@/lib/adminPremadeOrder";
import { archiveOrderInline, assignOrderToSlot, shiftProductionSchedule, upsertProductionDayNote } from "./actions";
import AssignmentCalendarModal from "./AssignmentCalendarModal";
import OrderTitleWithLogo from "./OrderTitleWithLogo";
import SplitAwareActionForm from "./SplitAwareActionForm";
import {
  buildAssignmentBySlotKey,
  buildSlotIdByKey,
  batchWeightsForOrder,
  canCompleteOrderForSlotDates,
  dateKey,
  formatDayMonthLabel,
  formatDate,
  formatDueDateDistance,
  formatOrderDescription,
  formatWeekdayDayMonthLabel,
  formatWeekdayShortLabel,
  getMultiAssignmentScheduleStatus,
  getPremadeSiblingMeta,
  isScheduleDateBlocked,
  nextAssignableKgForOrder,
  productionCompletionActionLabel,
  productionDueLeadFromSlot,
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
  canWrite: boolean;
  draggingOrderId: string | null;
  onOrderDragEnd: () => void;
};

const isCompletedProductionOrder = (order: Pick<OrderRow, "status">) =>
  order.status === "archived" || order.status === "shipped";

const WORKWEEK_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;

const startOfWorkweek = (date: Date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
};

const calendarWeightLabel = (kg: number | null | undefined) => {
  if (!Number.isFinite(kg ?? NaN)) return "";
  return `${Number(kg).toFixed(2)} kg`;
};

const productionScheduleTitle = (order: OrderRow | null | undefined) => {
  if (!order) return "Order";
  const title = order.title || formatOrderDescription(order) || order.order_number || "Order";
  return isAdminPremadeOrder(order) ? title.replace(/^premade stock\s*-\s*/i, "").trim() || title : title;
};

export default function ProductionScheduleSection({
  orders,
  slots,
  assignments,
  settings,
  unassignedOrders,
  dayNotes,
  canWrite,
  draggingOrderId,
  onOrderDragEnd,
}: Props) {
  const router = useRouter();
  const [calendarStart, setCalendarStart] = useAdminViewState("production-week", dateKey(startOfWorkweek(new Date())), (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(`${value}T00:00:00`).getTime()));
  const calendarMonth = useMemo(() => new Date(`${calendarStart}T00:00:00`), [calendarStart]);
  const viewMode = "calendar";
  const [slotPicker, setSlotPicker] = useState<{ date: string; slotIndex: number } | null>(null);
  const [assignmentModalTarget, setAssignmentModalTarget] = useState<{
    orderId: string;
    assignmentId?: string;
  } | null>(null);
  const [draggingAssignmentId, setDraggingAssignmentId] = useState<string | null>(null);
  const [hoveredDropSlotKey, setHoveredDropSlotKey] = useState<string | null>(null);
  const [isDropPending, startDropTransition] = useTransition();
  const [isScheduleShiftPending, startScheduleShiftTransition] = useTransition();
  const [dropChoice, setDropChoice] = useState<{ orderId: string; date: string; slotIndex: number; assignments: OrderSlot[] } | null>(null);
  const [scheduleShift, setScheduleShift] = useState<{ date: string; days: string } | null>(null);
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
  const assignmentsByOrderId = useMemo(() => {
    const map = new Map<string, OrderSlot[]>();
    assignments.forEach((assignment) => {
      const list = map.get(assignment.order_id) ?? [];
      list.push(assignment);
      map.set(assignment.order_id, list);
    });
    return map;
  }, [assignments]);
  const assignedSlotDatesByOrderId = useMemo(() => {
    const map = new Map<string, string[]>();
    assignments.forEach((assignment) => {
      const slotDate = slotMap.get(assignment.slot_id)?.slot_date;
      if (!slotDate) return;
      const list = map.get(assignment.order_id) ?? [];
      list.push(slotDate);
      map.set(assignment.order_id, list);
    });
    return map;
  }, [assignments, slotMap]);

  const calendarCells = useMemo(
    () =>
      Array.from({ length: 25 }, (_, index) => {
        const day = new Date(calendarMonth);
        day.setDate(day.getDate() + Math.floor(index / 5) * 7 + (index % 5));
        return isScheduleDateBlocked(day, settings).blocked ? null : day;
      }),
    [calendarMonth, settings],
  );
  const hasVisibleCalendarDays = calendarCells.some(Boolean);
  const calendarEndDate = useMemo(() => {
    const end = new Date(calendarMonth);
    end.setDate(end.getDate() + 32);
    return end;
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
  const visibleWeekDays = useMemo(
    () => weekDays.filter((day) => !isScheduleDateBlocked(day, settings).blocked),
    [settings, weekDays],
  );

  const slotsPerDay = Math.max(1, Number(settings.production_slots_per_day) || 1);
  const assignmentModalOrder = useMemo(
    () => orders.find((order) => order.id === assignmentModalTarget?.orderId) ?? null,
    [assignmentModalTarget?.orderId, orders],
  );
  const assignmentModalAssignment = assignmentModalOrder
    ? assignmentModalTarget?.assignmentId
      ? (() => {
          const assignment = assignmentById.get(assignmentModalTarget.assignmentId);
          if (!assignment) return null;
          return { assignment, slot: slotMap.get(assignment.slot_id) ?? null };
        })()
      : assignmentByOrderId.get(assignmentModalOrder.id) ?? null
    : null;
  const assignableSlotOrders = useMemo(
    () =>
      unassignedOrders
        .map((order) => {
          const orderAssignments = assignmentsByOrderId.get(order.id) ?? [];
          const assignableKg = nextAssignableKgForOrder(order, orderAssignments);
          if (!Number.isFinite(assignableKg) || assignableKg <= 0) return null;
          return {
            order,
            assignableKg,
            assignedCount: orderAssignments.length,
            plannedBatchCount: batchWeightsForOrder(order).length,
          };
        })
        .filter(
          (
            entry,
          ): entry is {
            order: OrderRow;
            assignableKg: number;
            assignedCount: number;
            plannedBatchCount: number;
          } => Boolean(entry),
        ),
    [assignmentsByOrderId, unassignedOrders],
  );

  const movePrev = () => {
    const next = new Date(calendarMonth);
    next.setDate(calendarMonth.getDate() - 7);
    setCalendarStart(dateKey(next));
  };

  const moveNext = () => {
    const next = new Date(calendarMonth);
    next.setDate(calendarMonth.getDate() + 7);
    setCalendarStart(dateKey(next));
  };

  const closeSlotPicker = () => setSlotPicker(null);
  const closeAssignmentModal = () => setAssignmentModalTarget(null);
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
  const commitDrop = (orderId: string, date: string, slotIndex: number, kg: number, assignmentId?: string) => {
    setDraggingAssignmentId(null);
    setHoveredDropSlotKey(null);
    onOrderDragEnd();
    startDropTransition(async () => {
      const formData = new FormData();
      formData.set("order_id", orderId);
      formData.set("slot_date", date);
      formData.set("slot_index", String(slotIndex));
      formData.set("slot_id", slotIdByKey.get(`${date}:${slotIndex}`) ?? "");
      formData.set("kg_assigned", String(kg));
      if (assignmentId) formData.set("assignment_id", assignmentId);
      try { await runAssignmentAction(formData); } catch { emitToast("error", "Unable to update the schedule. No success was confirmed; refresh and check the slot before retrying."); }
    });
  };
  const submitScheduleShift = () => {
    if (!scheduleShift) return;
    const { date, days } = scheduleShift;
    startScheduleShiftTransition(async () => {
      const formData = new FormData();
      formData.set("start_date", date);
      formData.set("days", days);
      formData.set("response_mode", "inline");
      try {
        const result = await shiftProductionSchedule(formData);
        if (result?.message) emitToast(result.tone, result.message);
        if (result?.ok) {
          setScheduleShift(null);
          router.refresh();
        }
      } catch {
        emitToast("error", "Unable to move the production schedule. No change was confirmed; refresh and check before retrying.");
      }
    });
  };
  const handleSlotDrop = (event: DragEvent<HTMLDivElement>, date: string, slotIndex: number, occupied: boolean) => {
    event.preventDefault();
    if (!canWrite || occupied || date < todayKey || isDropPending) return;
    const orderId = draggingOrderId || event.dataTransfer.getData(PRODUCTION_ORDER_DRAG_TYPE);
    if (orderId) {
      const order = ordersById.get(orderId);
      const plan = order && orderDropPlan(order, assignments, slots, todayKey);
      onOrderDragEnd();
      setHoveredDropSlotKey(null);
      if (!plan) { emitToast("error", "This order has no movable production batch. Open the order to review its status."); return; }
      if (plan.kind === "assign") commitDrop(orderId, date, slotIndex, plan.kg);
      else if (plan.kind === "move") commitDrop(orderId, date, slotIndex, Number(plan.assignment.kg_assigned), plan.assignment.id);
      else setDropChoice({ orderId, date, slotIndex, assignments: plan.assignments });
      return;
    }
    const assignment = draggingAssignmentId && assignmentById.get(draggingAssignmentId);
    if (assignment) commitDrop(assignment.order_id, date, slotIndex, Number(assignment.kg_assigned), assignment.id);
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
          <AdminSubmitButton
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
          </AdminSubmitButton>
        </div>
      </form>
    );
  };

  return (
    <>
      <div id="production-calendar" aria-busy={isDropPending} className="admin-production-calendar min-w-0 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm sm:p-4">
        {isDropPending && <p role="status" className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Updating production slot…</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="admin-card-title text-zinc-900">Production Calendar</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={movePrev}
              className="rounded border border-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
            >
              Prev week
            </button>
            <span className="text-sm font-semibold text-zinc-800">
              {formatDayMonthLabel(calendarMonth)} – {formatDayMonthLabel(calendarEndDate)}
            </span>
            <button
              type="button"
              onClick={moveNext}
              className="rounded border border-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
            >
              Next week
            </button>
          </div>
        </div>
        {viewMode === "calendar" ? (
          <>
            <div className="admin-calendar-weekdays mt-3 gap-2">
              {WORKWEEK_LABELS.map((label) => (
                <div
                  key={label}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500"
                >
                  {label}
                </div>
              ))}
            </div>
            <div className="admin-calendar-days mt-2 grid gap-2">
              {!hasVisibleCalendarDays ? (
                <div className="col-span-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-500">
                  No production days are visible in this five-week range.
                </div>
              ) : (
                calendarCells.map((day, cellIndex) => {
                  if (!day) {
                    return (
                      <div
                        key={`empty-${cellIndex}`}
                        aria-hidden="true"
                        className="admin-calendar-empty min-h-[10rem] rounded-lg border border-transparent"
                      />
                    );
                  }
                  const key = dateKey(day);
                  const isToday = dateKey(new Date()) === key;
                  return (
                    <div
                      key={key}
                      className={`min-w-0 rounded-lg border bg-white px-2.5 py-2 ${isToday ? "border-slate-900 ring-2 ring-slate-900" : "border-zinc-200"}`}
                    >
                    <div className="flex items-start gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                          {formatWeekdayShortLabel(day)}
                        </p>
                        <p className="text-sm font-semibold text-zinc-900">
                          {formatDayMonthLabel(day)}
                        </p>
                      </div>
                      {canWrite ? (
                        <button
                          type="button"
                          onClick={() => setScheduleShift({ date: key, days: "1" })}
                          className="ml-auto inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400 hover:text-zinc-900"
                          aria-label={`Move all scheduled orders from ${formatDayMonthLabel(day)} forward`}
                          title="Move all scheduled orders from this date forward"
                        >
                          <ArrowRight size={13} aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {Array.from({ length: slotsPerDay }, (_, idx) => {
                        const slotIndex = idx + 1;
                        const slotKey = `${key}:${slotIndex}`;
                        const assignment = assignmentBySlotKey.get(slotKey);
                        const order = assignment ? ordersById.get(assignment.order_id) : null;
                        const title = productionScheduleTitle(order);
                        const stateLabel = order?.pickup ? "Pickup" : order?.state?.trim();
                        const dueLead = order
                          ? productionDueLeadFromSlot({
                              dueDate: order.due_date,
                              slotDate: key,
                              pickup: order.pickup,
                              state: order.state,
                              settings,
                            })
                          : null;
                        const dueDateDistance = order ? formatDueDateDistance(order.due_date) : "";
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
                              hoveredDropSlotKey === slotKey && Boolean(draggingOrderId || draggingAssignmentId)
                                ? "border-blue-500 ring-2 ring-blue-200"
                                    : "border-zinc-200"
                            } ${(draggingAssignmentId || draggingOrderId) && !assignment && !isDropPending ? "hover:border-blue-300 hover:bg-blue-50/40" : ""}`}
                            data-production-date={key}
                            data-production-slot={slotIndex}
                            data-occupied={Boolean(assignment)}
                            onDragOver={(event) => {
                              if (!canWrite || (!draggingAssignmentId && !draggingOrderId) || assignment || key < todayKey || isDropPending) return;
                              event.preventDefault();
                              event.dataTransfer.dropEffect = "move";
                              if (hoveredDropSlotKey !== slotKey) setHoveredDropSlotKey(slotKey);
                            }}
                            onDragLeave={(event) => {
                              if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
                              setHoveredDropSlotKey((current) => current === slotKey ? null : current);
                            }}
                            onDrop={(event) => handleSlotDrop(event, key, slotIndex, Boolean(assignment))}
                          >
                            {assignment && order ? (
                              <div
                                draggable={canWrite && canDragSlotOrder && !isCompletedCalendarOrder && !order.made && !order.refunded_at}
                                onDragStart={(event) => {
                                  event.dataTransfer.effectAllowed = "move";
                                  event.dataTransfer.setData("text/plain", order.order_number || "Production batch");
                                  setDraggingAssignmentId(assignment.id);
                                  setHoveredDropSlotKey(null);
                                }}
                                onDragEnd={() => {
                                  setDraggingAssignmentId(null);
                                  setHoveredDropSlotKey(null);
                                }}
                                className={`relative rounded-md border px-2 py-1.5 text-[10px] ${statusCard(
                                  getMultiAssignmentScheduleStatus(order, assignedSlotDatesByOrderId.get(order.id) ?? [], todayKey),
                                )}`}
                              >
                                {stateLabel ? (
                                  <span className="absolute right-2 top-1.5 max-w-[45%] truncate text-[9px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                                    {stateLabel}
                                  </span>
                                ) : null}
                                {dueLead && key >= todayKey ? (
                                  <span className={`absolute right-2 top-4.5 max-w-[45%] truncate text-[9px] font-medium ${dueLead.urgent ? "text-rose-600" : "text-zinc-500"}`}>
                                    {dueLead.label}
                                  </span>
                                ) : null}
                                {isCollapsedCompletedCalendarOrder ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleCompletedCalendarAssignment(assignment.id)}
                                    className="block w-full truncate whitespace-nowrap pr-16 text-left text-[13px] font-semibold leading-tight text-zinc-900"
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
                                        className="block w-full truncate whitespace-nowrap pr-16 text-left text-[13px] font-semibold leading-tight text-zinc-900"
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
                                        className="truncate whitespace-nowrap pr-16 text-[13px] font-semibold leading-tight text-zinc-900"
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
                                    <div className="space-y-0 text-[9px] text-zinc-700">
                                      <p>
                                        {calendarWeightLabel(assignment.kg_assigned)}
                                        {Number(assignment.kg_assigned) !== Number(order.total_weight_kg)
                                          ? ` of ${calendarWeightLabel(order.total_weight_kg)}`
                                          : ""}
                                      </p>
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
          </>
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
                        const isAdminPremade = order ? isAdminPremadeOrder(order) : false;
                        const printTarget = order?.id ?? order?.order_number;
                        const title = productionScheduleTitle(order);
                        const dueDateDistance = order ? formatDueDateDistance(order.due_date) : "";
                        const canCompleteSlotOrder = order
                          ? canCompleteOrderForSlotDates(order, assignedSlotDatesByOrderId.get(order.id) ?? [key])
                          : false;
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
                                    Number.isFinite(Number(draggedAssignment.kg_assigned)) &&
                                      Number(draggedAssignment.kg_assigned) > 0
                                      ? Number(draggedAssignment.kg_assigned)
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
                                className={`mt-1 rounded-md border px-3 py-2 ${statusCard(
                                  getMultiAssignmentScheduleStatus(order, assignedSlotDatesByOrderId.get(order.id) ?? [], todayKey),
                                )}`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-base font-semibold leading-tight text-zinc-900">
                                      <OrderTitleWithLogo order={order} title={title} />
                                    </p>
                                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-700">
                                      <span>
                                        {weightLabel(assignment.kg_assigned)}
                                        {Number(assignment.kg_assigned) !== Number(order.total_weight_kg)
                                          ? ` of ${weightLabel(order.total_weight_kg)}`
                                          : ""}
                                      </span>
                                      <span className="flex flex-wrap gap-x-1">
                                        <span className="whitespace-nowrap">Due {formatDate(order.due_date)}</span>
                                        {dueDateDistance ? (
                                          <span className="whitespace-nowrap text-zinc-400">{dueDateDistance}</span>
                                        ) : null}
                                      </span>
                                      <span>{isAdminPremade ? "Premade" : order.pickup ? "Pickup" : "Delivery"}</span>
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
                                        confirmMessage={
                                          isAdminPremade
                                            ? "Confirm this premade batch is made? It will move out of the production schedule."
                                            : `Confirm ${order.pickup ? "collection" : "delivery"} for this order? It will move out of the production schedule.`
                                        }
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
                                      onClick={() =>
                                        setAssignmentModalTarget({ orderId: order.id, assignmentId: assignment.id })
                                      }
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
      {dropChoice && <AdminModalPortal onClose={() => setDropChoice(null)}><div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDropChoice(null)}><section role="dialog" aria-modal="true" aria-label="Choose batch to move" className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}><h3 className="text-lg font-semibold">Which batch should move?</h3><p className="mt-2 text-xs leading-5 text-zinc-500">{ordersById.get(dropChoice.orderId)?.title} has multiple allocated batches. Move one to {formatDate(dropChoice.date)}, slot {dropChoice.slotIndex}. Other batches stay where they are.</p><div className="mt-4 space-y-2">{dropChoice.assignments.map((assignment) => { const slot = slotMap.get(assignment.slot_id);return <button key={assignment.id} type="button" className="block w-full rounded-lg border border-zinc-200 px-3 py-3 text-left text-sm hover:border-emerald-500" onClick={() => { const choice = dropChoice; setDropChoice(null); commitDrop(choice.orderId, choice.date, choice.slotIndex, Number(assignment.kg_assigned), assignment.id); }}>{Number(assignment.kg_assigned).toFixed(2)} kg · {slot ? `${formatDate(slot.slot_date)} · Slot ${slot.slot_index}` : "Unknown date"}</button>; })}</div><button type="button" onClick={() => setDropChoice(null)} className="mt-4 text-xs font-semibold text-zinc-500">Cancel</button></section></div></AdminModalPortal>}
      {scheduleShift ? (
        <AdminModalPortal onClose={() => !isScheduleShiftPending && setScheduleShift(null)}>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !isScheduleShiftPending && setScheduleShift(null)}>
            <section
              role="dialog"
              aria-modal="true"
              aria-label="Move production schedule forward"
              className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-zinc-900">Move production schedule</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Move every scheduled production assignment on or after {formatDate(scheduleShift.date)} forward by the number of valid production days below. Blocked days, including weekends, are skipped. Slot positions stay the same.
              </p>
              <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                Valid production days forward
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={scheduleShift.days}
                  onChange={(event) => setScheduleShift((current) => current ? { ...current, days: event.target.value } : current)}
                  disabled={isScheduleShiftPending}
                  className="mt-2 w-full rounded border border-zinc-200 px-3 py-2 text-sm font-normal text-zinc-900"
                />
              </label>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setScheduleShift(null)}
                  disabled={isScheduleShiftPending}
                  className="rounded border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitScheduleShift}
                  disabled={isScheduleShiftPending}
                  className="rounded bg-zinc-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {isScheduleShiftPending ? "Moving…" : "Move schedule"}
                </button>
              </div>
            </section>
          </div>
        </AdminModalPortal>
      ) : null}
      {slotPicker && (
        <AdminModalPortal onClose={closeSlotPicker}>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeSlotPicker}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Select order"
            className="max-h-[calc(100dvh-2rem)] w-full min-w-0 max-w-md overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-4 shadow-lg [overflow-wrap:anywhere]"
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
              {assignableSlotOrders.length === 0 ? (
                <p className="text-xs text-zinc-500">No unassigned orders.</p>
              ) : (
                assignableSlotOrders.map(({ order, assignableKg, assignedCount, plannedBatchCount }) => {
                  const selectedSlotKey = `${slotPicker.date}:${slotPicker.slotIndex}`;
                  const selectedSlotId = slotIdByKey.get(selectedSlotKey) ?? "";
                  const batchLabel =
                    plannedBatchCount > 1
                      ? `Batch ${assignedCount + 1} of ${plannedBatchCount}`
                      : "Batch";

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
                          title={productionScheduleTitle(order)}
                          logoClassName="h-4 w-4"
                          imageClassName="h-5 w-5"
                        />
                        <span className="mt-1 block text-[11px] font-medium text-zinc-500">
                          {batchLabel} · {weightLabel(assignableKg)}
                          {Number(assignableKg) !== Number(order.total_weight_kg)
                            ? ` of ${weightLabel(order.total_weight_kg)}`
                            : ""}
                        </span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
        </AdminModalPortal>
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
