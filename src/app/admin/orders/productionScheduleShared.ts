import type { OrderRow, OrderSlot, PackagingOption, ProductionBlock, ProductionSlot, SettingsRow } from "@/lib/data";
import { normalizeBaseOrderNumber } from "@/lib/orderNumbers";

export const formatDate = (iso: string | null) => {
  if (!iso) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [year, month, day] = iso.split("-");
    return `${day}/${month}/${year}`;
  }
  try {
    return new Intl.DateTimeFormat("en-AU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const DAY_MS = 24 * 60 * 60 * 1000;

const parseCalendarDate = (iso: string | null | undefined) => {
  if (!iso) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [year, month, day] = iso.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

export const formatDueDateDistance = (iso: string | null | undefined, today = new Date()) => {
  const dueDate = parseCalendarDate(iso);
  if (!dueDate) return "";
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((dueDate.getTime() - todayDate.getTime()) / DAY_MS);
  if (days === 0) return "today";
  if (days === 1) return "in 1 day";
  if (days > 1) return `in ${days} days`;
  if (days === -1) return "1 day ago";
  return `${Math.abs(days)} days ago`;
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

export const formatPackagingOptionLabel = (
  option: Pick<PackagingOption, "type" | "size"> | null | undefined,
) => {
  if (!option) return "";
  const type = option.type?.trim() ?? "";
  const size = option.size?.trim() ?? "";
  if (!type) return size;
  if (!size) return type;
  const normalizedSize = type.toLowerCase().includes("jar")
    ? size.replace(/\s*\(?\d+\s*g\)?$/i, "").trim() || size
    : size;
  return `${type} - ${normalizedSize}`;
};

const pluralPackagingType = (type: string) => {
  const trimmed = type.trim();
  const lower = trimmed.toLowerCase();
  if (!trimmed) return "";
  if (lower === "bulk") return trimmed;
  if (lower.endsWith("jars")) return trimmed;
  if (lower.endsWith("jar")) return `${trimmed.slice(0, -3)}Jars`;
  if (lower.endsWith("bags")) return trimmed;
  if (lower.endsWith("bag")) return `${trimmed.slice(0, -3)}Bags`;
  if (lower.endsWith("box")) return `${trimmed}es`;
  if (lower.endsWith("s")) return trimmed;
  return `${trimmed}s`;
};

const packagingOrderDescription = (
  option: Pick<PackagingOption, "type" | "size"> | null | undefined,
  quantityLabel: string,
) => {
  if (!option) return "";
  const type = option.type?.trim() ?? "";
  const size = option.size?.trim() ?? "";
  if (!type && !size) return "";
  const normalizedSize = type.toLowerCase().includes("jar")
    ? size.replace(/\s*\(?\d+\s*g\)?$/i, "").trim() || size
    : size;
  const packageLabel = [normalizedSize, pluralPackagingType(type)].filter(Boolean).join(" ").trim();
  if (!packageLabel) {
    const fallbackLabel = formatPackagingOptionLabel(option);
    return quantityLabel ? `${quantityLabel} x ${fallbackLabel}` : fallbackLabel;
  }
  return quantityLabel ? `${quantityLabel} x ${packageLabel}` : packageLabel;
};

export const formatOrderDescription = (order: OrderRow, packagingOption?: PackagingOption | null) => {
  const description = order.order_description?.trim() ?? "";
  const qty = formatQuantity(order.quantity);
  const packagingDescription = packagingOrderDescription(packagingOption, qty);
  if (packagingDescription) return packagingDescription;
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

const WEEKDAY_SHORT_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_LONG_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_SHORT_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_LONG_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const formatMonthLabel = (date: Date) =>
  `${MONTH_LONG_LABELS[date.getMonth()]} ${date.getFullYear()}`;

export const formatWeekdayShortLabel = (date: Date) => WEEKDAY_SHORT_LABELS[date.getDay()];

export const formatDayMonthLabel = (date: Date) =>
  `${date.getDate()} ${MONTH_SHORT_LABELS[date.getMonth()]}`;

export const formatWeekdayDayMonthLabel = (date: Date) =>
  `${WEEKDAY_LONG_LABELS[date.getDay()]} ${formatDayMonthLabel(date)}`;

export const formatFullDateLabel = (date: Date) =>
  `${date.getDate()} ${MONTH_LONG_LABELS[date.getMonth()]} ${date.getFullYear()}`;

export const buildMondayFirstMonthCells = (month: Date) => {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const start = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const startOffset = (start.getDay() + 6) % 7;
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  return Array.from({ length: totalCells }, (_, index) => {
    const dayNumber = index - startOffset + 1;
    if (dayNumber < 1 || dayNumber > daysInMonth) return null;
    return new Date(year, monthIndex, dayNumber);
  });
};

export const buildProductionWorkweekMonthCells = (month: Date, settings: SettingsRow) =>
  buildMondayFirstMonthCells(month)
    .filter((_, index) => index % 7 < 5)
    .map((day) => {
      if (!day) return null;
      return isScheduleDateBlocked(day, settings).blocked ? null : day;
    });

const SAFE_DOWNLOAD_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "svg"] as const;

export const sanitizeDownloadFilenamePart = (value: string) =>
  value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 120);

export const getDownloadFileExtensionFromUrl = (value: string, fallback = "png") => {
  const dataUrlMatch = value.match(/^data:([^;,]+)[;,]/i);
  if (dataUrlMatch?.[1]) {
    const mime = dataUrlMatch[1].toLowerCase();
    if (mime === "image/jpeg") return "jpg";
    if (mime === "image/png") return "png";
    if (mime === "image/gif") return "gif";
    if (mime === "image/webp") return "webp";
    if (mime === "image/svg+xml") return "svg";
    return fallback;
  }

  try {
    const url = new URL(value, "https://example.local");
    const ext = url.pathname.split(".").pop()?.toLowerCase() ?? "";
    return SAFE_DOWNLOAD_EXTENSIONS.includes(ext as (typeof SAFE_DOWNLOAD_EXTENSIONS)[number]) ? ext : fallback;
  } catch {
    const ext = value.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
    return SAFE_DOWNLOAD_EXTENSIONS.includes(ext as (typeof SAFE_DOWNLOAD_EXTENSIONS)[number]) ? ext : fallback;
  }
};

export const logoDownloadNameForOrder = (
  order: Pick<OrderRow, "organization_name" | "title" | "customer_name" | "order_number" | "logo_url">,
) => {
  const filename =
    sanitizeDownloadFilenamePart(
      order.organization_name?.trim() ||
        order.title?.trim() ||
        order.customer_name?.trim() ||
        order.order_number?.trim() ||
        "logo",
    ) || "logo";
  const ext = getDownloadFileExtensionFromUrl(order.logo_url ?? "");
  return `${filename}.${ext}`;
};

export const getScheduleStatus = (
  order: OrderRow,
  assignedSlotDate: string | null | undefined,
  todayKey = dateKey(new Date()),
) => {
  if (order.status === "test") return "test";
  if (order.status === "archived") return "archived";
  if (!assignedSlotDate) return "unassigned";
  if (assignedSlotDate < todayKey) return "made";
  return "scheduled";
};

export const batchWeightsForOrder = (order: Pick<OrderRow, "admin_batch_weights_kg" | "total_weight_kg">) => {
  const weights = Array.isArray(order.admin_batch_weights_kg)
    ? order.admin_batch_weights_kg
        .map((weight) => Number(weight))
        .filter((weight) => Number.isFinite(weight) && weight > 0)
    : [];
  if (weights.length > 0) return weights;
  const total = Number(order.total_weight_kg);
  return Number.isFinite(total) && total > 0 ? [total] : [];
};

const formatKgValue = (weight: number) => {
  const rounded = Math.round(weight * 100) / 100;
  return Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
};

export const formatBatchBreakdown = (order: Pick<OrderRow, "admin_batch_weights_kg" | "total_weight_kg">) => {
  const weights = batchWeightsForOrder(order);
  if (weights.length <= 1) return "";
  const groups = weights.reduce<Array<{ weight: number; count: number }>>((acc, weight) => {
    const existing = acc.find((entry) => Math.abs(entry.weight - weight) < 0.005);
    if (existing) {
      existing.count += 1;
      return acc;
    }
    acc.push({ weight, count: 1 });
    return acc;
  }, []);
  return groups.map((entry) => `${entry.count} x ${formatKgValue(entry.weight)}kg`).join(" + ");
};

export const assignedKgForOrder = (assignments: OrderSlot[]) =>
  assignments.reduce((sum, assignment) => sum + Number(assignment.kg_assigned || 0), 0);

export const remainingKgForOrder = (order: OrderRow, assignments: OrderSlot[]) => {
  const total = Number(order.total_weight_kg);
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, total - assignedKgForOrder(assignments));
};

export const nextAssignableKgForOrder = (order: OrderRow, assignments: OrderSlot[]) => {
  const weights = batchWeightsForOrder(order);
  const assignedCount = assignments.length;
  const planned = weights[assignedCount];
  if (Number.isFinite(planned) && planned > 0) return planned;
  const remaining = remainingKgForOrder(order, assignments);
  return remaining > 0 ? remaining : 0;
};

export const getMultiAssignmentScheduleStatus = (
  order: OrderRow,
  assignedSlotDates: string[],
  todayKey = dateKey(new Date()),
) => {
  if (order.status === "test") return "test";
  if (order.status === "archived") return "archived";
  if (assignedSlotDates.length === 0) return "unassigned";
  const plannedBatchCount = Math.max(1, batchWeightsForOrder(order).length);
  const pastCount = assignedSlotDates.filter((slotDate) => slotDate < todayKey).length;
  if (pastCount >= plannedBatchCount) return "made";
  if (pastCount > 0) return "partially made";
  if (assignedSlotDates.length < plannedBatchCount) return "partially scheduled";
  return "scheduled";
};

export const formatScheduleStatusLabel = (status: string) => {
  if (status === "test") return "Test";
  if (status === "pending completion") return "made";
  if (status === "partially complete") return "partially made";
  return status.replace(/_/g, " ");
};

export const statusBadge = (status: string) => {
  if (status === "test") {
    return "border-zinc-950 bg-zinc-950 text-white";
  }
  if (status === "archived") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "pending completion" || status === "made") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (status === "partially complete" || status === "partially made") {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }
  if (status === "partially scheduled") {
    return "border-orange-300 bg-orange-100 text-orange-900";
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
  if (status === "test") {
    return "border-zinc-950 bg-zinc-950 text-white";
  }
  if (status === "archived") {
    return "border-emerald-300 bg-emerald-50 text-emerald-900";
  }
  if (status === "pending completion" || status === "made") {
    return "border-amber-300 bg-amber-50 text-amber-900";
  }
  if (status === "partially complete" || status === "partially made") {
    return "border-orange-300 bg-orange-50 text-orange-900";
  }
  if (status === "partially scheduled") {
    return "border-orange-400 bg-orange-100 text-orange-950";
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

export const canCompleteOrderForSlotDates = (order: OrderRow, slotDates: string[]) => {
  const validDates = slotDates.filter(Boolean);
  if (validDates.length === 0) return false;
  if (order.status === "archived" || order.refunded_at) return false;
  const today = dateKey(new Date());
  return validDates.every((slotDate) => slotDate <= today);
};

export const completionActionLabel = (order: OrderRow) =>
  order.status === "archived" || order.status === "shipped"
    ? order.pickup
      ? "Collected"
      : "Shipped"
    : order.pickup
      ? "Mark as collected"
      : "Mark as shipped";

export const productionCompletionActionLabel = (order: OrderRow) =>
  order.status === "archived" || order.status === "shipped"
    ? order.pickup
      ? "Collected"
      : "Shipped"
    : order.pickup
      ? "Mark as collected"
      : "Mark as shipped";

const sanitizeFocusKey = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "-");

const summarizeSiblingLabel = (orders: OrderRow[]) => {
  const labels = orders
    .map((order) => order.title?.trim() || order.order_description?.trim() || null)
    .filter((value): value is string => Boolean(value));

  if (labels.length === 0) return "the other item in the order";
  if (labels.length === 1) return labels[0];
  return `${labels[0]} and ${labels.length - 1} more item${labels.length > 2 ? "s" : ""}`;
};

export const getPremadeSiblingMeta = (orders: OrderRow[], currentOrder: OrderRow) => {
  const baseOrderNumber = normalizeBaseOrderNumber(currentOrder.order_number);
  if (!baseOrderNumber) return null;

  const premadeOrders = orders.filter((order) => {
    if (order.id === currentOrder.id) return false;
    if (normalizeBaseOrderNumber(order.order_number) !== baseOrderNumber) return false;
    return order.design_type === "premade";
  });

  if (premadeOrders.length === 0) return null;

  const focusSource = premadeOrders.find((order) => order.order_number?.trim()) ?? premadeOrders[0];
  const focusKey = sanitizeFocusKey((focusSource.order_number?.trim() || focusSource.id || "group").trim());
  const activeCompanionOrders = premadeOrders.filter((order) => !order.refunded_at && order.status !== "shipped");
  const companionOrderIds = activeCompanionOrders.map((order) => order.id).join(",");
  const actionLabel = premadeOrders.every((order) => order.pickup) ? "collected" : "shipped";

  return {
    baseOrderNumber,
    focusKey,
    href: `/admin/orders/additional-items?focus=${encodeURIComponent(focusKey)}`,
    hasCompanion: true,
    companionOrderIds,
    companionLabel: summarizeSiblingLabel(activeCompanionOrders),
    companionActionLabel: actionLabel,
    shouldPromptForCompanion: activeCompanionOrders.length > 0,
  };
};

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

export const isScheduleDateBlocked = (date: Date, settings: SettingsRow) => {
  const key = dateKey(date);
  const defaultBlocked = isBlockedByDefault(date, settings);

  return {
    key,
    defaultBlocked,
    reason: null,
    hasOpenOverride: false,
    blocked: defaultBlocked,
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
