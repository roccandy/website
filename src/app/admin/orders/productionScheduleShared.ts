import type { OrderRow, OrderSlot, ProductionBlock, ProductionSlot, SettingsRow } from "@/lib/data";

export const formatDate = (iso: string | null) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
};

export const formatDateInput = (iso: string | null | undefined) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) return "";
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const formatMoney = (value: number | null | undefined) => {
  if (!Number.isFinite(value ?? NaN)) return "-";
  return `$${Number(value).toFixed(2)}`;
};

export const weightLabel = (kg: number | null | undefined) => {
  if (!kg || Number.isNaN(kg)) return "";
  return `${(Number(kg) * 1000).toFixed(0)} g`;
};

export const formatQuantity = (quantity: number | null | undefined) => {
  if (!Number.isFinite(quantity ?? NaN) || Number(quantity) <= 0) return "";
  const value = Number(quantity);
  return Number.isInteger(value) ? `${value}` : `${value.toFixed(2)}`;
};

export const formatOrderDescription = (order: OrderRow) => {
  const description = order.order_description?.trim() ?? "";
  const qty = formatQuantity(order.quantity);
  if (!qty) return description;
  return description ? `${description} (Qty: ${qty})` : `Qty: ${qty}`;
};

export const splitCustomerName = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed) return { first: "", last: "" };
  const [first, ...rest] = trimmed.split(/\s+/);
  return { first, last: rest.join(" ") };
};

export const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const formatMonthLabel = (date: Date) =>
  date.toLocaleDateString(undefined, { month: "long", year: "numeric" });

export const getScheduleStatus = (
  order: OrderRow,
  assignedSlotDate: string | null | undefined,
  todayKey = dateKey(new Date()),
) => {
  if (order.status === "archived") return "archived";
  if (!assignedSlotDate) return "unassigned";
  if (assignedSlotDate < todayKey) return "pending completion";
  return "scheduled";
};

export const statusBadge = (status: string) => {
  if (status === "archived") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "pending completion") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (status === "scheduled") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  if (status === "unassigned") {
    return "border-zinc-300 bg-zinc-100 text-zinc-700";
  }
  return "border-red-200 bg-red-50 text-red-700";
};

export const statusCard = (status: string) => {
  if (status === "archived") {
    return "border-emerald-300 bg-emerald-50 text-emerald-900";
  }
  if (status === "pending completion") {
    return "border-amber-300 bg-amber-50 text-amber-900";
  }
  if (status === "scheduled") {
    return "border-blue-300 bg-blue-50 text-blue-900";
  }
  return "border-red-300 bg-red-50 text-red-900";
};

export const canCompleteOrderForSlotDate = (order: OrderRow, slotDate: string | null | undefined) => {
  if (!slotDate) return false;
  if (order.status === "archived" || order.refunded_at) return false;
  return slotDate <= dateKey(new Date());
};

export const completionActionLabel = (order: OrderRow) =>
  order.pickup ? "Mark as collected" : "Mark as delivered";

export const isOpenOverride = (reason: string | null | undefined) =>
  reason?.trim().toLowerCase() === "open override";

export const isManualBlock = (reason: string | null | undefined) =>
  reason?.trim().toLowerCase() === "manual block";

export const isBlockedByDefault = (date: Date, settings: SettingsRow) => {
  const day = date.getDay();
  if (day === 0) return settings.no_production_sun;
  if (day === 1) return settings.no_production_mon;
  if (day === 2) return settings.no_production_tue;
  if (day === 3) return settings.no_production_wed;
  if (day === 4) return settings.no_production_thu;
  if (day === 5) return settings.no_production_fri;
  return settings.no_production_sat;
};

export const blockReasonForDate = (key: string, blocks: ProductionBlock[]) => {
  const explicit = blocks.find(
    (block) => key >= block.start_date && key <= block.end_date && !isOpenOverride(block.reason),
  );
  return explicit?.reason ?? null;
};

export const hasOpenOverrideForDate = (key: string, blocks: ProductionBlock[]) =>
  blocks.some((block) => key >= block.start_date && key <= block.end_date && isOpenOverride(block.reason));

export const isScheduleDateBlocked = (date: Date, settings: SettingsRow, blocks: ProductionBlock[]) => {
  const key = dateKey(date);
  const defaultBlocked = isBlockedByDefault(date, settings);
  const reason = blockReasonForDate(key, blocks);
  const hasOpenOverride = hasOpenOverrideForDate(key, blocks);

  return {
    key,
    defaultBlocked,
    reason,
    hasOpenOverride,
    blocked: (defaultBlocked && !hasOpenOverride) || Boolean(reason),
  };
};

export const buildSlotIdByKey = (slots: ProductionSlot[]) => {
  const map = new Map<string, string>();
  slots.forEach((slot) => {
    const key = `${slot.slot_date}:${slot.slot_index}`;
    if (!map.has(key)) {
      map.set(key, slot.id);
    }
  });
  return map;
};

export const buildAssignmentBySlotKey = (assignments: OrderSlot[], slots: ProductionSlot[]) => {
  const slotMap = new Map(slots.map((slot) => [slot.id, slot]));
  const map = new Map<string, OrderSlot>();
  assignments.forEach((assignment) => {
    const slot = slotMap.get(assignment.slot_id);
    if (!slot) return;
    map.set(`${slot.slot_date}:${slot.slot_index}`, assignment);
  });
  return map;
};

export const findFirstAvailableSlotIndexForDate = ({
  date,
  slotsPerDay,
  assignments,
  slots,
  ignoreAssignmentId,
}: {
  date: string;
  slotsPerDay: number;
  assignments: OrderSlot[];
  slots: ProductionSlot[];
  ignoreAssignmentId?: string | null;
}) => {
  const slotMap = new Map(slots.map((slot) => [slot.id, slot]));
  const occupied = new Set<number>();

  assignments.forEach((assignment) => {
    if (ignoreAssignmentId && assignment.id === ignoreAssignmentId) return;
    const slot = slotMap.get(assignment.slot_id);
    if (!slot || slot.slot_date !== date) return;
    occupied.add(slot.slot_index);
  });

  for (let slotIndex = 1; slotIndex <= slotsPerDay; slotIndex += 1) {
    if (!occupied.has(slotIndex)) return slotIndex;
  }

  return null;
};
