import type { OrderRow } from "@/lib/data";

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
