"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OrderRow, OrderSlot, ProductionSlot, SettingsRow } from "@/lib/data";
import { archiveOrderInline, assignOrderToSlot, deleteAssignment } from "./actions";
import SplitOrderDecisionModal from "./SplitOrderDecisionModal";
import {
  canCompleteOrderForSlotDates,
  batchWeightsForOrder,
  buildMondayFirstMonthCells,
  dateKey,
  formatDayMonthLabel,
  formatMonthLabel,
  formatScheduleStatusLabel,
  getMultiAssignmentScheduleStatus,
  getPremadeSiblingMeta,
  isScheduleDateBlocked,
  nextAssignableKgForOrder,
  productionCompletionActionLabel,
  weightLabel,
} from "./productionScheduleShared";

type Props = {
  order: OrderRow;
  allOrders: OrderRow[];
  assignment?: { assignment: OrderSlot; slot: ProductionSlot | null } | null;
  assignments: OrderSlot[];
  slots: ProductionSlot[];
  settings: SettingsRow;
  onClose: () => void;
  mode?: "assign" | "pick";
  onPickSlot?: (input: { slotDate: string; slotIndex: number }) => void;
};

type PendingSlotSelection = {
  slotDate: string;
  slotIndex: number;
  kg: number;
};

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function SlotAvailabilityBar({
  openSlotCount,
  slotsPerDay,
  disabled,
  isCurrentAssignment,
}: {
  openSlotCount: number;
  slotsPerDay: number;
  disabled: boolean;
  isCurrentAssignment: boolean;
}) {
  const totalSlots = Math.max(1, slotsPerDay);
  const openSlots = Math.max(0, Math.min(openSlotCount, totalSlots));

  return (
    <div
      className="mt-1.5 flex h-1.5 w-full gap-0.5"
      role="img"
      aria-label={`${openSlots} of ${totalSlots} production slots open`}
    >
      {Array.from({ length: totalSlots }, (_, index) => {
        const isOpen = index < openSlots;
        const segmentClass = isOpen
          ? isCurrentAssignment
            ? "bg-blue-500"
            : disabled
              ? "bg-zinc-300"
              : "bg-emerald-500"
          : disabled
            ? "bg-zinc-200"
            : "bg-zinc-200";

        return <span key={index} className={`h-full min-w-0 flex-1 rounded-sm ${segmentClass}`} />;
      })}
    </div>
  );
}

export default function AssignmentCalendarModal({
  order,
  allOrders,
  assignment = null,
  assignments,
  slots,
  settings,
  onClose,
  mode = "assign",
  onPickSlot,
}: Props) {
  const router = useRouter();
  const [calendarMonth, setCalendarMonth] = useState(() => {
    if (assignment?.slot?.slot_date) {
      return new Date(`${assignment.slot.slot_date}T00:00:00`);
    }
    return new Date();
  });
  const [isPending, startTransition] = useTransition();
  const [splitPromptOpen, setSplitPromptOpen] = useState(false);
  const [pendingSlotSelections, setPendingSlotSelections] = useState<PendingSlotSelection[]>([]);
  const todayKey = dateKey(new Date());
  const slotsPerDay = Math.max(1, Number(settings.production_slots_per_day) || 1);

  const monthCells = useMemo(() => buildMondayFirstMonthCells(calendarMonth), [calendarMonth]);
  const orderAssignments = useMemo(
    () => assignments.filter((entry) => entry.order_id === order.id),
    [assignments, order.id],
  );
  const assignedSlotDates = useMemo(
    () =>
      orderAssignments
        .map((entry) => slots.find((slot) => slot.id === entry.slot_id)?.slot_date ?? "")
        .filter(Boolean),
    [orderAssignments, slots],
  );
  const assignmentBatchKg =
    assignment?.assignment.kg_assigned && Number(assignment.assignment.kg_assigned) > 0
      ? Number(assignment.assignment.kg_assigned)
      : nextAssignableKgForOrder(order, orderAssignments);
  const assignmentWeightLabel = weightLabel(assignmentBatchKg) || "Weight not set";
  const totalWeightLabel = weightLabel(order.total_weight_kg);
  const stagedAssignMode = mode === "assign" && !assignment?.assignment.id;
  const remainingBatchWeights = useMemo(() => {
    if (!stagedAssignMode) return [];
    const plannedWeights = batchWeightsForOrder(order);
    const remainingWeights = plannedWeights.slice(orderAssignments.length);
    if (remainingWeights.length > 0) return remainingWeights;
    const fallback = nextAssignableKgForOrder(order, orderAssignments);
    return Number.isFinite(fallback) && fallback > 0 ? [fallback] : [];
  }, [order, orderAssignments, stagedAssignMode]);
  const requiredSelectionCount = remainingBatchWeights.length;

  const dayCards = useMemo(
    () =>
      monthCells.map((day) => {
        if (!day) return null;
        const status = isScheduleDateBlocked(day, settings);
        const selectedForDate = pendingSlotSelections.filter((selection) => selection.slotDate === status.key);
        const availableSlotIndexes = status.blocked
          ? []
          : Array.from({ length: slotsPerDay }, (_, index) => index + 1).filter((slotIndex) => {
              const existingSlotId = slots.find(
                (slot) => slot.slot_date === status.key && slot.slot_index === slotIndex,
              )?.id;
              const assignmentForSlot = assignments.find((entry) => entry.slot_id === existingSlotId);
              const isCurrentAssignment = assignmentForSlot?.id === (assignment?.assignment.id ?? "");
              const isSelected = selectedForDate.some((selection) => selection.slotIndex === slotIndex);
              return (!assignmentForSlot || isCurrentAssignment) && !isSelected;
            });
        const availableSlotIndex = availableSlotIndexes[0] ?? null;
        const openSlotCount =
          status.blocked
            ? 0
            : Array.from({ length: slotsPerDay }, (_, index) => index + 1).filter((slotIndex) => {
                const existingSlotId = slots.find(
                  (slot) => slot.slot_date === status.key && slot.slot_index === slotIndex,
                )?.id;
                const assignmentForSlot = assignments.find((entry) => entry.slot_id === existingSlotId);
                const isSelected = selectedForDate.some((selection) => selection.slotIndex === slotIndex);
                if (isSelected) return false;
                if (!assignmentForSlot) return true;
                return assignmentForSlot.id === (assignment?.assignment.id ?? "");
              }).length;

        const isPast = status.key < todayKey;
        const isCurrentAssignment = assignment?.slot?.slot_date === status.key;
        const disabled = status.blocked || availableSlotIndex === null;

        let statusLabel: string | null = null;
        if (selectedForDate.length > 0) statusLabel = `${selectedForDate.length} selected`;
        if (status.blocked) statusLabel = status.reason ?? "Blocked";
        if (availableSlotIndex === null && !status.blocked) statusLabel = "Full";
        if (isPast) statusLabel = "Past date";
        if (isCurrentAssignment && !disabled) statusLabel = "Current date";

        return {
          day,
          key: status.key,
          openSlotCount,
          statusLabel,
          disabled,
          isPast,
          isCurrentAssignment,
          availableSlotIndex,
          blocked: status.blocked,
        };
      }),
    [assignment?.assignment, assignment?.slot?.slot_date, assignments, monthCells, pendingSlotSelections, settings, slots, slotsPerDay, todayKey],
  );

  const actionLabel = mode === "pick" ? "Pick production slot" : assignment ? "Change assignment" : "Assign";
  const scheduleStatus = getMultiAssignmentScheduleStatus(order, assignedSlotDates, todayKey);
  const canCompleteOrder = canCompleteOrderForSlotDates(order, assignedSlotDates);
  const premadeSiblingMeta = useMemo(() => getPremadeSiblingMeta(allOrders, order), [allOrders, order]);
  const emitToast = (tone: "success" | "error", message: string) => {
    window.dispatchEvent(new CustomEvent("toast", { detail: { tone, message } }));
  };
  const completeOrder = (includeCompanion: boolean) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("order_id", order.id);
      if (includeCompanion && premadeSiblingMeta?.shouldPromptForCompanion) {
        formData.set("include_companion", "on");
        formData.set("companion_order_ids", premadeSiblingMeta.companionOrderIds);
      }
      const result = await archiveOrderInline(formData);
      if (result?.message) {
        emitToast(result.tone, result.message);
      }
      if (result?.ok) {
        setSplitPromptOpen(false);
        onClose();
        router.refresh();
      }
    });
  };
  const savePendingSlotSelections = () => {
    if (!stagedAssignMode || pendingSlotSelections.length === 0) return;
    startTransition(async () => {
      for (const selection of pendingSlotSelections) {
        const formData = new FormData();
        formData.set("order_id", order.id);
        formData.set("slot_date", selection.slotDate);
        formData.set("slot_index", String(selection.slotIndex));
        formData.set("kg_assigned", String(selection.kg));
        formData.set("response_mode", "inline");
        const result = await assignOrderToSlot(formData);
        if (result?.message && !result.ok) {
          emitToast(result.tone, result.message);
        }
        if (!result?.ok) return;
      }
      emitToast("success", "Order assigned.");
      onClose();
      router.refresh();
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
        <div
          className="w-full max-w-4xl rounded-2xl border border-zinc-200 bg-white p-4 shadow-lg"
          onClick={(event) => event.stopPropagation()}
        >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{actionLabel}</p>
            <h3 className="admin-subsection-title text-zinc-900">{order.title ?? "Untitled order"}</h3>
            <p className="text-sm text-zinc-600">
              {assignmentWeightLabel}
              {assignmentBatchKg && Number(assignmentBatchKg) !== Number(order.total_weight_kg) && totalWeightLabel
                ? ` of ${totalWeightLabel}`
                : ""}{" "}
              · {formatScheduleStatusLabel(scheduleStatus)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {stagedAssignMode ? (
              <button
                type="button"
                disabled={
                  isPending ||
                  requiredSelectionCount === 0 ||
                  pendingSlotSelections.length !== requiredSelectionCount
                }
                onClick={savePendingSlotSelections}
                className="rounded border border-zinc-900 bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:border-zinc-300 disabled:bg-zinc-200 disabled:text-zinc-500"
              >
                {isPending ? "Saving..." : "Save assignment"}
              </button>
            ) : null}
            {mode === "assign" && canCompleteOrder ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  if (premadeSiblingMeta?.shouldPromptForCompanion) {
                    setSplitPromptOpen(true);
                    return;
                  }
                  const confirmed = window.confirm(
                    `Confirm ${order.pickup ? "collection" : "delivery"} for this order? It will move out of the production schedule.`,
                  );
                  if (!confirmed) return;
                  completeOrder(false);
                }}
                className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:border-emerald-300 disabled:opacity-50"
              >
                {productionCompletionActionLabel(order)}
              </button>
            ) : null}
            {mode === "assign" && assignment?.assignment.id ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  startTransition(async () => {
                    const formData = new FormData();
                    formData.set("assignment_id", assignment.assignment.id);
                    formData.set("response_mode", "inline");
                    const result = await deleteAssignment(formData);
                    if (result?.message) {
                      emitToast(result.tone, result.message);
                    }
                    if (result?.ok) {
                      onClose();
                      router.refresh();
                    }
                  });
                }}
                className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:border-rose-300 disabled:opacity-50"
              >
                Unassign
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
            >
              Close
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
            className="rounded border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
          >
            Prev
          </button>
          <span className="text-sm font-semibold text-zinc-800">{formatMonthLabel(calendarMonth)}</span>
          <button
            type="button"
            onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
            className="rounded border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
          >
            Next
          </button>
        </div>

        {stagedAssignMode ? (
          <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Batch dates {pendingSlotSelections.length}/{requiredSelectionCount}
              </p>
              {pendingSlotSelections.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setPendingSlotSelections([])}
                  className="rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-700 hover:border-zinc-300"
                >
                  Clear
                </button>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {remainingBatchWeights.map((weight, index) => {
                const selection = pendingSlotSelections[index];
                return (
                  <span
                    key={`pending-batch-${index}`}
                    className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                      selection
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-amber-200 bg-amber-50 text-amber-800"
                    }`}
                  >
                    Batch {index + 1}: {weight.toFixed(2)}kg
                    {selection ? ` · ${selection.slotDate}` : ""}
                  </span>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="mt-4 space-y-1.5">
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="rounded-lg border border-zinc-200 bg-zinc-50 px-1.5 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500"
              >
                {label}
              </div>
            ))}
            {dayCards.map((item, index) => {
              if (!item) {
                return <div key={`blank-${index}`} className="min-h-[5rem] rounded-lg border border-transparent bg-transparent" />;
              }

              const label = formatDayMonthLabel(item.day);

              return (
                <button
                  key={item.key}
                  type="button"
                  disabled={
                    item.disabled ||
                    isPending ||
                    item.availableSlotIndex === null ||
                    (stagedAssignMode && pendingSlotSelections.length >= requiredSelectionCount)
                  }
                  onClick={() => {
                    if (!item.availableSlotIndex) return;
                    if (stagedAssignMode && pendingSlotSelections.length >= requiredSelectionCount) return;
                    if (item.isPast) {
                      const confirmed = window.confirm(
                        "This date is in the past. Assigning an order to a past production day should only be used for backfilling. Continue?",
                      );
                      if (!confirmed) return;
                    }
                    const slotIndex = item.availableSlotIndex;
                    if (slotIndex === null) return;
                    if (stagedAssignMode) {
                      const kg = remainingBatchWeights[pendingSlotSelections.length] ?? assignmentBatchKg ?? 0.01;
                      setPendingSlotSelections((current) => [
                        ...current,
                        { slotDate: item.key, slotIndex, kg: Number.isFinite(kg) && kg > 0 ? kg : 0.01 },
                      ]);
                      return;
                    }
                    startTransition(async () => {
                      if (mode === "pick" && onPickSlot) {
                        onPickSlot({ slotDate: item.key, slotIndex });
                        return;
                      }
                      const formData = new FormData();
                      formData.set("order_id", order.id);
                      formData.set("slot_date", item.key);
                      formData.set("slot_index", String(slotIndex));
                      formData.set("response_mode", "inline");
                      formData.set(
                        "kg_assigned",
                        String(Number.isFinite(assignmentBatchKg) && assignmentBatchKg > 0 ? assignmentBatchKg : 0.01),
                      );
                      if (assignment?.assignment.id) {
                        formData.set("assignment_id", assignment.assignment.id);
                      }
                      const result = await assignOrderToSlot(formData);
                      if (result?.message) {
                        emitToast(result.tone, result.message);
                      }
                      if (result?.ok) {
                        onClose();
                        router.refresh();
                      }
                    });
                  }}
                  className={`min-h-[5rem] rounded-xl border px-2 py-1.5 text-left transition ${
                    item.disabled
                      ? "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400"
                      : item.isPast
                        ? "border-zinc-200 bg-zinc-100 text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50"
                      : item.isCurrentAssignment
                        ? "border-blue-300 bg-blue-50 text-blue-900"
                        : "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300 hover:bg-zinc-50"
                  }`}
                >
                  <p className="text-[13px] font-semibold">{label}</p>
                  <SlotAvailabilityBar
                    openSlotCount={item.openSlotCount}
                    slotsPerDay={slotsPerDay}
                    disabled={item.disabled}
                    isCurrentAssignment={item.isCurrentAssignment}
                  />
                  {item.statusLabel ? (
                    <p className="mt-1 text-[10px] font-medium leading-snug">{item.statusLabel}</p>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
        </div>
      </div>
      {premadeSiblingMeta ? (
        <SplitOrderDecisionModal
          open={splitPromptOpen}
          baseOrderNumber={premadeSiblingMeta.baseOrderNumber}
          companionLabel={premadeSiblingMeta.companionLabel}
          companionActionLabel={premadeSiblingMeta.companionActionLabel}
          onYes={() => completeOrder(true)}
          onNo={() => completeOrder(false)}
          onCancel={() => setSplitPromptOpen(false)}
        />
      ) : null}
    </>
  );
}
