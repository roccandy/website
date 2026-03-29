"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OrderRow, OrderSlot, ProductionBlock, ProductionSlot, SettingsRow } from "@/lib/data";
import { assignOrderToSlot, deleteAssignment } from "./actions";
import {
  dateKey,
  findFirstAvailableSlotIndexForDate,
  formatMonthLabel,
  getScheduleStatus,
  isScheduleDateBlocked,
  weightLabel,
} from "./productionScheduleShared";

type Props = {
  order: OrderRow;
  assignment?: { assignment: OrderSlot; slot: ProductionSlot | null } | null;
  assignments: OrderSlot[];
  slots: ProductionSlot[];
  blocks: ProductionBlock[];
  settings: SettingsRow;
  onClose: () => void;
};

function buildMonthDays(month: Date) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, index) => new Date(year, monthIndex, index + 1));
}

export default function AssignmentCalendarModal({
  order,
  assignment = null,
  assignments,
  slots,
  blocks,
  settings,
  onClose,
}: Props) {
  const router = useRouter();
  const [calendarMonth, setCalendarMonth] = useState(() => {
    if (assignment?.slot?.slot_date) {
      return new Date(`${assignment.slot.slot_date}T00:00:00`);
    }
    return new Date();
  });
  const [isPending, startTransition] = useTransition();
  const todayKey = dateKey(new Date());
  const slotsPerDay = Math.max(1, Number(settings.production_slots_per_day) || 1);

  const monthDays = useMemo(() => buildMonthDays(calendarMonth), [calendarMonth]);

  const dayCards = useMemo(
    () =>
      monthDays.map((day) => {
        const status = isScheduleDateBlocked(day, settings, blocks);
        const availableSlotIndex = status.blocked
          ? null
          : findFirstAvailableSlotIndexForDate({
              date: status.key,
              slotsPerDay,
              assignments,
              slots,
              ignoreAssignmentId: assignment?.assignment.id ?? null,
            });
        const openSlotCount =
          status.blocked
            ? 0
            : Array.from({ length: slotsPerDay }, (_, index) => index + 1).filter((slotIndex) => {
                const existingSlotId = slots.find(
                  (slot) => slot.slot_date === status.key && slot.slot_index === slotIndex,
                )?.id;
                const assignmentForSlot = assignments.find((entry) => entry.slot_id === existingSlotId);
                if (!assignmentForSlot) return true;
                return assignmentForSlot.id === (assignment?.assignment.id ?? "");
              }).length;

        const isPast = status.key < todayKey;
        const isCurrentAssignment = assignment?.slot?.slot_date === status.key;
        const disabled = isPast || status.blocked || availableSlotIndex === null;

        let helper = `${openSlotCount} of ${slotsPerDay} open`;
        if (status.blocked) helper = status.reason ?? "Blocked";
        if (availableSlotIndex === null && !status.blocked) helper = "Full";
        if (isPast) helper = "Past date";
        if (isCurrentAssignment && !disabled) helper = "Current date";

        return {
          day,
          key: status.key,
          helper,
          disabled,
          isCurrentAssignment,
          availableSlotIndex,
          blocked: status.blocked,
        };
      }),
    [assignment?.assignment.id, assignment?.slot?.slot_date, assignments, blocks, monthDays, settings, slots, slotsPerDay, todayKey],
  );

  const actionLabel = assignment ? "Change assignment" : "Assign";
  const scheduleStatus = getScheduleStatus(order, assignment?.slot?.slot_date ?? null, todayKey);
  const emitToast = (tone: "success" | "error", message: string) => {
    window.dispatchEvent(new CustomEvent("toast", { detail: { tone, message } }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{actionLabel}</p>
            <h3 className="text-lg font-semibold text-zinc-900">{order.title ?? "Untitled order"}</h3>
            <p className="text-sm text-zinc-600">
              {weightLabel(order.total_weight_kg) || "Weight not set"} · {scheduleStatus}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {assignment?.assignment.id ? (
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

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {dayCards.map((item) => {
            const label = item.day.toLocaleDateString(undefined, {
              weekday: "short",
              day: "numeric",
              month: "short",
            });

            return (
              <button
                key={item.key}
                type="button"
                disabled={item.disabled || isPending || item.availableSlotIndex === null}
                onClick={() => {
                  if (!item.availableSlotIndex) return;
                  startTransition(async () => {
                    const formData = new FormData();
                    formData.set("order_id", order.id);
                    formData.set("slot_date", item.key);
                    formData.set("slot_index", String(item.availableSlotIndex));
                    formData.set("response_mode", "inline");
                    formData.set(
                      "kg_assigned",
                      String(
                        Number.isFinite(Number(order.total_weight_kg)) && Number(order.total_weight_kg) > 0
                          ? Number(order.total_weight_kg)
                          : 0.01,
                      ),
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
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  item.disabled
                    ? "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400"
                    : item.isCurrentAssignment
                      ? "border-blue-300 bg-blue-50 text-blue-900"
                      : "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300 hover:bg-zinc-50"
                }`}
              >
                <p className="text-sm font-semibold">{label}</p>
                <p className="mt-1 text-xs font-medium">{item.helper}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
