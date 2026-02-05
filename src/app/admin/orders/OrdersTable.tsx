"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  ColorPaletteRow,
  Category,
  Flavor,
  OrderRow,
  OrderSlot,
  PackagingOption,
  ProductionBlock,
  ProductionSlot,
  SettingsRow,
} from "@/lib/data";
import type { PricingBreakdown } from "@/lib/pricing";
import { addManualBlock, addOpenOverride, assignOrderToSlot, deleteAssignment, removeManualBlock, refundOrder, upsertOrder } from "./actions";
import { paletteSections } from "@/app/admin/settings/palette";

type Props = {
  orders: OrderRow[];
  slots: ProductionSlot[];
  assignments: OrderSlot[];
  blocks: ProductionBlock[];
  settings: SettingsRow;
  packagingOptions: PackagingOption[];
  categories: Category[];
  pricingBreakdowns: Record<string, PricingBreakdown | null>;
  flavors: Flavor[];
  palette: ColorPaletteRow[];
  toast?: { tone: "success" | "error"; message: string } | null;
};

const JACKET_OPTIONS = [
  { value: "", label: "Single colour" },
  { value: "two_colour", label: "Two colour" },
  { value: "pinstripe", label: "Pin stripe" },
  { value: "two_colour_pinstripe", label: "Two colour + Pin stripe" },
  { value: "rainbow", label: "Rainbow" },
];

type ColorOption = { value: string; label: string; hex: string };
type ColorFormat = "hex" | "rgb" | "cmyk";
type ColorFieldProps = {
  label: string;
  name: string;
  value: string;
  selectValue: string;
  options: ColorOption[];
  inputValue: string;
  format: ColorFormat;
  isCustom: boolean;
  setValue: (value: string) => void;
  setInputValue: (value: string) => void;
  setFormat: (value: ColorFormat) => void;
  setIsCustom: (value: boolean) => void;
};

const COLOR_FORMAT_OPTIONS: { value: ColorFormat; label: string }[] = [
  { value: "hex", label: "Hex" },
  { value: "rgb", label: "RGB" },
  { value: "cmyk", label: "CMYK" },
];

const normalizeHex = (value: string) => {
  const trimmed = value.trim();
  if (!/^#?[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
  return trimmed.startsWith("#") ? trimmed.toLowerCase() : `#${trimmed.toLowerCase()}`;
};

const isHexColor = (value: string) => /^#[0-9a-f]{6}$/i.test(value);

const sanitizeHexInput = (value: string) => {
  const stripped = value.replace(/#/g, "").replace(/[^0-9a-f]/gi, "").slice(0, 6);
  if (!stripped) return "";
  return `#${stripped}`;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const rgbToHex = (r: number, g: number, b: number) => {
  const toHex = (channel: number) => Math.round(channel).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const hexToRgb = (value: string) => {
  const normalized = normalizeHex(value);
  if (!isHexColor(normalized)) return null;
  const raw = normalized.slice(1);
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  };
};

const rgbToCmyk = (r: number, g: number, b: number) => {
  const rNorm = clamp(r, 0, 255) / 255;
  const gNorm = clamp(g, 0, 255) / 255;
  const bNorm = clamp(b, 0, 255) / 255;
  const k = 1 - Math.max(rNorm, gNorm, bNorm);
  if (k >= 1) {
    return { c: 0, m: 0, y: 0, k: 100 };
  }
  const c = (1 - rNorm - k) / (1 - k);
  const m = (1 - gNorm - k) / (1 - k);
  const y = (1 - bNorm - k) / (1 - k);
  return {
    c: Math.round(c * 100),
    m: Math.round(m * 100),
    y: Math.round(y * 100),
    k: Math.round(k * 100),
  };
};

const cmykToRgb = (c: number, m: number, y: number, k: number) => {
  const cNorm = clamp(c, 0, 100) / 100;
  const mNorm = clamp(m, 0, 100) / 100;
  const yNorm = clamp(y, 0, 100) / 100;
  const kNorm = clamp(k, 0, 100) / 100;
  const r = 255 * (1 - cNorm) * (1 - kNorm);
  const g = 255 * (1 - mNorm) * (1 - kNorm);
  const b = 255 * (1 - yNorm) * (1 - kNorm);
  return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
};

const formatColorInput = (value: string, format: ColorFormat) => {
  const normalized = normalizeHex(value);
  if (!normalized) return "";
  if (!isHexColor(normalized)) return normalized;
  if (format === "hex") return normalized.toLowerCase();
  const rgb = hexToRgb(normalized);
  if (!rgb) return normalized.toLowerCase();
  if (format === "rgb") return `${rgb.r}, ${rgb.g}, ${rgb.b}`;
  const cmyk = rgbToCmyk(rgb.r, rgb.g, rgb.b);
  return `${cmyk.c}, ${cmyk.m}, ${cmyk.y}, ${cmyk.k}`;
};

const parseNumericList = (input: string, expected: number) => {
  const matches = input.match(/-?\d*\.?\d+/g);
  if (!matches || matches.length !== expected) return null;
  const numbers = matches.map((value) => Number(value));
  if (numbers.some((value) => Number.isNaN(value))) return null;
  return numbers;
};

const parseRgbInput = (input: string) => {
  const numbers = parseNumericList(input, 3);
  if (!numbers) return null;
  const [r, g, b] = numbers.map((value) => clamp(Math.round(value), 0, 255));
  return rgbToHex(r, g, b);
};

const parseCmykInput = (input: string) => {
  const numbers = parseNumericList(input, 4);
  if (!numbers) return null;
  const [c, m, y, k] = numbers.map((value) => clamp(value, 0, 100));
  const rgb = cmykToRgb(c, m, y, k);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
};

const parseHexInput = (input: string) => {
  const sanitized = sanitizeHexInput(input).toLowerCase();
  return isHexColor(sanitized) ? sanitized : null;
};

const isCustomPaletteValue = (value: string, paletteSet: Set<string>) => {
  if (!value) return false;
  const normalized = normalizeHex(value);
  if (!normalized.startsWith("#")) return true;
  const key = normalized.toLowerCase();
  return !paletteSet.has(key);
};

const buildPaletteOptions = (palette: ColorPaletteRow[]): ColorOption[] => {
  const options: ColorOption[] = [];
  const seen = new Set<string>();
  paletteSections.forEach((section) => {
    section.items.forEach((item) => {
      const match = palette.find((row) => row.category === item.categoryKey && row.shade === item.shadeKey);
      const hex = normalizeHex(match?.hex ?? item.defaultValue);
      if (!hex.startsWith("#")) return;
      const key = hex.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      options.push({ value: key, label: item.label, hex: key.toUpperCase() });
    });
  });
  return options;
};

const buildColorOptions = (options: ColorOption[], currentValue: string): ColorOption[] => {
  const trimmed = currentValue.trim();
  if (!trimmed) return options;
  const normalized = normalizeHex(trimmed);
  if (normalized.startsWith("#")) {
    const key = normalized.toLowerCase();
    if (options.some((option) => option.value === key)) return options;
    return [{ value: key, label: "Custom", hex: key.toUpperCase() }, ...options];
  }
  if (options.some((option) => option.value === trimmed)) return options;
  return [{ value: trimmed, label: trimmed, hex: trimmed }, ...options];
};

const formatSizeLabel = (type: string, size: string) => {
  if (!type.toLowerCase().includes("jar")) return size;
  const trimmed = size.trim();
  if (!trimmed) return size;
  const withoutGrams = trimmed.replace(/\s*\(?\d+\s*g\)?$/i, "");
  return withoutGrams || trimmed;
};

export function OrdersTable({
  orders,
  slots,
  assignments,
  blocks,
  settings,
  packagingOptions,
  categories,
  pricingBreakdowns,
  flavors,
  palette,
  toast,
}: Props) {
  const router = useRouter();
  const toastRef = useRef<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<"calendar" | "week">("week");
  const [slotPicker, setSlotPicker] = useState<{ date: string; slotIndex: number } | null>(null);
  const [pickupMode, setPickupMode] = useState<"on" | "off">("off");
  const [jacketMode, setJacketMode] = useState<string>("");
  const [textColorValue, setTextColorValue] = useState("");
  const [heartColorValue, setHeartColorValue] = useState("");
  const [jacketColorOneValue, setJacketColorOneValue] = useState("");
  const [jacketColorTwoValue, setJacketColorTwoValue] = useState("");
  const [jarLidColorValue, setJarLidColorValue] = useState("");
  const [orderCategoryId, setOrderCategoryId] = useState("");
  const [packagingType, setPackagingType] = useState("");
  const [packagingSize, setPackagingSize] = useState("");
  const [quantityInput, setQuantityInput] = useState("");
  const [textColorCustom, setTextColorCustom] = useState(false);
  const [heartColorCustom, setHeartColorCustom] = useState(false);
  const [jacketColorOneCustom, setJacketColorOneCustom] = useState(false);
  const [jacketColorTwoCustom, setJacketColorTwoCustom] = useState(false);
  const [textColorFormat, setTextColorFormat] = useState<ColorFormat>("hex");
  const [heartColorFormat, setHeartColorFormat] = useState<ColorFormat>("hex");
  const [jacketColorOneFormat, setJacketColorOneFormat] = useState<ColorFormat>("hex");
  const [jacketColorTwoFormat, setJacketColorTwoFormat] = useState<ColorFormat>("hex");
  const [textColorInput, setTextColorInput] = useState("");
  const [heartColorInput, setHeartColorInput] = useState("");
  const [jacketColorOneInput, setJacketColorOneInput] = useState("");
  const [jacketColorTwoInput, setJacketColorTwoInput] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editKey, setEditKey] = useState(0);
  const selected = useMemo(() => orders.find((o) => o.id === selectedId) ?? null, [orders, selectedId]);
  const showJacketColorTwo = jacketMode === "two_colour" || jacketMode === "two_colour_pinstripe";
  const colorOptions = useMemo(() => buildPaletteOptions(palette), [palette]);
  const packagingById = useMemo(() => new Map(packagingOptions.map((option) => [option.id, option])), [packagingOptions]);
  const paletteHexSet = useMemo(() => new Set(colorOptions.map((option) => option.value)), [colorOptions]);

  const syncEditableState = (order: OrderRow | null) => {
    if (!order) return;
    setPickupMode(order.pickup ? "on" : "off");
    setJacketMode(order.jacket ?? "");
    const nextTextColor = order.text_color ? normalizeHex(order.text_color) : "";
    const nextHeartColor = order.heart_color ? normalizeHex(order.heart_color) : "";
    const nextJacketColorOne = order.jacket_color_one ? normalizeHex(order.jacket_color_one) : "";
    const nextJacketColorTwo = order.jacket_color_two ? normalizeHex(order.jacket_color_two) : "";
    const nextJarLidColor = order.jar_lid_color ? normalizeHex(order.jar_lid_color) : "";
    const nextCategoryId = order.category_id ?? "";
    const nextPackagingOption = order.packaging_option_id ? packagingById.get(order.packaging_option_id) ?? null : null;
    setOrderCategoryId(nextCategoryId);
    setPackagingType(nextPackagingOption?.type ?? "");
    setPackagingSize(nextPackagingOption?.size ?? "");
    setQuantityInput(order.quantity ? String(order.quantity) : "");
    setTextColorValue(nextTextColor);
    setHeartColorValue(nextHeartColor);
    setJacketColorOneValue(nextJacketColorOne);
    setJacketColorTwoValue(nextJacketColorTwo);
    setJarLidColorValue(nextJarLidColor);
    setTextColorCustom(isCustomPaletteValue(nextTextColor, paletteHexSet));
    setHeartColorCustom(isCustomPaletteValue(nextHeartColor, paletteHexSet));
    setJacketColorOneCustom(isCustomPaletteValue(nextJacketColorOne, paletteHexSet));
    setJacketColorTwoCustom(isCustomPaletteValue(nextJacketColorTwo, paletteHexSet));
    setTextColorFormat("hex");
    setHeartColorFormat("hex");
    setJacketColorOneFormat("hex");
    setJacketColorTwoFormat("hex");
    setTextColorInput(formatColorInput(nextTextColor, "hex"));
    setHeartColorInput(formatColorInput(nextHeartColor, "hex"));
    setJacketColorOneInput(formatColorInput(nextJacketColorOne, "hex"));
    setJacketColorTwoInput(formatColorInput(nextJacketColorTwo, "hex"));
  };

  useEffect(() => {
    if (!selected) {
      setIsEditing(false);
      return;
    }
    syncEditableState(selected);
    setIsEditing(false);
    setEditKey((prev) => prev + 1);
  }, [selected, paletteHexSet, packagingById]);

  useEffect(() => {
    if (!toast) return;
    const key = `${toast.tone}:${toast.message}`;
    if (toastRef.current === key) return;
    toastRef.current = key;
    try {
      const evt = new CustomEvent("toast", { detail: { message: toast.message, tone: toast.tone } });
      window.dispatchEvent(evt);
    } catch {
      // no-op
    }
    router.replace("/admin/orders");
  }, [router, toast]);

  useEffect(() => {
    if (!showJacketColorTwo) {
      setJacketColorTwoValue("");
      setJacketColorTwoInput("");
      setJacketColorTwoFormat("hex");
      setJacketColorTwoCustom(false);
    }
  }, [showJacketColorTwo]);
  const categoryOptions = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name)),
    [categories]
  );
  const categoryLabelById = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);
  const jacketLabelByValue = useMemo(
    () => new Map(JACKET_OPTIONS.map((option) => [option.value, option.label])),
    []
  );
  const orderCategoryOptions = useMemo(() => {
    if (!orderCategoryId) return categoryOptions;
    if (categoryOptions.some((option) => option.id === orderCategoryId)) return categoryOptions;
    return [{ id: orderCategoryId, name: orderCategoryId }, ...categoryOptions];
  }, [categoryOptions, orderCategoryId]);
  const filteredPackagingOptions = useMemo(() => {
    if (!orderCategoryId) return [];
    return packagingOptions.filter((option) => option.allowed_categories?.includes(orderCategoryId));
  }, [orderCategoryId, packagingOptions]);
  const packagingTypes = useMemo(() => {
    const unique = new Set<string>();
    filteredPackagingOptions.forEach((option) => {
      if (option.type) unique.add(option.type);
    });
    return Array.from(unique);
  }, [filteredPackagingOptions]);
  useEffect(() => {
    if (!orderCategoryId) {
      if (packagingType) setPackagingType("");
      if (packagingSize) setPackagingSize("");
      return;
    }
    if (packagingTypes.length === 0) {
      if (packagingType) setPackagingType("");
      if (packagingSize) setPackagingSize("");
      return;
    }
    if (!packagingType || !packagingTypes.includes(packagingType)) {
      setPackagingType(packagingTypes[0]);
      setPackagingSize("");
    }
  }, [orderCategoryId, packagingTypes, packagingType, packagingSize]);
  const sizesForType = useMemo(() => {
    if (!packagingType) return [];
    const extractLeadingNumber = (value: string) => {
      const match = value.trim().match(/^(\d+)/);
      return match ? Number(match[1]) : null;
    };
    return filteredPackagingOptions
      .filter((option) => option.type === packagingType)
      .map((opt, index) => ({ opt, index }))
      .sort((a, b) => {
        const aNum = extractLeadingNumber(a.opt.size);
        const bNum = extractLeadingNumber(b.opt.size);
        if (aNum !== null && bNum !== null) {
          return aNum - bNum;
        }
        if (aNum !== null) return -1;
        if (bNum !== null) return 1;
        return a.index - b.index;
      })
      .map(({ opt }) => opt);
  }, [filteredPackagingOptions, packagingType]);
  useEffect(() => {
    if (!packagingType) {
      if (packagingSize) setPackagingSize("");
      return;
    }
    if (sizesForType.length === 0) {
      if (packagingSize) setPackagingSize("");
      return;
    }
    if (!packagingSize || !sizesForType.some((option) => option.size === packagingSize)) {
      setPackagingSize(sizesForType[0].size);
    }
  }, [packagingType, packagingSize, sizesForType]);
  const selectedPackagingOptionId = useMemo(() => {
    const found = sizesForType.find((option) => option.size === packagingSize);
    return found?.id ?? "";
  }, [sizesForType, packagingSize]);
  const selectedPackagingOption = useMemo(() => {
    if (!selectedPackagingOptionId) return null;
    return packagingOptions.find((option) => option.id === selectedPackagingOptionId) ?? null;
  }, [packagingOptions, selectedPackagingOptionId]);
  const isJarOption = useMemo(
    () => (selectedPackagingOption?.type ?? "").toLowerCase().includes("jar"),
    [selectedPackagingOption]
  );
  const availableLidColors = useMemo(
    () => (selectedPackagingOption?.lid_colors ?? []).filter(Boolean),
    [selectedPackagingOption]
  );
  const maxPackages = selectedPackagingOption?.max_packages ?? null;
  useEffect(() => {
    if (!selectedPackagingOption?.max_packages) return;
    const parsed = Number(quantityInput);
    if (!Number.isFinite(parsed)) return;
    const max = Number(selectedPackagingOption.max_packages);
    if (!Number.isFinite(max)) return;
    if (parsed <= max) return;
    setQuantityInput(String(max));
  }, [quantityInput, selectedPackagingOption?.max_packages]);
  useEffect(() => {
    if (!isJarOption || availableLidColors.length === 0) {
      if (jarLidColorValue) setJarLidColorValue("");
      return;
    }
    if (!availableLidColors.includes(jarLidColorValue)) {
      setJarLidColorValue(availableLidColors[0]);
    }
  }, [availableLidColors, isJarOption, jarLidColorValue]);
  const ordersById = useMemo(() => new Map(orders.map((o) => [o.id, o])), [orders]);
  const listOrders = useMemo(() => {
    const visible = orders.filter((order) => order.status !== "archived" && order.design_type !== "premade");
    return [...visible].sort((a, b) => {
      const aDate = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY;
      const bDate = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY;
      if (aDate !== bDate) return aDate - bDate;
      return (a.order_number ?? a.id ?? "").localeCompare(b.order_number ?? b.id ?? "");
    });
  }, [orders]);
  const slotMap = useMemo(() => new Map(slots.map((s) => [s.id, s])), [slots]);
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
  const unassignedOrders = useMemo(
    () => listOrders.filter((order) => (assignmentsByOrderId.get(order.id) ?? []).length === 0),
    [assignmentsByOrderId, listOrders]
  );

  const formatDate = (iso: string | null) => {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString();
    } catch {
      return iso;
    }
  };
  const formatDateInput = (iso: string | null | undefined) => {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.valueOf())) return "";
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const formatMoney = (value: number | null | undefined) => {
    if (!Number.isFinite(value ?? NaN)) return "-";
    return `$${Number(value).toFixed(2)}`;
  };

  const weightLabel = (kg: number | null | undefined) => {
    if (!kg || Number.isNaN(kg)) return "";
    return `${(Number(kg) * 1000).toFixed(0)} g`;
  };
  const formatQuantity = (quantity: number | null | undefined) => {
    if (!Number.isFinite(quantity ?? NaN) || Number(quantity) <= 0) return "";
    const value = Number(quantity);
    return Number.isInteger(value) ? `${value}` : `${value.toFixed(2)}`;
  };
  const formatOrderDescription = (order: OrderRow) => {
    const description = order.order_description?.trim() ?? "";
    const qty = formatQuantity(order.quantity);
    if (!qty) return description;
    return description ? `${description} (Qty: ${qty})` : `Qty: ${qty}`;
  };
  const toHexColor = (value: string, fallback = "#000000") => {
    const normalized = normalizeHex(value);
    return isHexColor(normalized) ? normalized.toLowerCase() : fallback;
  };
  const selectValueForColor = (value: string) => {
    if (!value) return "";
    const normalized = normalizeHex(value);
    const key = normalized.toLowerCase();
    return paletteHexSet.has(key) ? key : "custom";
  };
  const splitCustomerName = (value?: string | null) => {
    const trimmed = value?.trim();
    if (!trimmed) return { first: "", last: "" };
    const [first, ...rest] = trimmed.split(/\s+/);
    return { first, last: rest.join(" ") };
  };
  const dateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const formatMonthLabel = (date: Date) =>
    date.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const todayKey = dateKey(new Date());
  const getScheduleStatus = (order: OrderRow) => {
    if (order.status === "archived") return "archived";
    const entry = assignmentByOrderId.get(order.id);
    if (!entry) return "unassigned";
    const slotDate = entry.slot?.slot_date;
    if (slotDate && slotDate < todayKey) return "pending completion";
    return "scheduled";
  };

  const statusBadge = (status: string) => {
    if (status === "archived") {
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    }
    if (status === "pending completion") {
      return "border-amber-200 bg-amber-50 text-amber-700";
    }
    if (status === "scheduled") {
      return "border-blue-200 bg-blue-50 text-blue-700";
    }
    return "border-red-200 bg-red-50 text-red-700";
  };

  const statusCard = (status: string) => {
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

  const blockedStyle = {
    backgroundImage: "repeating-linear-gradient(135deg, rgba(250, 204, 21, 0.35) 0 12px, rgba(17, 24, 39, 0.18) 12px 24px)",
  };
  const isOpenOverride = (reason: string | null | undefined) => reason?.trim().toLowerCase() === "open override";
  const isManualBlock = (reason: string | null | undefined) => reason?.trim().toLowerCase() === "manual block";

  const blockRanges = useMemo(
    () =>
      blocks.map((block) => ({
        id: block.id,
        start: block.start_date,
        end: block.end_date,
        reason: block.reason,
      })),
    [blocks]
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
      const key = `${slot.slot_date}:${slot.slot_index}`;
      map.set(key, assignment);
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
    return Array.from({ length: totalCells }, (_, idx) => {
      const day = idx - startOffset + 1;
      return new Date(year, month, day);
    });
  }, [calendarMonth]);
  const weekDays = useMemo(() => {
    const anchor = new Date(calendarMonth);
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
    } else {
      const next = new Date(calendarMonth);
      next.setDate(calendarMonth.getDate() - 7);
      setCalendarMonth(next);
    }
  };
  const moveNext = () => {
    if (viewMode === "calendar") {
      setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));
    } else {
      const next = new Date(calendarMonth);
      next.setDate(calendarMonth.getDate() + 7);
      setCalendarMonth(next);
    }
  };
  const closeSlotPicker = () => setSlotPicker(null);
  const renderColorField = ({
    label,
    name,
    value,
    selectValue,
    options,
    inputValue,
    format,
    isCustom,
    setValue,
    setInputValue,
    setFormat,
    setIsCustom,
  }: ColorFieldProps) => {
    const isCustomMode = isCustom;
    const normalized = normalizeHex(value);
    const showPreview = !isCustomMode && isHexColor(normalized);
    const placeholder = format === "hex" ? "#000000" : format === "rgb" ? "255, 0, 0" : "0, 100, 100, 0";

    if (!isEditing) {
      return (
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">{label}</p>
          {showPreview ? (
            <div
              className="mt-1 h-9 w-full rounded border border-zinc-200"
              style={{ backgroundColor: normalized }}
            />
          ) : (
            <p className="mt-1 text-sm text-zinc-900">{value || "-"}</p>
          )}
        </div>
      );
    }

    return (
      <label className="block text-[11px] uppercase tracking-[0.18em] text-zinc-400">
        {label}
        <select
          value={selectValue}
          onChange={(event) => {
            const next = event.target.value;
            if (!next) {
              setValue("");
              setInputValue("");
              setIsCustom(false);
              return;
            }
            if (next === "custom") {
              const nextValue = toHexColor(value || "#000000");
              setValue(nextValue);
              setInputValue(formatColorInput(nextValue, format));
              setIsCustom(true);
              return;
            }
            setIsCustom(false);
            setValue(next);
            setInputValue(formatColorInput(next, format));
          }}
          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
        >
          <option value="">Select colour</option>
          <option value="custom">Custom</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <input type="hidden" name={name} value={value} />
        {showPreview && (
          <div
            className="mt-2 h-9 w-full rounded border border-zinc-200"
            style={{ backgroundColor: normalized }}
          />
        )}
        {isCustomMode && (
          <div className="mt-2 space-y-2">
            <input
              type="color"
              value={toHexColor(value)}
              onChange={(event) => {
                const nextValue = toHexColor(event.target.value);
                setValue(nextValue);
                setInputValue(formatColorInput(nextValue, format));
              }}
              className="h-9 w-full cursor-pointer rounded border border-zinc-200 bg-white"
            />
            <input
              type="text"
              value={inputValue}
              onChange={(event) => {
                const raw = event.target.value;
                if (format === "hex") {
                  const sanitized = sanitizeHexInput(raw).toLowerCase();
                  setInputValue(sanitized);
                  const parsed = parseHexInput(sanitized);
                  if (parsed) setValue(parsed);
                  return;
                }
                setInputValue(raw);
                const parsed = format === "rgb" ? parseRgbInput(raw) : parseCmykInput(raw);
                if (parsed) setValue(parsed);
              }}
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
              placeholder={placeholder}
            />
            <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Format</div>
            <select
              value={format}
              onChange={(event) => {
                const nextFormat = event.target.value as ColorFormat;
                setFormat(nextFormat);
                setInputValue(formatColorInput(value, nextFormat));
              }}
              className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
            >
              {COLOR_FORMAT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </label>
    );
  };

  return (
    <div className="space-y-4">
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 text-[11px] uppercase tracking-[0.2em] text-zinc-500">
              <tr>
                <th className="px-3 py-3 text-left">Order #</th>
                <th className="px-3 py-3 text-left">Title</th>
                <th className="px-3 py-3 text-left">Date required</th>
                <th className="px-3 py-3 text-left">Order description</th>
                <th className="px-3 py-3 text-left">Order weight</th>
                <th className="px-3 py-3 text-left">Pickup</th>
                <th className="px-3 py-3 text-left">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
            {listOrders.map((order) => {
                const printTarget = order.id ?? order.order_number;
                return (
                  <Fragment key={order.id}>
                    <tr
                      className={`cursor-pointer bg-white hover:bg-zinc-50 ${
                        selectedId === order.id ? "bg-zinc-50" : ""
                      }`}
                      onClick={() => setSelectedId((prev) => (prev === order.id ? null : order.id))}
                    >
                      <td className="px-3 py-2 font-semibold text-zinc-900">
                        <div className="flex items-center gap-2">
                          <span>
                            {order.order_number
                              ? `#${order.order_number}`
                              : order.id
                                ? `#${order.id.slice(0, 8)}`
                                : "-"}
                          </span>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusBadge(
                              getScheduleStatus(order)
                            )}`}
                          >
                            {getScheduleStatus(order)}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-zinc-800">{order.title ?? "Untitled"}</td>
                      <td className="px-3 py-2 text-zinc-700">{formatDate(order.due_date)}</td>
                      <td className="px-3 py-2 text-zinc-700">{formatOrderDescription(order)}</td>
                      <td className="px-3 py-2 text-zinc-700">{weightLabel(order.total_weight_kg)}</td>
                      <td className="px-3 py-2 text-zinc-700">{order.pickup ? "Pickup" : "Delivery"}</td>
                      <td className="px-3 py-2 text-zinc-700">{order.state ?? order.location ?? ""}</td>
                    </tr>
                    {selectedId === order.id && (
                      <tr className="bg-white">
                        <td colSpan={7} className="px-3 pb-4">
                          <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                            {(() => {
                              const nameFallback = splitCustomerName(order.customer_name);
                              const firstNameValue = (order.first_name ?? nameFallback.first).trim();
                              const lastNameValue = (order.last_name ?? nameFallback.last).trim();
                              const isDelivery = pickupMode === "off";
                              const pricing = pricingBreakdowns[order.id] ?? null;
                              const totalPrice = formatMoney(order.total_price ?? pricing?.total ?? null);
                              const weightG = Number.isFinite(Number(order.total_weight_kg ?? NaN))
                                ? Math.round(Number(order.total_weight_kg) * 1000)
                                : "";
                              const activeCategoryId = orderCategoryId || order.category_id || "";
                              const isWedding = activeCategoryId.startsWith("weddings");
                              const isBranded = activeCategoryId === "branded";
                              const textColorOptions = buildColorOptions(colorOptions, textColorValue);
                              const heartColorOptions = buildColorOptions(colorOptions, heartColorValue);
                              const jacketColorOneOptions = buildColorOptions(colorOptions, jacketColorOneValue);
                              const jacketColorTwoOptions = buildColorOptions(colorOptions, jacketColorTwoValue);
                              const textColorSelectValue = textColorCustom ? "custom" : selectValueForColor(textColorValue);
                              const heartColorSelectValue = heartColorCustom ? "custom" : selectValueForColor(heartColorValue);
                              const jacketColorOneSelectValue = jacketColorOneCustom
                                ? "custom"
                                : selectValueForColor(jacketColorOneValue);
                              const jacketColorTwoSelectValue = jacketColorTwoCustom
                                ? "custom"
                                : selectValueForColor(jacketColorTwoValue);
                              const flavorOptions =
                                order.flavor && !flavors.some((item) => item.name === order.flavor)
                                  ? [order.flavor, ...flavors.map((item) => item.name)]
                                  : flavors.map((item) => item.name);

                              return (
                                <form key={`${order.id}-${editKey}`} action={upsertOrder} className="space-y-4">
                                  <input type="hidden" name="id" value={order.id} />
                                  <input type="hidden" name="status" value={order.status ?? "pending"} />
                                  <input type="hidden" name="redirect_to" value="/admin/orders" />
                                  <input type="hidden" name="toast_success" value="Order updated." />
                                  <input type="hidden" name="toast_error" value="Failed to update order." />
                                  <fieldset disabled={!isEditing} className="space-y-4">
                                  <div className="grid gap-6 md:grid-cols-3">
                                    <div className="space-y-3">
                                      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Customer details</p>
                                      <div className="space-y-2">
                                        <label className="block text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                                          Delivery / Pickup
                                          {isEditing ? (
                                            <select
                                              name="pickup"
                                              value={pickupMode}
                                              onChange={(event) =>
                                                setPickupMode(event.target.value === "on" ? "on" : "off")
                                              }
                                              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
                                            >
                                              <option value="off">Delivery</option>
                                              <option value="on">Pickup</option>
                                            </select>
                                          ) : (
                                            <p className="mt-1 text-sm text-zinc-900">
                                              {pickupMode === "on" ? "Pickup" : "Delivery"}
                                            </p>
                                          )}
                                        </label>
                                        <div className="grid gap-2 md:grid-cols-2">
                                          <label className="block text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                                            First name
                                            {isEditing ? (
                                              <input
                                                name="first_name"
                                                defaultValue={firstNameValue}
                                                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
                                              />
                                            ) : (
                                              <p className="mt-1 text-sm text-zinc-900">{firstNameValue || "-"}</p>
                                            )}
                                          </label>
                                          <label className="block text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                                            Last name
                                            {isEditing ? (
                                              <input
                                                name="last_name"
                                                defaultValue={lastNameValue}
                                                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
                                              />
                                            ) : (
                                              <p className="mt-1 text-sm text-zinc-900">{lastNameValue || "-"}</p>
                                            )}
                                          </label>
                                        </div>
                                        <label className="block text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                                          Email
                                          {isEditing ? (
                                            <input
                                              type="email"
                                              name="customer_email"
                                              defaultValue={order.customer_email ?? ""}
                                              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
                                            />
                                          ) : (
                                            <p className="mt-1 text-sm text-zinc-900">{order.customer_email ?? "-"}</p>
                                          )}
                                        </label>
                                        <label className="block text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                                          Phone
                                          {isEditing ? (
                                            <input
                                              type="tel"
                                              name="phone"
                                              defaultValue={order.phone ?? ""}
                                              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
                                            />
                                          ) : (
                                            <p className="mt-1 text-sm text-zinc-900">{order.phone ?? "-"}</p>
                                          )}
                                        </label>
                                        <div>
                                          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Address</p>
                                          {isDelivery ? (
                                            isEditing ? (
                                              <div className="mt-1 space-y-2">
                                                <input
                                                  name="address_line1"
                                                  defaultValue={order.address_line1 ?? ""}
                                                  className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
                                                  placeholder="Address line 1"
                                                />
                                                <input
                                                  name="address_line2"
                                                  defaultValue={order.address_line2 ?? ""}
                                                  className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
                                                  placeholder="Address line 2"
                                                />
                                                <div className="grid gap-2 md:grid-cols-3">
                                                  <input
                                                    name="suburb"
                                                    defaultValue={order.suburb ?? ""}
                                                    className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
                                                    placeholder="Suburb"
                                                  />
                                                  <input
                                                    name="state"
                                                    defaultValue={order.state ?? ""}
                                                    className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
                                                    placeholder="State"
                                                  />
                                                  <input
                                                    name="postcode"
                                                    defaultValue={order.postcode ?? ""}
                                                    className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
                                                    placeholder="Postcode"
                                                  />
                                                </div>
                                              </div>
                                            ) : (
                                              <div className="mt-1 space-y-1 text-sm text-zinc-900">
                                                <p>{order.address_line1?.trim() || "-"}</p>
                                                {order.address_line2?.trim() ? <p>{order.address_line2.trim()}</p> : null}
                                                <p>
                                                  {[order.suburb, order.state, order.postcode].filter(Boolean).join(" ") ||
                                                    "-"}
                                                </p>
                                              </div>
                                            )
                                          ) : (
                                            <>
                                              <p className="mt-1 text-xs text-zinc-500">Pickup</p>
                                              <input type="hidden" name="address_line1" value="" />
                                              <input type="hidden" name="address_line2" value="" />
                                              <input type="hidden" name="suburb" value="" />
                                              <input type="hidden" name="state" value="" />
                                              <input type="hidden" name="postcode" value="" />
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="space-y-3">
                                      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Order details</p>
                                      <div className="space-y-2">
                                        <div>
                                          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Order #</p>
                                          <p className="mt-1 text-sm font-semibold text-zinc-900">
                                            {order.order_number
                                              ? `#${order.order_number}`
                                              : order.id
                                                ? `#${order.id.slice(0, 8)}`
                                                : "-"}
                                          </p>
                                        </div>
                                        <label className="block text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                                          Date required
                                          {isEditing ? (
                                            <input
                                              type="date"
                                              name="due_date"
                                              defaultValue={formatDateInput(order.due_date)}
                                              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
                                            />
                                          ) : (
                                            <p className="mt-1 text-sm text-zinc-900">{formatDate(order.due_date) || "-"}</p>
                                          )}
                                        </label>
                                        <div>
                                          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                                            Date ordered
                                          </p>
                                          <p className="mt-1 text-sm text-zinc-900">
                                            {formatDate(order.created_at) || "-"}
                                          </p>
                                        </div>
                                        <label className="block text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                                          Order weight (g)
                                          {isEditing ? (
                                            <input
                                              type="number"
                                              name="order_weight_g"
                                              min={1}
                                              required
                                              defaultValue={weightG}
                                              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
                                            />
                                          ) : (
                                            <p className="mt-1 text-sm text-zinc-900">{weightG ? `${weightG}` : "-"}</p>
                                          )}
                                        </label>
                                        <label className="block text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                                          Flavour
                                          {isEditing ? (
                                            <select
                                              name="flavor"
                                              defaultValue={order.flavor ?? ""}
                                              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
                                            >
                                              <option value="">Select flavour</option>
                                              {flavorOptions.map((name) => (
                                                <option key={name} value={name}>
                                                  {name}
                                                </option>
                                              ))}
                                            </select>
                                          ) : (
                                            <p className="mt-1 text-sm text-zinc-900">{order.flavor ?? "-"}</p>
                                          )}
                                        </label>
                                      </div>
                                      <div className="space-y-2">
                                        <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                                          Colours & info
                                        </p>
                                        <label className="block text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                                          Text / design
                                          {isEditing ? (
                                            <input
                                              name="design_text"
                                              defaultValue={order.design_text ?? ""}
                                              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
                                            />
                                          ) : (
                                            <p className="mt-1 text-sm text-zinc-900">{order.design_text ?? "-"}</p>
                                          )}
                                        </label>
                                        <label className="block text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                                          Jacket
                                          {isEditing ? (
                                            <select
                                              name="jacket"
                                              value={jacketMode}
                                              onChange={(event) => setJacketMode(event.target.value)}
                                              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
                                            >
                                              {JACKET_OPTIONS.map((option) => (
                                                <option key={option.value || "none"} value={option.value}>
                                                  {option.label}
                                                </option>
                                              ))}
                                            </select>
                                          ) : (
                                            <p className="mt-1 text-sm text-zinc-900">
                                              {jacketLabelByValue.get(jacketMode) ?? jacketMode ?? "-"}
                                            </p>
                                          )}
                                        </label>
                                        <div className="grid gap-2 md:grid-cols-2">
                                          {renderColorField({
                                            label: "Jacket colour 1",
                                            name: "jacket_color_one",
                                            value: jacketColorOneValue,
                                            selectValue: jacketColorOneSelectValue,
                                            options: jacketColorOneOptions,
                                            inputValue: jacketColorOneInput,
                                            format: jacketColorOneFormat,
                                            isCustom: jacketColorOneCustom,
                                            setValue: setJacketColorOneValue,
                                            setInputValue: setJacketColorOneInput,
                                            setFormat: setJacketColorOneFormat,
                                            setIsCustom: setJacketColorOneCustom,
                                          })}
                                          {showJacketColorTwo && (
                                            renderColorField({
                                              label: "Jacket colour 2",
                                              name: "jacket_color_two",
                                              value: jacketColorTwoValue,
                                              selectValue: jacketColorTwoSelectValue,
                                              options: jacketColorTwoOptions,
                                              inputValue: jacketColorTwoInput,
                                              format: jacketColorTwoFormat,
                                              isCustom: jacketColorTwoCustom,
                                              setValue: setJacketColorTwoValue,
                                              setInputValue: setJacketColorTwoInput,
                                              setFormat: setJacketColorTwoFormat,
                                              setIsCustom: setJacketColorTwoCustom,
                                            })
                                          )}
                                        </div>
                                        {!showJacketColorTwo && (
                                          <input type="hidden" name="jacket_color_two" value="" />
                                        )}
                                        {!isBranded && (
                                          renderColorField({
                                            label: "Text colour",
                                            name: "text_color",
                                            value: textColorValue,
                                            selectValue: textColorSelectValue,
                                            options: textColorOptions,
                                            inputValue: textColorInput,
                                            format: textColorFormat,
                                            isCustom: textColorCustom,
                                            setValue: setTextColorValue,
                                            setInputValue: setTextColorInput,
                                            setFormat: setTextColorFormat,
                                            setIsCustom: setTextColorCustom,
                                          })
                                        )}
                                        {isWedding && (
                                          renderColorField({
                                            label: "Heart colour",
                                            name: "heart_color",
                                            value: heartColorValue,
                                            selectValue: heartColorSelectValue,
                                            options: heartColorOptions,
                                            inputValue: heartColorInput,
                                            format: heartColorFormat,
                                            isCustom: heartColorCustom,
                                            setValue: setHeartColorValue,
                                            setInputValue: setHeartColorInput,
                                            setFormat: setHeartColorFormat,
                                            setIsCustom: setHeartColorCustom,
                                          })
                                        )}
                                        <input type="hidden" name="order_description" value={order.order_description ?? ""} />
                                      </div>
                                    </div>

                                    <div className="space-y-3">
                                      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Packaging info</p>
                                      <div className="space-y-2">
                                        <label className="block text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                                          Order type
                                          {isEditing ? (
                                            <select
                                              name="category_id"
                                              value={orderCategoryId}
                                              onChange={(event) => setOrderCategoryId(event.target.value)}
                                              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
                                            >
                                              <option value="">Select order type</option>
                                              {orderCategoryOptions.map((category) => (
                                                <option key={category.id} value={category.id}>
                                                  {category.name}
                                                </option>
                                              ))}
                                            </select>
                                          ) : (
                                            <p className="mt-1 text-sm text-zinc-900">
                                              {orderCategoryId
                                                ? categoryLabelById.get(orderCategoryId) ?? orderCategoryId
                                                : "-"}
                                            </p>
                                          )}
                                        </label>
                                        <label className="block text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                                          Packaging type
                                          {isEditing ? (
                                            <select
                                              value={packagingType}
                                              onChange={(event) => setPackagingType(event.target.value)}
                                              disabled={!orderCategoryId || packagingTypes.length === 0}
                                              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
                                            >
                                              <option value="">
                                                {!orderCategoryId
                                                  ? "Select order type first"
                                                  : packagingTypes.length
                                                    ? "Select packaging type"
                                                    : "No packaging types"}
                                              </option>
                                              {packagingTypes.map((type) => (
                                                <option key={type} value={type}>
                                                  {type}
                                                </option>
                                              ))}
                                            </select>
                                          ) : (
                                            <p className="mt-1 text-sm text-zinc-900">{packagingType || "-"}</p>
                                          )}
                                        </label>
                                        <label className="block text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                                          Packaging size
                                          {isEditing ? (
                                            <select
                                              value={packagingSize}
                                              onChange={(event) => setPackagingSize(event.target.value)}
                                              disabled={!packagingType || sizesForType.length === 0}
                                              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
                                            >
                                              <option value="">
                                                {!packagingType
                                                  ? "Select packaging type first"
                                                  : sizesForType.length
                                                    ? "Select size"
                                                    : "No sizes"}
                                              </option>
                                              {sizesForType.map((option) => (
                                                <option key={option.id} value={option.size}>
                                                  {formatSizeLabel(option.type, option.size)}
                                                </option>
                                              ))}
                                            </select>
                                          ) : (
                                            <p className="mt-1 text-sm text-zinc-900">
                                              {packagingSize ? formatSizeLabel(packagingType, packagingSize) : "-"}
                                            </p>
                                          )}
                                        </label>
                                        <input type="hidden" name="packaging_option_id" value={selectedPackagingOptionId} />
                                        <label className="block text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                                          Quantity
                                          {isEditing ? (
                                            <input
                                              type="number"
                                              name="quantity"
                                              min={1}
                                              max={Number.isFinite(maxPackages ?? NaN) ? Number(maxPackages) : undefined}
                                              value={quantityInput}
                                              onChange={(event) => setQuantityInput(event.target.value)}
                                              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
                                            />
                                          ) : (
                                            <p className="mt-1 text-sm text-zinc-900">
                                              {formatQuantity(Number(quantityInput) || order.quantity) || "-"}
                                            </p>
                                          )}
                                          {isEditing && Number.isFinite(maxPackages ?? NaN) && Number(maxPackages) > 0 ? (
                                            <p className="mt-1 text-[10px] font-semibold text-zinc-500">
                                              Max {Number(maxPackages)}
                                            </p>
                                          ) : null}
                                        </label>
                                        {isJarOption ? (
                                          <label className="block text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                                            Lid colour
                                            {isEditing ? (
                                              <select
                                                name="jar_lid_color"
                                                value={jarLidColorValue}
                                                onChange={(event) => setJarLidColorValue(event.target.value)}
                                                disabled={availableLidColors.length === 0}
                                                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
                                              >
                                                <option value="">
                                                  {availableLidColors.length ? "Select lid colour" : "No lid options"}
                                                </option>
                                                {availableLidColors.map((lid) => (
                                                  <option key={lid} value={lid}>
                                                    {lid}
                                                  </option>
                                                ))}
                                              </select>
                                            ) : (
                                              <p className="mt-1 text-sm text-zinc-900">{jarLidColorValue || "-"}</p>
                                            )}
                                          </label>
                                        ) : (
                                          <input type="hidden" name="jar_lid_color" value="" />
                                        )}
                                      </div>
                                      <div className="space-y-2">
                                        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Pricing details</p>
                                        <div>
                                          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                                            Payment method
                                          </p>
                                          <p className="mt-1 text-sm text-zinc-900">{order.payment_method ?? "-"}</p>
                                        </div>
                                        {pricing ? (
                                          <div className="space-y-1 text-xs text-zinc-600">
                                            {pricing.items.map((item) => (
                                              <div key={item.label} className="flex items-center justify-between">
                                                <span>{item.label}</span>
                                                <span>{formatMoney(item.amount)}</span>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="text-xs text-zinc-500">Pricing breakdown unavailable.</p>
                                        )}
                                        <div className="flex items-center justify-between text-sm font-semibold text-zinc-900">
                                          <span>Total</span>
                                          <span>{totalPrice}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {order.notes && (
                                    <div>
                                      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Notes</p>
                                      <p>{order.notes}</p>
                                    </div>
                                  )}
                                  </fieldset>
                                  <div className="flex flex-wrap items-center gap-2">
                                    {isEditing ? (
                                      <>
                                        <button
                                          type="submit"
                                          className="inline-flex items-center rounded-lg border border-zinc-900 bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
                                        >
                                          Save changes
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            syncEditableState(order);
                                            setIsEditing(false);
                                            setEditKey((prev) => prev + 1);
                                          }}
                                          className="inline-flex items-center rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                                        >
                                          Cancel
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          syncEditableState(order);
                                          setIsEditing(true);
                                          setEditKey((prev) => prev + 1);
                                        }}
                                        className="inline-flex items-center rounded-lg border border-zinc-900 bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
                                      >
                                        Edit
                                      </button>
                                    )}
                                    {order.paid_at && order.payment_transaction_id && !order.refunded_at ? (
                                      <form action={refundOrder}>
                                        <input type="hidden" name="id" value={order.id} />
                                        <button
                                          type="submit"
                                          className="inline-flex items-center rounded-lg border border-red-600 bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
                                        >
                                          Refund payment
                                        </button>
                                      </form>
                                    ) : null}
                                    {printTarget ? (
                                      <a
                                        href={`/admin/orders/${encodeURIComponent(printTarget)}/print?id=${encodeURIComponent(printTarget)}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                                      >
                                        Print order
                                      </a>
                                    ) : (
                                      <span className="text-xs text-zinc-500">Print unavailable</span>
                                    )}
                                  </div>
                                </form>
                              );
                            })()}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
      </div>

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
                        {/* blocked label is shown inside the bubble */}
                      </div>
                      {/* reason is shown inside the blocked bubble */}
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
                            <div className="mb-2">
                              <form action={addManualBlock}>
                                <input type="hidden" name="date" value={key} />
                                <button
                                  type="submit"
                                  className="rounded border border-zinc-200 bg-white px-2 py-1 text-[10px] font-semibold text-zinc-600 hover:border-zinc-300"
                                >
                                  Block day
                                </button>
                              </form>
                            </div>
                            {Array.from({ length: slotsPerDay }, (_, idx) => {
                              const slotIndex = idx + 1;
                              const slotKey = `${key}:${slotIndex}`;
                              const assignment = assignmentBySlotKey.get(slotKey);
                              const order = assignment ? ordersById.get(assignment.order_id) : null;
                              const label =
                                order?.title ||
                                (order ? formatOrderDescription(order) : "") ||
                                order?.order_number ||
                                "Order";
                              const isPastSlot = key < todayKey;
                              return (
                                <div key={slotKey} className="rounded border border-dashed border-zinc-200 p-1">
                                  {assignment && order ? (
                                    <div
                                      className={`rounded-md border px-2 py-1 text-[10px] ${statusCard(
                                        getScheduleStatus(order),
                                      )}`}
                                    >
                                      <p className="font-semibold text-zinc-900">{label}</p>
                                      <p className="text-zinc-600">
                                        {weightLabel(order.total_weight_kg)} - Due {formatDate(order.due_date)}
                                      </p>
                                      {!isPastSlot && (
                                        <form action={deleteAssignment} className="mt-1">
                                          <input type="hidden" name="assignment_id" value={assignment.id} />
                                          <button
                                            type="submit"
                                            className="text-[10px] font-semibold text-red-600 underline underline-offset-2"
                                          >
                                            Unassign
                                          </button>
                                        </form>
                                      )}
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={isPastSlot}
                                      onClick={() => setSlotPicker({ date: key, slotIndex })}
                                      className={`w-full rounded px-2 py-1 text-[10px] font-semibold ${
                                        isPastSlot
                                          ? "border border-zinc-200 bg-zinc-100 text-zinc-400"
                                          : "border border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800"
                                      }`}
                                    >
                                      {isPastSlot ? "Past date" : "Assign"}
                                    </button>
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
                      {/* blocked label is shown inside the bubble */}
                    </div>
                    {/* reason is shown inside the blocked bubble */}
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
                      <>
                        <form action={addManualBlock}>
                          <input type="hidden" name="date" value={key} />
                          <button
                            type="submit"
                            className="rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-600 hover:border-zinc-300"
                          >
                            Block day
                          </button>
                        </form>
                      <div className="mt-3 grid gap-2">
                        {Array.from({ length: slotsPerDay }, (_, idx) => {
                          const slotIndex = idx + 1;
                          const slotKey = `${key}:${slotIndex}`;
                          const assignment = assignmentBySlotKey.get(slotKey);
                          const order = assignment ? ordersById.get(assignment.order_id) : null;
                          const slotLabel = `Slot ${slotIndex}`;
                          const orderLabel =
                            order?.title || (order ? formatOrderDescription(order) : "") || order?.order_number || "Order";
                          const isPastSlot = key < todayKey;
                          return (
                            <div key={slotKey} className="rounded border border-dashed border-zinc-200 px-3 py-2 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-zinc-700">{slotLabel}</span>
                                {assignment && order ? (
                                  <span className="text-zinc-500">{weightLabel(order.total_weight_kg)}</span>
                                ) : (
                                  <span className="text-zinc-400">Empty</span>
                                )}
                              </div>
                              {assignment && order ? (
                                <div className={`mt-1 rounded-md border px-2 py-1 ${statusCard(getScheduleStatus(order))}`}>
                                  <p className="font-semibold text-zinc-900">{orderLabel}</p>
                                  <p>Due {formatDate(order.due_date)}</p>
                                  {!isPastSlot && (
                                    <form action={deleteAssignment} className="mt-1">
                                      <input type="hidden" name="assignment_id" value={assignment.id} />
                                      <button
                                        type="submit"
                                        className="text-[11px] font-semibold text-red-600 underline underline-offset-2"
                                      >
                                        Unassign
                                      </button>
                                    </form>
                                  )}
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isPastSlot}
                                  onClick={() => setSlotPicker({ date: key, slotIndex })}
                                  className={`mt-2 rounded px-2 py-1 text-[11px] font-semibold ${
                                    isPastSlot
                                      ? "border border-zinc-200 bg-zinc-100 text-zinc-400"
                                      : "border border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800"
                                  }`}
                                >
                                  {isPastSlot ? "Past date" : "Assign"}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      </>
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
                  unassignedOrders.map((order) => (
                    <form key={order.id} action={assignOrderToSlot}>
                      <input type="hidden" name="order_id" value={order.id} />
                      <input type="hidden" name="slot_date" value={slotPicker.date} />
                      <input type="hidden" name="slot_index" value={slotPicker.slotIndex} />
                      <input type="hidden" name="kg_assigned" value={Number(order.total_weight_kg) || 0} />
                      <button
                        type="submit"
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left text-xs font-semibold text-zinc-800 hover:border-zinc-300"
                      >
                        {order.title ?? "Untitled"}
                      </button>
                    </form>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
























