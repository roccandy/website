"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { ImageOptimizationStatus } from "@/components/ImageOptimizationStatus";
import AssignmentCalendarModal from "@/app/admin/orders/AssignmentCalendarModal";
import { CandyPreview } from "@/app/quote/CandyPreview";
import {
  analyzeImageOptimization,
  fileToDataUrl,
  formatBytes,
  optimizeBrowserImageToDataUrl,
  type ImageOptimizationSummary,
} from "@/lib/clientImageOptimization";
import type {
  Category,
  ColorPaletteRow,
  Flavor,
  OrderRow,
  OrderSlot,
  PackagingOption,
  PremadeCandy,
  ProductionSlot,
  SettingsRow,
} from "@/lib/data";
import {
  ADMIN_PREMADE_CATEGORY_ID,
  ADMIN_PREMADE_ORDER_LABEL,
  ADMIN_PREMADE_ORDER_MARKER,
  isAdminPremadeOrder as isAdminPremadeOrderRow,
} from "@/lib/adminPremadeOrder";
import {
  MAX_ADMIN_BATCH_COUNT,
  suggestedAdminBatchWeights,
  type AdminDiscountType,
} from "@/lib/adminLargeOrders";
import { upsertOrder } from "../actions";
import { formatFullDateLabel, formatOrderDescription } from "../productionScheduleShared";
import { paletteSections } from "@/app/admin/settings/palette";
import { LONG_CUSTOM_TEXT_MAX_LENGTH, SHORT_CUSTOM_TEXT_MAX_LENGTH } from "@/app/quote/quoteBuilderShared";
import { hasIngredientLabelsRequested } from "@/lib/customPricingInput";
import { isAdminManagedCustomOrder } from "../scheduleVisibility";
const BULK_LABEL_COUNT_MAX = 1000;
const WEDDING_HEART = "❤️";

const STATES = [
  { value: "", label: "Select state" },
  { value: "ACT", label: "ACT" },
  { value: "NSW", label: "NSW" },
  { value: "NT", label: "NT" },
  { value: "QLD", label: "QLD" },
  { value: "SA", label: "SA" },
  { value: "TAS", label: "TAS" },
  { value: "VIC", label: "VIC" },
  { value: "WA", label: "WA" },
];

const JACKET_OPTIONS = [
  { value: "", label: "Single colour" },
  { value: "two_colour", label: "Two colour" },
  { value: "pinstripe", label: "Pin stripe" },
  { value: "two_colour_pinstripe", label: "Two colour + Pin stripe" },
  { value: "rainbow", label: "Rainbow" },
];

type AdminQuoteResponse = {
  total: number;
  totalWeightKg: number;
  subtotalBeforeDiscount?: number;
  discountAmount?: number;
  batchWeightsKg?: number[];
  items?: Array<{ label: string; amount: number }>;
  error?: string;
};

type PaletteOption = {
  id: string;
  label: string;
  hex: string;
};

type PaletteGroup = {
  title: string;
  options: PaletteOption[];
};

type Cmyk = {
  c: number;
  m: number;
  y: number;
  k: number;
};

type Rgba = {
  r: number;
  g: number;
  b: number;
  a: number;
};

function getPaletteHex(
  palette: ColorPaletteRow[],
  category: string,
  shade: string,
  fallback: string,
) {
  const found = palette.find((row) => row.category === category && row.shade === shade);
  return found?.hex ?? fallback;
}

function buildPaletteGroups(palette: ColorPaletteRow[]): PaletteGroup[] {
  const lookup = new Map(palette.map((row) => [`${row.category}:${row.shade}`, row.hex]));
  return paletteSections.map((section) => ({
    title: section.title,
    options: section.items.map((item) => ({
      id: item.name,
      label: item.label,
      hex: lookup.get(`${item.categoryKey}:${item.shadeKey}`) ?? item.defaultValue,
    })),
  }));
}

function clampChannel(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function clampByte(value: number) {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function clampAlpha(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

function hexToCmyk(hex: string): Cmyk | null {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return null;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const k = 1 - Math.max(r, g, b);
  if (k === 1) {
    return { c: 0, m: 0, y: 0, k: 100 };
  }
  const c = (1 - r - k) / (1 - k);
  const m = (1 - g - k) / (1 - k);
  const y = (1 - b - k) / (1 - k);
  return {
    c: clampChannel(c * 100),
    m: clampChannel(m * 100),
    y: clampChannel(y * 100),
    k: clampChannel(k * 100),
  };
}

function cmykToHex(cmyk: Cmyk): string {
  const c = clampChannel(cmyk.c) / 100;
  const m = clampChannel(cmyk.m) / 100;
  const y = clampChannel(cmyk.y) / 100;
  const k = clampChannel(cmyk.k) / 100;
  const r = Math.round(255 * (1 - c) * (1 - k));
  const g = Math.round(255 * (1 - m) * (1 - k));
  const b = Math.round(255 * (1 - y) * (1 - k));
  const toHex = (value: number) => value.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToRgba(hex: string, alpha = 1): Rgba | null {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return null;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b, a: clampAlpha(alpha) };
}

function rgbaToHex(rgba: Rgba): string {
  const r = clampByte(rgba.r);
  const g = clampByte(rgba.g);
  const b = clampByte(rgba.b);
  const toHex = (value: number) => value.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function normalizeHex(value: string, fallback: string) {
  const raw = value.trim().toLowerCase();
  if (!raw) return fallback;
  const withHash = raw.startsWith("#") ? raw : `#${raw}`;
  if (/^#[0-9a-f]{3}$/.test(withHash)) {
    const [, r, g, b] = withHash;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  if (/^#[0-9a-f]{6}$/.test(withHash)) {
    return withHash;
  }
  return fallback;
}

function parseHexInput(value: string): string | null {
  const raw = value.trim().toLowerCase();
  if (!raw) return null;
  const withHash = raw.startsWith("#") ? raw : `#${raw}`;
  if (/^#[0-9a-f]{3}$/.test(withHash)) {
    const [, r, g, b] = withHash;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  if (/^#[0-9a-f]{6}$/.test(withHash)) {
    return withHash;
  }
  return null;
}

function sanitizeHexInput(value: string): string {
  const stripped = value.replace(/#/g, "").replace(/[^0-9a-f]/gi, "").slice(0, 6);
  return `#${stripped}`;
}

function formatPremadeWeight(weightG: number) {
  if (!Number.isFinite(weightG) || weightG <= 0) return "";
  if (weightG >= 1000) {
    const kg = weightG / 1000;
    return `${kg % 1 === 0 ? kg.toFixed(0) : kg.toFixed(1)}kg`;
  }
  return `${weightG}g`;
}

function formatPremadeLabel(item: PremadeCandy) {
  const weightLabel = formatPremadeWeight(Number(item.weight_g));
  const parts = [item.name, weightLabel].filter(Boolean);
  return parts.join(" - ");
}

const formatInputNumber = (value: number | null | undefined, decimals = 2) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "";
  const fixed = parsed.toFixed(decimals);
  return fixed.includes(".") ? fixed.replace(/\.?0+$/, "") : fixed;
};

const formatMoneyValue = (value: number | null | undefined) =>
  Number.isFinite(value ?? NaN) ? `$${Number(value).toFixed(2)}` : "$0.00";

const formatCompactBytes = (bytes: number | null | undefined) =>
  formatBytes(Number(bytes ?? 0)).replace(/\s+/g, "").toLowerCase();

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

const normalizeDiscountType = (value: string | null | undefined): AdminDiscountType => {
  if (value === "percent" || value === "fixed") return value;
  return "none";
};

const dateInputValue = (value: string | null | undefined) => {
  if (!value) return "";
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : value.slice(0, 10);
};

const splitWeddingDesign = (value: string | null | undefined) => {
  const normalized = (value ?? "")
    .replace(/[\u2665\u2764]\ufe0f?/g, WEDDING_HEART)
    .trim();
  const [left = "", right = ""] = normalized.split(WEDDING_HEART);
  return {
    left: left.trim(),
    right: right.trim(),
  };
};

const batchWeightsInputValues = (order: OrderRow | null | undefined) =>
  Array.isArray(order?.admin_batch_weights_kg)
    ? order.admin_batch_weights_kg
        .map((weight) => Number(weight))
        .filter((weight) => Number.isFinite(weight) && weight > 0)
        .map((weight) => weight.toFixed(2))
    : [];

const batchWeightsLabel = (weights: Array<number | string | null | undefined>) => {
  const values = weights
    .map((weight) => Number(weight))
    .filter((weight) => Number.isFinite(weight) && weight > 0)
    .map((weight) => `${formatInputNumber(weight)}kg`);
  return values.length > 0 ? values.join(" + ") : "-";
};

const valuesChanged = (next: string, current: string) => next.trim() !== current.trim();

function PalettePicker({
  label,
  value,
  onChange,
  groups,
  onCustom,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  groups: PaletteGroup[];
  onCustom: () => void;
}) {
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const flat = groups.flatMap((group) => group.options);
  const selected = flat.find((option) => option.hex.toLowerCase() === value.toLowerCase());
  const handleSelect = (hex: string) => {
    onChange(hex);
    if (detailsRef.current) {
      detailsRef.current.open = false;
    }
  };
  return (
    <details ref={detailsRef} className="rounded-lg border border-zinc-200 bg-white px-3 py-3">
      <summary className="flex min-h-8 cursor-pointer list-none items-center gap-3 text-xs font-semibold text-zinc-700">
        <span className="uppercase tracking-[0.2em] text-zinc-500">{label}</span>
        <span className="ml-auto flex items-center gap-2 text-[11px] font-medium text-zinc-600">
          <span>{selected?.label ?? "Custom"}</span>
          <span
            style={{
              width: 20,
              height: 20,
              backgroundColor: value,
              border: "1px solid #000",
              borderRadius: 9999,
              boxSizing: "border-box",
              flexShrink: 0,
              display: "inline-block",
            }}
          />
        </span>
      </summary>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="sr-only">{group.title}</p>
            <div className="mt grid grid-cols-3 gap-2 gap-2">
              {group.options.map((option) => {
                const isActive = option.hex.toLowerCase() === value.toLowerCase();
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleSelect(option.hex)}
                    className={`palette-swatch h-10 w-full rounded-full border ${
                      isActive ? "ring-2 ring-zinc-900 ring-offset-1" : ""
                    }`}
                    style={
                      {
                        backgroundColor: option.hex,
                        "--swatch": option.hex,
                        "--swatch-border": "#000000",
                      } as CSSProperties
                    }
                    aria-label={option.label}
                  >
                    <span className="sr-only">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <div>
          <p className="sr-only">Custom</p>
          <button
            type="button"
            data-neutral-button
            className="mt flex h-11 w-full items-center justify-center rounded-full px-3 text-[11px] font-semibold hover:text-zinc-800"
            onClick={onCustom}
          >
            Custom colour
          </button>
        </div>
      </div>
    </details>
  );
}

type Props = {
  categories: Category[];
  packagingOptions: PackagingOption[];
  flavors: Flavor[];
  palette: ColorPaletteRow[];
  premadeCandies: PremadeCandy[];
  settings: SettingsRow;
  orders: OrderRow[];
  slots: ProductionSlot[];
  assignments: OrderSlot[];
  mode?: "create" | "edit";
  initialOrder?: OrderRow | null;
  cancelHref?: string;
};

type InvoiceOrderDraft = {
  id: string;
  fields: Record<string, string>;
  batchWeights: string[];
};

type AdminPremadeMode = "" | "premade" | "custom";

const SHARED_INVOICE_FIELD_NAMES = new Set([
  "first_name",
  "last_name",
  "customer_email",
  "phone",
  "organization_name",
  "pickup",
  "address_line1",
  "address_line2",
  "suburb",
  "postcode",
  "state",
  "customer_note",
]);

const emptyInvoiceOrderDraft = (id: string): InvoiceOrderDraft => ({
  id,
  fields: {},
  batchWeights: [],
});

const draftLabel = (draft: InvoiceOrderDraft, index: number) =>
  draft.fields.title?.trim() ||
  draft.fields.design_text?.trim() ||
  `Order ${index + 1}`;

const draftValue = (draft: InvoiceOrderDraft | null | undefined, name: string, fallback = "") =>
  draft?.fields[name] ?? fallback;

const draftNumber = (value: string | null | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeAdminPremadeMode = (value: string | null | undefined): AdminPremadeMode => {
  if (value === "premade") return "premade";
  if (value === "custom" || value === "flavor") return "custom";
  return "";
};

const draftHasBatchWeightMismatch = (draft: InvoiceOrderDraft) => {
  const orderWeightG = draftNumber(draft.fields.order_weight_g);
  if (orderWeightG === null || draft.batchWeights.length === 0) return false;
  const orderWeightKg = orderWeightG / 1000;
  const batchTotalKg = draft.batchWeights.reduce((sum, value) => {
    const parsed = Number(value);
    return sum + (Number.isFinite(parsed) ? parsed : 0);
  }, 0);
  return Math.abs(batchTotalKg - orderWeightKg) > 0.02;
};

const orderTitleFromDetails = ({
  categoryId,
  designText,
  organizationName,
  fallback,
}: {
  categoryId: string;
  designText: string;
  organizationName: string;
  fallback: string;
}) => {
  if (categoryId === "branded") return organizationName.trim() || null;
  if (categoryId.startsWith("custom-")) return designText.trim().toUpperCase() || fallback;
  return designText.trim() || fallback;
};

export function NewOrderForm({
  categories,
  packagingOptions,
  flavors,
  palette,
  premadeCandies,
  settings,
  orders,
  slots,
  assignments,
  mode = "create",
  initialOrder = null,
  cancelHref = "/admin/orders",
}: Props) {
  const isEditMode = mode === "edit" && Boolean(initialOrder);
  const initialIsAdminPremade = initialOrder ? isAdminPremadeOrderRow(initialOrder) : false;
  const initialCategoryId = initialIsAdminPremade ? ADMIN_PREMADE_CATEGORY_ID : initialOrder?.category_id ?? "";
  const initialWeddingDesign = splitWeddingDesign(initialOrder?.design_text);
  const customerDefaults = initialOrder;
  const invoiceDraftMode = !isEditMode;
  const editUrgencyReferenceDate = isEditMode ? initialOrder?.created_at ?? null : null;
  const initialInvoiceDraftIdRef = useRef(`order-${Date.now()}`);
  const [invoiceOrderDrafts, setInvoiceOrderDrafts] = useState<InvoiceOrderDraft[]>(() => [
    emptyInvoiceOrderDraft(initialInvoiceDraftIdRef.current),
  ]);
  const [activeInvoiceDraftId, setActiveInvoiceDraftId] = useState(initialInvoiceDraftIdRef.current);
  const [orderFieldsKey, setOrderFieldsKey] = useState(0);
  const [reviewMode, setReviewMode] = useState(false);
  const [sharedFirstName, setSharedFirstName] = useState(customerDefaults?.first_name ?? "");
  const [sharedLastName, setSharedLastName] = useState(customerDefaults?.last_name ?? "");
  const [sharedEmail, setSharedEmail] = useState(customerDefaults?.customer_email ?? "");
  const [sharedPhone, setSharedPhone] = useState(customerDefaults?.phone ?? "");
  const [sharedOrganizationName, setSharedOrganizationName] = useState(customerDefaults?.organization_name ?? "");
  const [sharedAddressLine1, setSharedAddressLine1] = useState(customerDefaults?.address_line1 ?? "");
  const [sharedAddressLine2, setSharedAddressLine2] = useState(customerDefaults?.address_line2 ?? "");
  const [sharedSuburb, setSharedSuburb] = useState(customerDefaults?.suburb ?? "");
  const [sharedPostcode, setSharedPostcode] = useState(customerDefaults?.postcode ?? "");
  const [sharedState, setSharedState] = useState(customerDefaults?.state ?? "");
  const [sharedCustomerNote, setSharedCustomerNote] = useState(customerDefaults?.customer_note ?? "");
  const formRef = useRef<HTMLFormElement | null>(null);
  const scheduleSubmitButtonRef = useRef<HTMLButtonElement | null>(null);
  const sendUpdatedInvoiceInputRef = useRef<HTMLInputElement | null>(null);
  const batchWeightMismatchApprovedInputRef = useRef<HTMLInputElement | null>(null);
  const previousPackagingOptionIdRef = useRef<string | null>(initialOrder?.packaging_option_id ?? null);
  const preserveInitialBatchWeightsRef = useRef(batchWeightsInputValues(initialOrder).length > 0);
  const defaultJacketColor = useMemo(() => getPaletteHex(palette, "grey", "light", "#d1d5db"), [palette]);
  const defaultTextColor = useMemo(() => getPaletteHex(palette, "grey", "light", "#b7b7b7"), [palette]);
  const paletteGroups = useMemo(() => buildPaletteGroups(palette), [palette]);
  const [deliveryMode, setDeliveryMode] = useState<"delivery" | "pickup">(customerDefaults?.pickup ? "pickup" : "delivery");
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [packagingOptionId, setPackagingOptionId] = useState(initialOrder?.packaging_option_id ?? "");
  const [quantity, setQuantity] = useState(initialOrder?.quantity ? formatInputNumber(initialOrder.quantity, 0) : "");
  const [customLabelsOptIn, setCustomLabelsOptIn] = useState(Boolean(Number(initialOrder?.labels_count) > 0));
  const [labelsCount, setLabelsCount] = useState(initialOrder?.labels_count ? formatInputNumber(initialOrder.labels_count, 0) : "");
  const [jarLidColor, setJarLidColor] = useState(initialOrder?.jar_lid_color ?? "");
  const [jacket, setJacket] = useState(initialOrder?.jacket ?? "");
  const [dueDate, setDueDate] = useState(dateInputValue(initialOrder?.due_date));
  const [productionSlotDate, setProductionSlotDate] = useState("");
  const [productionSlotPickerOpen, setProductionSlotPickerOpen] = useState(false);
  const [priceValue, setPriceValue] = useState(initialOrder?.total_price ? Number(initialOrder.total_price).toFixed(2) : "");
  const [weightValue, setWeightValue] = useState(
    initialOrder
      ? initialIsAdminPremade
        ? formatInputNumber(initialOrder.total_weight_kg)
        : formatInputNumber(Number(initialOrder.total_weight_kg) * 1000, 0)
      : "",
  );
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [isPricing, setIsPricing] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [batchWeights, setBatchWeights] = useState<string[]>(() => batchWeightsInputValues(initialOrder));
  const [discountType, setDiscountType] = useState<AdminDiscountType>(normalizeDiscountType(initialOrder?.admin_discount_type));
  const [discountValue, setDiscountValue] = useState(initialOrder?.admin_discount_value ? formatInputNumber(initialOrder.admin_discount_value) : "");
  const [priceOverride, setPriceOverride] = useState(initialOrder?.admin_price_override ? formatInputNumber(initialOrder.admin_price_override) : "");
  const [invoiceDiscountType, setInvoiceDiscountType] = useState<AdminDiscountType>("none");
  const [invoiceDiscountValue, setInvoiceDiscountValue] = useState("");
  const [invoicePriceOverride, setInvoicePriceOverride] = useState("");
  const [quoteItems, setQuoteItems] = useState<Array<{ label: string; amount: number }>>([]);
  const [weddingLineOne, setWeddingLineOne] = useState(initialWeddingDesign.left);
  const [weddingLineTwo, setWeddingLineTwo] = useState(initialWeddingDesign.right);
  const [customText, setCustomText] = useState(initialOrder?.category_id?.startsWith("custom-") ? initialOrder.design_text ?? "" : "");
  const [designText, setDesignText] = useState(
    initialOrder && !initialOrder.category_id?.startsWith("weddings") && !initialOrder.category_id?.startsWith("custom-") && initialOrder.category_id !== "branded"
      ? initialOrder.design_text ?? ""
      : "",
  );
  const [jacketColorOne, setJacketColorOne] = useState(initialOrder?.jacket_color_one ?? defaultJacketColor);
  const [jacketColorTwo, setJacketColorTwo] = useState(initialOrder?.jacket_color_two ?? defaultJacketColor);
  const [textColor, setTextColor] = useState(initialOrder?.text_color ?? defaultTextColor);
  const [heartColor, setHeartColor] = useState(initialOrder?.heart_color ?? defaultTextColor);
  const [flavor, setFlavor] = useState(initialOrder?.flavor ?? "");
  const [logoUrl, setLogoUrl] = useState(initialOrder?.logo_url ?? "");
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoSummary, setLogoSummary] = useState<ImageOptimizationSummary | null>(null);
  const [isOptimisingLogo, setIsOptimisingLogo] = useState(false);
  const [ingredientLabelsOptIn, setIngredientLabelsOptIn] = useState(
    Boolean(Number(initialOrder?.ingredient_labels_count) > 0) ||
      Boolean(initialOrder && hasIngredientLabelsRequested({ notes: initialOrder.notes })),
  );
  const [ingredientLabelsCount, setIngredientLabelsCount] = useState(
    initialOrder?.ingredient_labels_count ? formatInputNumber(initialOrder.ingredient_labels_count, 0) : "",
  );
  const [labelFileName, setLabelFileName] = useState(initialOrder?.label_image_url ? "Existing artwork" : "");
  const [labelImageUrl, setLabelImageUrl] = useState(initialOrder?.label_image_url ?? "");
  const [labelImageError, setLabelImageError] = useState<string | null>(null);
  const [labelImageSummary, setLabelImageSummary] = useState<ImageOptimizationSummary | null>(null);
  const [isOptimisingLabelImage, setIsOptimisingLabelImage] = useState(false);
  const [adminPremadeMode, setAdminPremadeMode] = useState<AdminPremadeMode>(
    initialIsAdminPremade ? "custom" : "",
  );
  const [adminPremadeCustomName, setAdminPremadeCustomName] = useState(
    initialIsAdminPremade
      ? initialOrder?.design_text?.trim() ||
        initialOrder?.title?.replace(/^premade stock\s*-\s*/i, "").trim() ||
        ""
      : "",
  );
  const [adminPremadeFlavor, setAdminPremadeFlavor] = useState(initialIsAdminPremade ? initialOrder?.flavor ?? "" : "");
  const [adminPremadeCandyId, setAdminPremadeCandyId] = useState("");
  const [customPickerOpen, setCustomPickerOpen] = useState(false);
  const [customTarget, setCustomTarget] = useState<"heart" | "text" | "jacket1" | "jacket2" | null>(null);
  const [customHex, setCustomHex] = useState(defaultJacketColor);
  const [customHexInput, setCustomHexInput] = useState(defaultJacketColor);
  const [submitAfterCalendarPick, setSubmitAfterCalendarPick] = useState(false);
  const [customCmyk, setCustomCmyk] = useState<Cmyk>(
    () => hexToCmyk(defaultJacketColor) ?? { c: 0, m: 0, y: 0, k: 0 },
  );
  const [customRgba, setCustomRgba] = useState<Rgba>(
    () => hexToRgba(defaultJacketColor) ?? { r: 0, g: 0, b: 0, a: 1 },
  );
  const [customInputMode, setCustomInputMode] = useState<"hex" | "cmyk" | "rgba">("hex");
  const activeInvoiceDraft = invoiceOrderDrafts.find((draft) => draft.id === activeInvoiceDraftId) ?? invoiceOrderDrafts[0] ?? null;
  const showAddress = deliveryMode === "delivery";
  const isAdminPremadeOrder = categoryId === ADMIN_PREMADE_CATEGORY_ID;
  const filteredPackagingOptions = useMemo(() => {
    if (isAdminPremadeOrder) return [];
    if (!categoryId) return packagingOptions;
    return packagingOptions.filter((option) => option.allowed_categories?.includes(categoryId));
  }, [categoryId, isAdminPremadeOrder, packagingOptions]);
  const selectedPackagingOption = useMemo(() => {
    return packagingOptions.find((option) => option.id === packagingOptionId) || null;
  }, [packagingOptions, packagingOptionId]);
  const initialPackagingOption = useMemo(() => {
    if (!initialOrder?.packaging_option_id) return null;
    return packagingOptions.find((option) => option.id === initialOrder.packaging_option_id) || null;
  }, [initialOrder, packagingOptions]);
  const packagingTypes = useMemo(() => {
    const seen = new Set<string>();
    return filteredPackagingOptions
      .map((option) => option.type.trim())
      .filter((type) => {
        if (!type || seen.has(type)) return false;
        seen.add(type);
        return true;
      });
  }, [filteredPackagingOptions]);
  const selectedPackagingType = selectedPackagingOption?.type.trim() ?? "";
  const packagingOptionsForSelectedType = useMemo(
    () => filteredPackagingOptions.filter((option) => option.type.trim() === selectedPackagingType),
    [filteredPackagingOptions, selectedPackagingType],
  );
  const quantityNumber = Number(quantity);
  const customOrderTotalWeightKg = useMemo(() => {
    if (!selectedPackagingOption || !Number.isFinite(quantityNumber) || quantityNumber <= 0) return 0;
    return (Number(selectedPackagingOption.candy_weight_g) * quantityNumber) / 1000;
  }, [quantityNumber, selectedPackagingOption]);
  const suggestedBatchCount = useMemo(() => {
    if (!customOrderTotalWeightKg) return 0;
    return Math.ceil(customOrderTotalWeightKg / Number(settings.max_total_kg));
  }, [customOrderTotalWeightKg, settings.max_total_kg]);
  const isOverBatchLimit = suggestedBatchCount > MAX_ADMIN_BATCH_COUNT;
  const maxBatchKg = Number(settings.max_total_kg);
  const allocatedBatchKg = useMemo(
    () => batchWeights.reduce((sum, value) => sum + (Number.isFinite(Number(value)) ? Number(value) : 0), 0),
    [batchWeights],
  );
  const remainingBatchKg = customOrderTotalWeightKg - allocatedBatchKg;
  const batchWeightsValid =
    customOrderTotalWeightKg > 0 &&
    batchWeights.length > 0 &&
    batchWeights.length <= MAX_ADMIN_BATCH_COUNT &&
    batchWeights.every((value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0;
    });
  const batchAllocationValid = batchWeightsValid && Math.abs(remainingBatchKg) <= 0.02;
  const batchWeightMismatch = batchWeightsValid && !batchAllocationValid;
  const overweightBatchNumbers = batchWeights
    .map((weight, index) => ({ weight: Number(weight), index }))
    .filter(({ weight }) => Number.isFinite(weight) && Number.isFinite(maxBatchKg) && weight > maxBatchKg + 0.02)
    .map(({ index }) => index + 1);
  const batchOverMaxWarning =
    overweightBatchNumbers.length > 0 && Number.isFinite(maxBatchKg)
      ? `Warning: batch ${overweightBatchNumbers.join(", ")} is over the normal ${maxBatchKg.toFixed(2)}kg max. This is allowed for admin, but may exceed normal production slot capacity.`
      : null;
  const isJarOption = useMemo(
    () => (selectedPackagingOption?.type ?? "").toLowerCase().includes("jar"),
    [selectedPackagingOption],
  );
  const availableLidColors = useMemo(
    () => (selectedPackagingOption?.lid_colors ?? []).filter(Boolean),
    [selectedPackagingOption],
  );
  const premadeOptions = useMemo(
    () => premadeCandies.filter((item) => item.is_active),
    [premadeCandies]
  );
  const selectedAdminPremadeCandy = useMemo(
    () => premadeOptions.find((item) => item.id === adminPremadeCandyId) ?? null,
    [adminPremadeCandyId, premadeOptions],
  );
  const adminPremadeSelectionLabel = useMemo(() => {
    if (adminPremadeMode === "custom") return adminPremadeCustomName.trim();
    if (adminPremadeMode === "premade") return selectedAdminPremadeCandy?.name?.trim() ?? "";
    return "";
  }, [adminPremadeCustomName, adminPremadeMode, selectedAdminPremadeCandy]);
  const adminPremadeWeightKg = Number(weightValue);
  const isAdminPremadeReady =
    !isAdminPremadeOrder ||
    (Number.isFinite(adminPremadeWeightKg) &&
      adminPremadeWeightKg > 0 &&
      Boolean(adminPremadeSelectionLabel) &&
      Boolean(adminPremadeFlavor.trim()));
  const ingredientLabelPrice = Number(settings.ingredient_label_price ?? 0);
  const customPriceNumber = Number(priceValue);
  const liveInvoiceTotal = invoiceOrderDrafts.reduce((sum, draft) => {
    if (draft.id === activeInvoiceDraftId) {
      return sum + (Number.isFinite(customPriceNumber) ? customPriceNumber : 0);
    }
    return sum + (draftNumber(draft.fields.total_price) ?? 0);
  }, 0);
  const customWeightLabel = customOrderTotalWeightKg > 0 ? `${customOrderTotalWeightKg.toFixed(2)}kg` : "0.00kg";
  const labelAttachmentSizeLabel = labelImageSummary ? formatCompactBytes(labelImageSummary.finalBytes) : "";
  const formatMoney = formatMoneyValue;
  const labelsNumber = Number(labelsCount);
  const resolvedLabelsCount =
    customLabelsOptIn && Number.isFinite(labelsNumber) && labelsNumber > 0
      ? Math.min(labelsNumber, settings.labels_max_bulk, BULK_LABEL_COUNT_MAX)
      : 0;
  const ingredientLabelsNumber = Number(ingredientLabelsCount);
  const resolvedIngredientLabelsCount =
    ingredientLabelsOptIn && Number.isFinite(ingredientLabelsNumber) && ingredientLabelsNumber > 0
      ? Math.min(ingredientLabelsNumber, settings.labels_max_bulk, BULK_LABEL_COUNT_MAX)
      : 0;
  const applyEqualBatchSplit = () => {
    const weights = suggestedAdminBatchWeights(customOrderTotalWeightKg, Number(settings.max_total_kg));
    setBatchWeights((weights.length > 0 ? weights : [customOrderTotalWeightKg]).map((weight) => weight.toFixed(2)));
  };
  const updateBatchWeight = (index: number, value: string) => {
    setBatchWeights((prev) => prev.map((item, itemIndex) => (itemIndex === index ? value : item)));
  };
  const removeBatchWeight = (index: number) => {
    setBatchWeights((prev) => (prev.length <= 1 ? prev : prev.filter((_, itemIndex) => itemIndex !== index)));
  };
  const addBatchWeight = () => {
    setBatchWeights((prev) => [...prev, ""].slice(0, MAX_ADMIN_BATCH_COUNT));
  };
  const isWedding = categoryId.startsWith("weddings");
  const isWeddingInitials = categoryId === "weddings-initials";
  const isCustomText = categoryId.startsWith("custom-");
  const isBranded = categoryId === "branded";
  const isDesignDisabled = !categoryId || isAdminPremadeOrder;
  const productionCalendarOrder = useMemo<OrderRow>(() => {
    const selectionLabel = adminPremadeSelectionLabel;
    const title = selectionLabel ? `Premade stock - ${selectionLabel}` : "Premade stock";
    const parsedWeight = Number(weightValue);
    const totalWeightKg = Number.isFinite(parsedWeight) && parsedWeight > 0 ? parsedWeight : 0.01;
    return {
      id: "draft-premade-order",
      order_number: null,
      title,
      order_description: selectionLabel ? `${selectionLabel} stock batch` : "Premade stock batch",
      customer_name: null,
      customer_email: null,
      category_id: null,
      packaging_option_id: null,
      quantity: 1,
      jar_lid_color: null,
      labels_count: null,
      ingredient_labels_count: null,
      jacket: null,
      design_type: "premade",
      design_text: selectionLabel || title,
      jacket_type: null,
      jacket_color_one: null,
      jacket_color_two: null,
      text_color: null,
      heart_color: null,
      flavor: adminPremadeFlavor.trim() || null,
      payment_method: null,
      logo_url: null,
      label_image_url: null,
      due_date: productionSlotDate || null,
      label_type_id: null,
      total_weight_kg: totalWeightKg,
      total_price: null,
      status: "unassigned",
      notes: ADMIN_PREMADE_ORDER_MARKER,
      made: false,
      pickup: false,
      state: null,
      location: null,
      first_name: null,
      last_name: null,
      phone: null,
      organization_name: null,
      address_line1: null,
      address_line2: null,
      suburb: null,
      postcode: null,
      woo_order_id: null,
      woo_order_status: null,
      woo_order_key: null,
      woo_payment_url: null,
      paid_at: null,
      payment_provider: null,
      payment_transaction_id: null,
      admin_batch_weights_kg: null,
      admin_pricing_subtotal: null,
      admin_discount_type: null,
      admin_discount_value: null,
      admin_price_override: null,
      admin_price_locked_at: null,
      square_customer_id: null,
      square_order_id: null,
      square_invoice_id: null,
      square_invoice_title: null,
      square_invoice_version: null,
      square_invoice_status: null,
      square_invoice_url: null,
      square_invoice_due_date: null,
      square_invoice_created_at: null,
      square_invoice_sent_at: null,
      square_invoice_error: null,
      customer_note: null,
      refunded_at: null,
      refund_reason: null,
      refunded_amount: null,
      archived_at: null,
      shipped_at: null,
      created_at: new Date().toISOString(),
    };
  }, [adminPremadeFlavor, adminPremadeSelectionLabel, productionSlotDate, weightValue]);
  const showJacketColorTwo = jacket === "two_colour" || jacket === "two_colour_pinstripe";
  const previewJacketMode =
    jacket === "rainbow"
      ? "rainbow"
      : jacket === "two_colour" || jacket === "two_colour_pinstripe"
        ? "two_colour"
        : jacket === "pinstripe"
          ? "pinstripe"
          : "";
  const previewShowPinstripe = jacket === "pinstripe" || jacket === "two_colour_pinstripe";
  const previewCustomTextVariant =
    categoryId === "custom-1-6" ? "short" : categoryId === "custom-7-14" ? "long" : undefined;
  const customTextLimit =
    categoryId === "custom-7-14" ? LONG_CUSTOM_TEXT_MAX_LENGTH : SHORT_CUSTOM_TEXT_MAX_LENGTH;
  const designTextValue = useMemo(() => {
    if (isWedding) {
      const left = isWeddingInitials
        ? (weddingLineOne || "").trim().toUpperCase()
        : (weddingLineOne || "").trim();
      const right = isWeddingInitials
        ? (weddingLineTwo || "").trim().toUpperCase()
        : (weddingLineTwo || "").trim();
      if (!left && !right) return "";
      return `${left} ${WEDDING_HEART} ${right}`.trim();
    }
    if (isCustomText) return (customText || "").trim();
    if (isBranded) return (sharedOrganizationName || "").trim();
    return (designText || "").trim();
  }, [customText, designText, isBranded, isCustomText, isWedding, isWeddingInitials, sharedOrganizationName, weddingLineOne, weddingLineTwo]);
  const derivedOrderTitle = useMemo(() => {
    if (isAdminPremadeOrder) {
      return adminPremadeSelectionLabel ? `Premade stock - ${adminPremadeSelectionLabel}` : "Premade stock";
    }
    return orderTitleFromDetails({
      categoryId,
      designText: designTextValue,
      organizationName: sharedOrganizationName,
      fallback: categories.find((category) => category.id === categoryId)?.name ?? "Custom candy order",
    });
  }, [adminPremadeSelectionLabel, categories, categoryId, designTextValue, isAdminPremadeOrder, sharedOrganizationName]);
  const jacketTypeValue = useMemo(() => {
    if (jacket === "rainbow") return "rainbow";
    if (jacket === "two_colour" || jacket === "two_colour_pinstripe") return "two_colour";
    if (jacket === "pinstripe") return "pinstripe";
    return "";
  }, [jacket]);
  const buildUpdatedInvoiceChangeLines = () => {
    if (!initialOrder || !isEditMode) return [];
    const currentQuantity = Number.isFinite(quantityNumber) && quantityNumber > 0 ? quantityNumber : null;
    const currentPrice = Number(priceValue);
    const currentOrderForPackaging = {
      ...initialOrder,
      quantity: currentQuantity,
      packaging_option_id: selectedPackagingOption?.id ?? null,
    } as OrderRow;
    const currentBatchWeights = batchWeights
      .map((weight) => Number(weight))
      .filter((weight) => Number.isFinite(weight) && weight > 0);
    const originalBatchWeights = Array.isArray(initialOrder.admin_batch_weights_kg)
      ? initialOrder.admin_batch_weights_kg.filter((weight) => Number.isFinite(Number(weight)) && Number(weight) > 0)
      : [];
    const lines: string[] = [];
    const addChange = (label: string, from: string, to: string) => {
      if (valuesChanged(from, to)) lines.push(`${label}: ${from || "-"} -> ${to || "-"}`);
    };

    addChange(
      "Packaging",
      formatOrderDescription(initialOrder, initialPackagingOption),
      formatOrderDescription(currentOrderForPackaging, selectedPackagingOption),
    );
    addChange("Quantity", formatInputNumber(initialOrder.quantity, 0), currentQuantity ? formatInputNumber(currentQuantity, 0) : "");
    addChange("Total", formatMoney(initialOrder.total_price), Number.isFinite(currentPrice) ? formatMoney(currentPrice) : "");
    addChange("Due date", dateInputValue(initialOrder.due_date), dueDate);
    addChange("Jacket", initialOrder.jacket ?? "", jacket);
    addChange("Custom labels", formatInputNumber(initialOrder.labels_count, 0), resolvedLabelsCount ? formatInputNumber(resolvedLabelsCount, 0) : "");
    addChange(
      "Ingredient labels",
      formatInputNumber(initialOrder.ingredient_labels_count, 0),
      resolvedIngredientLabelsCount ? formatInputNumber(resolvedIngredientLabelsCount, 0) : "",
    );
    addChange("Batch weights", batchWeightsLabel(originalBatchWeights), batchWeightsLabel(currentBatchWeights));
    addChange("Discount", normalizeDiscountType(initialOrder.admin_discount_type), discountType);
    addChange("Discount value", formatInputNumber(initialOrder.admin_discount_value), discountValue);
    addChange("Price override", formatInputNumber(initialOrder.admin_price_override), priceOverride);

    return lines;
  };
  const shouldOfferUpdatedInvoice =
    Boolean(
      initialOrder &&
        isEditMode &&
        isAdminManagedCustomOrder(initialOrder) &&
        initialOrder.square_invoice_id &&
        !initialOrder.paid_at &&
        initialOrder.square_invoice_status?.toUpperCase() !== "PAID",
    );
  const handleLogoUpload = async (file?: File | null) => {
    if (!file) {
      setLogoUrl("");
      setLogoError(null);
      setLogoSummary(null);
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoUrl("");
      setLogoError("File is too large. Max 2MB.");
      setLogoSummary(null);
      return;
    }
    try {
      setIsOptimisingLogo(true);
      const summary = await analyzeImageOptimization(file, {
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.82,
      });
      const result = await optimizeBrowserImageToDataUrl(file, {
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.82,
      });
      setLogoUrl(result);
      setLogoSummary(summary);
      setLogoError(null);
    } catch {
      setLogoUrl("");
      setLogoSummary(null);
      setLogoError("Unable to read the file.");
    } finally {
      setIsOptimisingLogo(false);
    }
  };
  const handleLabelUpload = async (file?: File | null) => {
    if (!file) {
      setLabelFileName("");
      setLabelImageUrl("");
      setLabelImageError(null);
      setLabelImageSummary(null);
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLabelFileName("");
      setLabelImageUrl("");
      setLabelImageError("File is too large. Max 2MB.");
      setLabelImageSummary(null);
      return;
    }
    setLabelFileName(file.name);
    try {
      setIsOptimisingLabelImage(true);
      const summary =
        file.type === "application/pdf"
          ? {
              originalType: "PDF",
              originalBytes: file.size,
              finalType: "PDF",
              finalBytes: file.size,
            }
          : await analyzeImageOptimization(file, {
              maxWidth: 1800,
              maxHeight: 1800,
              quality: 0.82,
            });
      const result =
        file.type === "application/pdf"
          ? await fileToDataUrl(file)
          : await optimizeBrowserImageToDataUrl(file, {
              maxWidth: 1800,
              maxHeight: 1800,
              quality: 0.82,
            });
      setLabelImageUrl(result);
      setLabelImageSummary(summary);
      setLabelImageError(null);
    } catch {
      setLabelFileName("");
      setLabelImageUrl("");
      setLabelImageSummary(null);
      setLabelImageError("Unable to read the file.");
    } finally {
      setIsOptimisingLabelImage(false);
    }
  };
  const openCustomPicker = (target: "heart" | "text" | "jacket1" | "jacket2", current: string) => {
    const normalized = normalizeHex(current, defaultJacketColor);
    setCustomTarget(target);
    setCustomHex(normalized);
    setCustomHexInput(normalized);
    setCustomCmyk(hexToCmyk(normalized) ?? { c: 0, m: 0, y: 0, k: 0 });
    setCustomRgba(hexToRgba(normalized) ?? { r: 0, g: 0, b: 0, a: 1 });
    setCustomInputMode("hex");
    setCustomPickerOpen(true);
  };
  const applyCustomColor = () => {
    if (!customTarget) return;
    const normalized = normalizeHex(customHex, defaultJacketColor);
    if (customTarget === "heart") setHeartColor(normalized);
    if (customTarget === "text") setTextColor(normalized);
    if (customTarget === "jacket1") setJacketColorOne(normalized);
    if (customTarget === "jacket2") setJacketColorTwo(normalized);
    setCustomPickerOpen(false);
  };
  const captureCurrentInvoiceDraft = (draftId = activeInvoiceDraftId): InvoiceOrderDraft => {
    const fields: Record<string, string> = {};
    const draftBatchWeights: string[] = [];
    const form = formRef.current;
    if (form) {
      const formData = new FormData(form);
      formData.forEach((value, key) => {
        if (key === "batch_weight_kg") {
          const weight = value.toString().trim();
          if (weight) draftBatchWeights.push(weight);
          return;
        }
        if (
          SHARED_INVOICE_FIELD_NAMES.has(key) ||
          key === "submit_intent" ||
          key === "admin_invoice_orders_json" ||
          key === "combine_invoice_order_id" ||
          key === "send_updated_invoice" ||
          key === "batch_weight_mismatch_approved"
        ) {
          return;
        }
        fields[key] = value.toString();
      });
    }
    return {
      id: draftId,
      fields: {
        ...fields,
        category_id: categoryId,
        title: derivedOrderTitle ?? "",
        packaging_option_id: packagingOptionId,
        quantity,
        labels_count: customLabelsOptIn ? labelsCount : "",
        jar_lid_color: jarLidColor,
        due_date: dueDate,
        total_price: isAdminPremadeOrder ? "" : priceValue,
        order_weight_g: isAdminPremadeOrder ? "" : weightValue,
        total_weight_kg: isAdminPremadeOrder ? weightValue : "",
        admin_discount_type: isAdminPremadeOrder ? "none" : discountType,
        admin_discount_value: isAdminPremadeOrder ? "" : discountValue,
        admin_price_override: isAdminPremadeOrder ? "" : priceOverride,
        ingredient_labels_opt_in: isAdminPremadeOrder ? "off" : ingredientLabelsOptIn ? "on" : "off",
        ingredient_labels_count: isAdminPremadeOrder ? "" : ingredientLabelsCount,
        design_type: isAdminPremadeOrder ? "premade" : categoryId,
        design_text: isAdminPremadeOrder ? adminPremadeSelectionLabel : designTextValue,
        jacket,
        jacket_type: isAdminPremadeOrder ? "" : jacketTypeValue,
        jacket_color_one: isAdminPremadeOrder ? "" : jacketColorOne,
        jacket_color_two: isAdminPremadeOrder ? "" : jacketColorTwo,
        text_color: !isBranded && !isAdminPremadeOrder ? textColor : "",
        heart_color: isWedding && !isAdminPremadeOrder ? heartColor : "",
        flavor: isAdminPremadeOrder ? adminPremadeFlavor : flavor,
        logo_url: isBranded && !isAdminPremadeOrder ? logoUrl : "",
        label_image_url: !isAdminPremadeOrder && customLabelsOptIn ? labelImageUrl : "",
        admin_premade_mode: adminPremadeMode,
        admin_premade_candy_id: adminPremadeCandyId,
        admin_premade_custom_name: adminPremadeCustomName,
        production_slot_date: productionSlotDate,
      },
      batchWeights: isAdminPremadeOrder ? [] : draftBatchWeights.length > 0 ? draftBatchWeights : batchWeights,
    };
  };
  const saveActiveInvoiceDraft = () => {
    const currentDraft = captureCurrentInvoiceDraft();
    const nextDrafts = invoiceOrderDrafts.map((draft) => (draft.id === activeInvoiceDraftId ? currentDraft : draft));
    setInvoiceOrderDrafts(nextDrafts);
    return nextDrafts;
  };
  const applyInvoiceDraft = (draft: InvoiceOrderDraft) => {
    const fields = draft.fields;
    const nextCategoryId = fields.category_id ?? "";
    const nextWeddingDesign = splitWeddingDesign(fields.design_text);
    setCategoryId(nextCategoryId);
    setPackagingOptionId(fields.packaging_option_id ?? "");
    setQuantity(fields.quantity ?? "");
    setCustomLabelsOptIn(Boolean(fields.labels_count));
    setLabelsCount(fields.labels_count ?? "");
    setJarLidColor(fields.jar_lid_color ?? "");
    setDueDate(fields.due_date ?? "");
    setJacket(fields.jacket ?? "");
    setPriceValue(fields.total_price ?? "");
    setWeightValue(fields.order_weight_g || fields.total_weight_kg || "");
    setPricingError(null);
    setQuoteItems([]);
    setBatchWeights(draft.batchWeights.length > 0 ? draft.batchWeights : []);
    setDiscountType(normalizeDiscountType(fields.admin_discount_type));
    setDiscountValue(fields.admin_discount_value ?? "");
    setPriceOverride(fields.admin_price_override ?? "");
    setWeddingLineOne(nextWeddingDesign.left);
    setWeddingLineTwo(nextWeddingDesign.right);
    setCustomText(nextCategoryId.startsWith("custom-") ? fields.design_text ?? "" : "");
    setDesignText(
      nextCategoryId && !nextCategoryId.startsWith("weddings") && !nextCategoryId.startsWith("custom-") && nextCategoryId !== "branded"
        ? fields.design_text ?? ""
        : "",
    );
    setJacketColorOne(fields.jacket_color_one || defaultJacketColor);
    setJacketColorTwo(fields.jacket_color_two || defaultJacketColor);
    setTextColor(fields.text_color || defaultTextColor);
    setHeartColor(fields.heart_color || defaultTextColor);
    setFlavor(fields.flavor ?? "");
    setLogoUrl(fields.logo_url ?? "");
    setLogoError(null);
    setLogoSummary(null);
    setIngredientLabelsOptIn(fields.ingredient_labels_opt_in === "on");
    setIngredientLabelsCount(fields.ingredient_labels_count ?? "");
    setLabelFileName(fields.label_image_url ? "Existing artwork" : "");
    setLabelImageUrl(fields.label_image_url ?? "");
    setLabelImageError(null);
    setLabelImageSummary(null);
    setAdminPremadeMode(normalizeAdminPremadeMode(fields.admin_premade_mode));
    setAdminPremadeCandyId(fields.admin_premade_candy_id ?? "");
    setAdminPremadeCustomName(fields.admin_premade_custom_name || fields.design_text || "");
    setAdminPremadeFlavor(nextCategoryId === ADMIN_PREMADE_CATEGORY_ID ? fields.flavor ?? "" : "");
    setProductionSlotDate(fields.production_slot_date ?? "");
    previousPackagingOptionIdRef.current = fields.packaging_option_id ?? null;
    preserveInitialBatchWeightsRef.current = draft.batchWeights.length > 0;
    setOrderFieldsKey((value) => value + 1);
  };
  const switchInvoiceDraft = (draftId: string) => {
    if (draftId === activeInvoiceDraftId) return;
    const nextDrafts = saveActiveInvoiceDraft();
    const nextDraft = nextDrafts.find((draft) => draft.id === draftId);
    if (!nextDraft) return;
    setActiveInvoiceDraftId(draftId);
    applyInvoiceDraft(nextDraft);
    setReviewMode(false);
  };
  const addInvoiceDraft = () => {
    const nextDrafts = saveActiveInvoiceDraft();
    const nextDraft = emptyInvoiceOrderDraft(`order-${Date.now()}-${nextDrafts.length + 1}`);
    setInvoiceOrderDrafts([...nextDrafts, nextDraft]);
    setActiveInvoiceDraftId(nextDraft.id);
    applyInvoiceDraft(nextDraft);
    setReviewMode(false);
  };
  const removeInvoiceDraft = (draftId: string) => {
    if (invoiceOrderDrafts.length <= 1) return;
    const nextDrafts = invoiceOrderDrafts.filter((draft) => draft.id !== draftId);
    const nextActive = activeInvoiceDraftId === draftId ? nextDrafts[0] : nextDrafts.find((draft) => draft.id === activeInvoiceDraftId) ?? nextDrafts[0];
    setInvoiceOrderDrafts(nextDrafts);
    setActiveInvoiceDraftId(nextActive.id);
    applyInvoiceDraft(nextActive);
    setReviewMode(false);
  };
  const invoiceDraftTabLabel = (draft: InvoiceOrderDraft, index: number, isActive: boolean) => {
    if (isActive) {
      return derivedOrderTitle || draftLabel(draft, index);
    }
    const draftCategoryId = draft.fields.category_id ?? "";
    return (
      orderTitleFromDetails({
        categoryId: draftCategoryId,
        designText: draft.fields.design_text ?? "",
        organizationName: sharedOrganizationName,
        fallback: categories.find((category) => category.id === draftCategoryId)?.name ?? "",
      }) ||
      draftLabel(draft, index)
    );
  };
  const renderInvoiceTabs = (placement: "top" | "bottom") => (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap gap-2" role="tablist" aria-label={`${placement} invoice orders`}>
          {invoiceOrderDrafts.map((draft, index) => {
            const isActive = draft.id === activeInvoiceDraftId;
            const tabLabel = invoiceDraftTabLabel(draft, index, isActive);
            return (
              <div key={draft.id} className="inline-flex items-center">
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => switchInvoiceDraft(draft.id)}
                  className={`rounded-l-lg border px-3 py-2 text-xs font-semibold ${
                    isActive
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                  }`}
                >
                  {tabLabel}
                </button>
                {invoiceOrderDrafts.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeInvoiceDraft(draft.id)}
                    className={`rounded-r-lg border-y border-r px-2 py-2 text-xs font-semibold ${
                      isActive
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-white text-zinc-500 hover:border-rose-300 hover:text-rose-700"
                    }`}
                    aria-label={`Remove ${tabLabel}`}
                  >
                    X
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={addInvoiceDraft}
          className="inline-flex items-center gap-2 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:border-blue-300 hover:bg-blue-100"
        >
          <Plus size={14} aria-hidden="true" />
          Add order tab
        </button>
      </div>
    </section>
  );
  const openReview = () => {
    const nextDrafts = saveActiveInvoiceDraft();
    setInvoiceOrderDrafts(nextDrafts);
    setReviewMode(true);
    window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };
  const reviewDrafts = useMemo(() => (reviewMode ? invoiceOrderDrafts : []), [invoiceOrderDrafts, reviewMode]);
  const reviewSubtotal = reviewDrafts.reduce((sum, draft) => {
    const amount = draftNumber(draft.fields.total_price);
    return sum + (amount ?? 0);
  }, 0);
  const invoiceDiscountNumber = Number(invoiceDiscountValue);
  const invoicePriceOverrideNumber = Number(invoicePriceOverride);
  const invoiceDiscountAmount =
    invoiceDiscountType === "percent" && Number.isFinite(invoiceDiscountNumber) && invoiceDiscountNumber > 0
      ? Math.min(reviewSubtotal, reviewSubtotal * (Math.min(invoiceDiscountNumber, 100) / 100))
      : invoiceDiscountType === "fixed" && Number.isFinite(invoiceDiscountNumber) && invoiceDiscountNumber > 0
        ? Math.min(reviewSubtotal, invoiceDiscountNumber)
        : 0;
  const reviewTotal =
    Number.isFinite(invoicePriceOverrideNumber) && invoicePriceOverride.trim()
      ? Math.max(reviewDrafts.length > 0 ? reviewDrafts.length / 100 : 0, roundCurrency(invoicePriceOverrideNumber))
      : Math.max(reviewDrafts.length > 0 ? reviewDrafts.length / 100 : 0, roundCurrency(reviewSubtotal - invoiceDiscountAmount));
  const adjustedReviewTotals = useMemo(() => {
    const totals = new Map<string, string>();
    if (reviewDrafts.length === 0) return totals;

    const targetCents = Math.max(reviewDrafts.length, Math.round(reviewTotal * 100));
    const originalCents = reviewDrafts.map((draft) => Math.max(0, Math.round((draftNumber(draft.fields.total_price) ?? 0) * 100)));
    const subtotalCents = originalCents.reduce((sum, value) => sum + value, 0);
    let remainingCents = targetCents;

    reviewDrafts.forEach((draft, index) => {
      const remainingDrafts = reviewDrafts.length - index - 1;
      const minForRemaining = remainingDrafts;
      const adjustedCents =
        index === reviewDrafts.length - 1
          ? remainingCents
          : Math.min(
              Math.max(1, subtotalCents > 0 ? Math.round((targetCents * originalCents[index]) / subtotalCents) : index === 0 ? targetCents : 1),
              remainingCents - minForRemaining,
            );
      remainingCents -= adjustedCents;
      totals.set(draft.id, (adjustedCents / 100).toFixed(2));
    });

    return totals;
  }, [reviewDrafts, reviewTotal]);
  const reviewPayload = useMemo(
    () =>
      JSON.stringify(
        reviewDrafts.map((draft, index) => {
          const draftCategoryId = draft.fields.category_id ?? "";
          const adjustedTotal = adjustedReviewTotals.get(draft.id);
          return {
            fields: {
              ...draft.fields,
              total_price: adjustedTotal ?? draft.fields.total_price ?? "",
              admin_discount_type: index === 0 ? invoiceDiscountType : "none",
              admin_discount_value: index === 0 && invoiceDiscountType !== "none" ? invoiceDiscountValue : "",
              admin_price_override: index === 0 ? invoicePriceOverride : "",
              title:
                orderTitleFromDetails({
                  categoryId: draftCategoryId,
                  designText: draft.fields.design_text ?? "",
                  organizationName: sharedOrganizationName,
                  fallback: categories.find((category) => category.id === draftCategoryId)?.name ?? "Custom candy order",
                }) ?? "",
            },
            batchWeights: draft.batchWeights,
          };
        }),
      ),
    [adjustedReviewTotals, categories, invoiceDiscountType, invoiceDiscountValue, invoicePriceOverride, reviewDrafts, sharedOrganizationName],
  );

  useEffect(() => {
    if (!submitAfterCalendarPick || !productionSlotDate) return;
    setSubmitAfterCalendarPick(false);
    scheduleSubmitButtonRef.current?.click();
  }, [productionSlotDate, submitAfterCalendarPick]);

  useEffect(() => {
    if (!categoryId || !packagingOptionId) return;
    const isValid = filteredPackagingOptions.some((option) => option.id === packagingOptionId);
    if (!isValid) {
      setPackagingOptionId("");
    }
  }, [categoryId, packagingOptionId, filteredPackagingOptions]);

  useEffect(() => {
    if (!packagingOptionId) {
      setLabelsCount("");
    }
  }, [packagingOptionId]);

  useEffect(() => {
    if (!isJarOption || availableLidColors.length === 0) {
      if (jarLidColor) setJarLidColor("");
      return;
    }
    if (!availableLidColors.includes(jarLidColor)) {
      setJarLidColor("");
    }
  }, [availableLidColors, isJarOption, jarLidColor]);

  useEffect(() => {
    const previousPackagingOptionId = previousPackagingOptionIdRef.current;
    previousPackagingOptionIdRef.current = packagingOptionId;
    if (previousPackagingOptionId === null || previousPackagingOptionId === packagingOptionId) {
      return;
    }
    setLabelsCount("");
    setCustomLabelsOptIn(false);
    setIngredientLabelsCount("");
    setIngredientLabelsOptIn(false);
  }, [packagingOptionId]);

  useEffect(() => {
    if (!customLabelsOptIn) {
      setLabelsCount("");
      setLabelFileName("");
      setLabelImageUrl("");
      setLabelImageSummary(null);
      setLabelImageError(null);
    }
  }, [customLabelsOptIn]);

  useEffect(() => {
    if (!ingredientLabelsOptIn) {
      setIngredientLabelsCount("");
    }
  }, [ingredientLabelsOptIn]);

  useEffect(() => {
    if (isAdminPremadeOrder) {
      setPriceValue("");
      setPricingError(null);
      setIsPricing(false);
      setBatchWeights([]);
      setQuoteItems([]);
      return;
    }
  }, [isAdminPremadeOrder]);

  useEffect(() => {
    if (isAdminPremadeOrder) return;
    if (!customOrderTotalWeightKg) {
      setBatchWeights([]);
      return;
    }
    if (preserveInitialBatchWeightsRef.current) {
      preserveInitialBatchWeightsRef.current = false;
      return;
    }
    const weights = suggestedAdminBatchWeights(customOrderTotalWeightKg, Number(settings.max_total_kg));
    setBatchWeights((weights.length > 0 ? weights : [customOrderTotalWeightKg]).map((weight) => weight.toFixed(2)));
  }, [customOrderTotalWeightKg, isAdminPremadeOrder, settings.max_total_kg]);

  useEffect(() => {
    if (isAdminPremadeOrder) {
      return;
    }
    const qtyNumber = Number(quantity);
    if (!categoryId || !packagingOptionId || !Number.isFinite(qtyNumber) || qtyNumber <= 0) {
      setPriceValue("");
      setWeightValue("");
      setPricingError(null);
      setQuoteItems([]);
      return;
    }

    const labelsNumber = Number(labelsCount);
    const resolvedLabels =
      customLabelsOptIn && Number.isFinite(labelsNumber) && labelsNumber > 0
        ? Math.min(labelsNumber, settings.labels_max_bulk, BULK_LABEL_COUNT_MAX)
        : 0;
    const ingredientLabelsNumber = Number(ingredientLabelsCount);
    const resolvedIngredientLabels =
      ingredientLabelsOptIn && Number.isFinite(ingredientLabelsNumber) && ingredientLabelsNumber > 0
        ? Math.min(ingredientLabelsNumber, settings.labels_max_bulk, BULK_LABEL_COUNT_MAX)
        : 0;
    let active = true;
    setIsPricing(true);
    setPricingError(null);

    if (!batchWeightsValid) {
      setPriceValue("");
      setWeightValue(customOrderTotalWeightKg > 0 ? (customOrderTotalWeightKg * 1000).toFixed(0) : "");
      setPricingError("Add at least one production batch greater than 0kg.");
      setQuoteItems([]);
      setIsPricing(false);
      return;
    }

    fetch("/api/admin/orders/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryId,
        packagingOptionId,
        quantity: qtyNumber,
        labelsCount: resolvedLabels,
        ingredientLabelsCount: resolvedIngredientLabels,
        dueDate: dueDate || undefined,
        batchWeightsKg: batchWeights,
        jacket,
        discountType,
        discountValue: discountValue ? Number(discountValue) : null,
        priceOverride: priceOverride ? Number(priceOverride) : null,
        allowBatchWeightMismatch: batchWeightMismatch,
        urgencyReferenceDate: editUrgencyReferenceDate,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error || "Unable to calculate price");
        }
        return res.json() as Promise<AdminQuoteResponse>;
      })
      .then((data) => {
        if (!active) return;
        const total = Number(data.total);
        const totalWeightKg = Number(data.totalWeightKg);
        setPriceValue(Number.isFinite(total) ? total.toFixed(2) : "");
        setWeightValue(Number.isFinite(totalWeightKg) ? (totalWeightKg * 1000).toFixed(0) : "");
        setQuoteItems(data.items ?? []);
      })
      .catch((error: Error) => {
        if (!active) return;
        setPriceValue("");
        setWeightValue("");
        setPricingError(error.message);
        setQuoteItems([]);
      })
      .finally(() => {
        if (!active) return;
        setIsPricing(false);
      });

    return () => {
      active = false;
    };
  }, [batchWeightMismatch, batchWeights, batchWeightsValid, categoryId, customLabelsOptIn, customOrderTotalWeightKg, discountType, discountValue, dueDate, editUrgencyReferenceDate, ingredientLabelsCount, ingredientLabelsOptIn, isAdminPremadeOrder, jacket, labelsCount, packagingOptionId, priceOverride, quantity, settings.labels_max_bulk]);

  return (
    <form
      ref={formRef}
      action={upsertOrder}
      className="space-y-6"
      onSubmit={(event) => {
        if (invoiceDraftMode && !isAdminPremadeOrder && !reviewMode) {
          event.preventDefault();
          openReview();
          return;
        }
        if (sendUpdatedInvoiceInputRef.current) {
          sendUpdatedInvoiceInputRef.current.value = "";
        }
        if (batchWeightMismatchApprovedInputRef.current) {
          batchWeightMismatchApprovedInputRef.current.value = "";
        }
        if (invoiceDraftMode && reviewMode && reviewDrafts.some(draftHasBatchWeightMismatch)) {
          const confirmed = window.confirm(
            [
              "One or more order tabs have batch totals that do not match their order weight.",
              "",
              "Create this combined invoice anyway?",
            ].join("\n"),
          );
          if (!confirmed) {
            event.preventDefault();
            return;
          }
          if (batchWeightMismatchApprovedInputRef.current) {
            batchWeightMismatchApprovedInputRef.current.value = "on";
          }
        }
        if (!reviewMode && !isAdminPremadeOrder && batchWeightMismatch) {
          const confirmed = window.confirm(
            [
              "Total batch weight does not match the order weight.",
              "",
              `Order weight: ${customOrderTotalWeightKg.toFixed(2)}kg`,
              `Batch total: ${allocatedBatchKg.toFixed(2)}kg`,
              "",
              `${isEditMode ? "Save" : "Create"} this order with the mismatched batch total?`,
            ].join("\n"),
          );
          if (!confirmed) {
            event.preventDefault();
            return;
          }
          if (batchWeightMismatchApprovedInputRef.current) {
            batchWeightMismatchApprovedInputRef.current.value = "on";
          }
        }
        if (shouldOfferUpdatedInvoice) {
          const changeLines = buildUpdatedInvoiceChangeLines();
          if (changeLines.length > 0) {
            const confirmed = window.confirm(
              [
                "Customer will get a new invoice with these changes:",
                "",
                ...changeLines,
                "",
                "Save these updates and send the replacement invoice?",
              ].join("\n"),
            );
            if (!confirmed) {
              event.preventDefault();
              return;
            }
            if (sendUpdatedInvoiceInputRef.current) {
              sendUpdatedInvoiceInputRef.current.value = "on";
            }
          }
        }
        setIsSubmittingOrder(true);
      }}
    >
      {isSubmittingOrder ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/90 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-xl">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-900" />
            <p className="mt-4 text-lg font-semibold text-zinc-900">
              {isEditMode ? "Saving order" : isAdminPremadeOrder ? "Saving premade order" : "Creating invoice draft"}
            </p>
            <p className="mt-2 text-sm text-zinc-600">
              {isEditMode
                ? "Please wait while the order details and invoice records are updated."
                : isAdminPremadeOrder
                  ? "Please wait while the premade batch placeholder is saved."
                : "Please wait while the order is saved and Square prepares the draft invoice."}
            </p>
          </div>
        </div>
      ) : null}
      {invoiceDraftMode && reviewMode ? (
        <input type="hidden" name="admin_invoice_orders_json" value={reviewPayload} />
      ) : null}
      <input ref={sendUpdatedInvoiceInputRef} type="hidden" name="send_updated_invoice" defaultValue="" />
      <input ref={batchWeightMismatchApprovedInputRef} type="hidden" name="batch_weight_mismatch_approved" defaultValue="" />
      {!reviewMode && !isAdminPremadeOrder && !invoiceDraftMode ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Invoice details</p>
              <h3 className="admin-card-title text-zinc-900">Customer and invoice note</h3>
            </div>
            {invoiceDraftMode ? (
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-700">
                Shared across all tabs
              </span>
            ) : null}
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 md:col-span-2">
              Pickup or delivery
              <div className="mt-2 flex items-center gap-4 text-sm text-zinc-700">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="pickup"
                    value="off"
                    checked={deliveryMode === "delivery"}
                    onChange={() => setDeliveryMode("delivery")}
                    className="h-4 w-4"
                  />
                  Delivery
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="pickup"
                    value="on"
                    checked={deliveryMode === "pickup"}
                    onChange={() => setDeliveryMode("pickup")}
                    className="h-4 w-4"
                  />
                  Pickup
                </label>
              </div>
            </div>
            <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              First name
              <input
                name="first_name"
                value={sharedFirstName}
                onChange={(event) => setSharedFirstName(event.target.value)}
                className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
              />
            </label>
            <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              Last name
              <input
                name="last_name"
                value={sharedLastName}
                onChange={(event) => setSharedLastName(event.target.value)}
                className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
              />
            </label>
            <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              Email address
              <input
                type="email"
                name="customer_email"
                value={sharedEmail}
                onChange={(event) => setSharedEmail(event.target.value)}
                className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
              />
            </label>
            <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              Phone number
              <input
                name="phone"
                value={sharedPhone}
                onChange={(event) => setSharedPhone(event.target.value)}
                className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
              />
            </label>
            <label className="text-xs uppercase tracking-[0.2em] text-zinc-500 md:col-span-2">
              Organisation / brand name
              <input
                name="organization_name"
                value={sharedOrganizationName}
                onChange={(event) => setSharedOrganizationName(event.target.value)}
                className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
              />
            </label>
          </div>
          {showAddress ? (
            <div className="mt-5 border-t border-zinc-100 pt-5">
              <h3 className="admin-card-title text-zinc-900">Delivery address</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-xs uppercase tracking-[0.2em] text-zinc-500 md:col-span-2">
                  Address line 1
                  <input
                    name="address_line1"
                    value={sharedAddressLine1}
                    onChange={(event) => setSharedAddressLine1(event.target.value)}
                    className="mt-2 min-h-11 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
                  />
                </label>
                <label className="text-xs uppercase tracking-[0.2em] text-zinc-500 md:col-span-2">
                  Address line 2
                  <input
                    name="address_line2"
                    value={sharedAddressLine2}
                    onChange={(event) => setSharedAddressLine2(event.target.value)}
                    className="mt-2 min-h-11 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
                  />
                </label>
                <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Suburb
                  <input
                    name="suburb"
                    value={sharedSuburb}
                    onChange={(event) => setSharedSuburb(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
                  />
                </label>
                <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Postcode
                  <input
                    name="postcode"
                    value={sharedPostcode}
                    onChange={(event) => setSharedPostcode(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
                  />
                </label>
                <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  State
                  <select
                    name="state"
                    className="mt-2 min-h-11 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
                    value={sharedState}
                    onChange={(event) => setSharedState(event.target.value)}
                  >
                    {STATES.map((state) => (
                      <option key={state.value} value={state.value}>
                        {state.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          ) : null}
          <label className="mt-5 block">
            <span className="admin-card-title text-zinc-900">Customer Note</span>
            <textarea
              name="customer_note"
              value={sharedCustomerNote}
              onChange={(event) => setSharedCustomerNote(event.target.value)}
              className="mt-4 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
              rows={4}
              placeholder="Visible on the customer invoice."
            />
          </label>
        </section>
      ) : null}
      {!reviewMode && invoiceDraftMode && !isAdminPremadeOrder ? renderInvoiceTabs("top") : null}
      {reviewMode ? (
        <section className="rounded-2xl border border-zinc-900 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Review</p>
              <h3 className="admin-page-title text-xl">Review order</h3>
              <p className="mt-1 text-sm text-zinc-600">
                {reviewDrafts.length} order{reviewDrafts.length === 1 ? "" : "s"} for {sharedOrganizationName || sharedEmail || "this customer"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Invoice total</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">{formatMoney(reviewTotal)}</p>
            </div>
          </div>
          <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Invoice details</p>
                <h4 className="admin-card-title text-zinc-900">Customer and invoice details</h4>
              </div>
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-700">
                Shared across all orders
              </span>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 md:col-span-2">
                Pickup or delivery
                <div className="mt-2 flex items-center gap-4 text-sm text-zinc-700">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="pickup"
                      value="off"
                      checked={deliveryMode === "delivery"}
                      onChange={() => setDeliveryMode("delivery")}
                      className="h-4 w-4"
                    />
                    Delivery
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="pickup"
                      value="on"
                      checked={deliveryMode === "pickup"}
                      onChange={() => setDeliveryMode("pickup")}
                      className="h-4 w-4"
                    />
                    Pickup
                  </label>
                </div>
              </div>
              <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                First name
                <input
                  name="first_name"
                  value={sharedFirstName}
                  onChange={(event) => setSharedFirstName(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                />
              </label>
              <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                Last name
                <input
                  name="last_name"
                  value={sharedLastName}
                  onChange={(event) => setSharedLastName(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                />
              </label>
              <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                Email address
                <input
                  type="email"
                  name="customer_email"
                  value={sharedEmail}
                  required
                  onChange={(event) => setSharedEmail(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                />
              </label>
              <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                Phone number
                <input
                  name="phone"
                  value={sharedPhone}
                  onChange={(event) => setSharedPhone(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                />
              </label>
              <label className="text-xs uppercase tracking-[0.2em] text-zinc-500 md:col-span-2">
                Organisation / brand name
                <input
                  name="organization_name"
                  value={sharedOrganizationName}
                  onChange={(event) => setSharedOrganizationName(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                />
              </label>
            </div>
            {showAddress ? (
              <div className="mt-5 border-t border-zinc-200 pt-5">
                <h4 className="admin-card-title text-zinc-900">Delivery address</h4>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="text-xs uppercase tracking-[0.2em] text-zinc-500 md:col-span-2">
                    Address line 1
                    <input
                      name="address_line1"
                      value={sharedAddressLine1}
                      onChange={(event) => setSharedAddressLine1(event.target.value)}
                      className="mt-2 min-h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                    />
                  </label>
                  <label className="text-xs uppercase tracking-[0.2em] text-zinc-500 md:col-span-2">
                    Address line 2
                    <input
                      name="address_line2"
                      value={sharedAddressLine2}
                      onChange={(event) => setSharedAddressLine2(event.target.value)}
                      className="mt-2 min-h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                    />
                  </label>
                  <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                    Suburb
                    <input
                      name="suburb"
                      value={sharedSuburb}
                      onChange={(event) => setSharedSuburb(event.target.value)}
                      className="mt-2 min-h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                    />
                  </label>
                  <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                    Postcode
                    <input
                      name="postcode"
                      value={sharedPostcode}
                      onChange={(event) => setSharedPostcode(event.target.value)}
                      className="mt-2 min-h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                    />
                  </label>
                  <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                    State
                    <select
                      name="state"
                      className="mt-2 min-h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                      value={sharedState}
                      onChange={(event) => setSharedState(event.target.value)}
                    >
                      {STATES.map((state) => (
                        <option key={state.value} value={state.value}>
                          {state.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            ) : null}
            <label className="mt-5 block">
              <span className="admin-card-title text-zinc-900">Customer Note</span>
              <textarea
                name="customer_note"
                value={sharedCustomerNote}
                onChange={(event) => setSharedCustomerNote(event.target.value)}
                className="mt-4 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                rows={4}
                placeholder="Visible on the customer invoice."
              />
            </label>
          </div>
          <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Pricing adjustments</p>
                <h4 className="admin-card-title text-zinc-900">Invoice pricing</h4>
              </div>
              <div className="text-right text-xs text-zinc-600">
                <p>Subtotal: <span className="font-semibold text-zinc-900">{formatMoney(reviewSubtotal)}</span></p>
                <p>Invoice total: <span className="font-semibold text-zinc-900">{formatMoney(reviewTotal)}</span></p>
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                Discount
                <select
                  value={invoiceDiscountType}
                  onChange={(event) => setInvoiceDiscountType(event.target.value as AdminDiscountType)}
                  className="mt-2 min-h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                >
                  <option value="none">None</option>
                  <option value="percent">Percent</option>
                  <option value="fixed">Fixed $</option>
                </select>
              </label>
              <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                Discount value
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={invoiceDiscountValue}
                  disabled={invoiceDiscountType === "none"}
                  onChange={(event) => setInvoiceDiscountValue(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 disabled:bg-zinc-100 disabled:text-zinc-400"
                />
              </label>
              <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                Override invoice total
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={invoicePriceOverride}
                  onChange={(event) => setInvoicePriceOverride(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                />
              </label>
            </div>
            {invoiceDiscountAmount > 0 || invoicePriceOverride.trim() ? (
              <p className="mt-3 text-xs text-zinc-600">
                Adjustment applied across the order lines sent to Square.
              </p>
            ) : null}
          </div>
          <div className="mt-5 grid gap-3">
            {reviewDrafts.map((draft, index) => {
              const category = categories.find((item) => item.id === draft.fields.category_id);
              const packaging = packagingOptions.find((item) => item.id === draft.fields.packaging_option_id);
              const weightKg = draftNumber(draft.fields.order_weight_g) !== null ? Number(draft.fields.order_weight_g) / 1000 : null;
              const total = draftNumber(adjustedReviewTotals.get(draft.id) ?? draft.fields.total_price);
              const title =
                orderTitleFromDetails({
                  categoryId: draft.fields.category_id ?? "",
                  designText: draft.fields.design_text ?? "",
                  organizationName: sharedOrganizationName,
                  fallback: category?.name ?? "Custom candy order",
                }) ?? draftLabel(draft, index);
              return (
                <div key={draft.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Order {index + 1}</p>
                      <h4 className="mt-1 text-sm font-semibold text-zinc-900">{title}</h4>
                      <p className="mt-1 text-xs text-zinc-600">{category?.name ?? draft.fields.category_id ?? "-"}</p>
                    </div>
                    <p className="text-sm font-semibold text-zinc-900">{formatMoney(total ?? 0)}</p>
                  </div>
                  <dl className="mt-3 grid gap-2 text-xs text-zinc-600 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <dt className="font-semibold text-zinc-900">Packaging</dt>
                      <dd>{packaging ? `${packaging.type} ${packaging.size}` : "-"}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-zinc-900">Quantity</dt>
                      <dd>{draft.fields.quantity || "-"}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-zinc-900">Required</dt>
                      <dd>{draft.fields.due_date || "-"}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-zinc-900">Weight</dt>
                      <dd>{weightKg !== null ? `${weightKg.toFixed(2)}kg` : "-"}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-zinc-900">Batches</dt>
                      <dd>{draft.batchWeights.length > 0 ? draft.batchWeights.map((weight) => `${weight}kg`).join(" + ") : "-"}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-zinc-900">Flavour</dt>
                      <dd>{draft.fields.flavor || "-"}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="font-semibold text-zinc-900">Production notes</dt>
                      <dd>{draft.fields.notes || "-"}</dd>
                    </div>
                  </dl>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
      {!reviewMode ? (
        <>
      <div className="sticky top-20 z-20">
        <div className="rounded-2xl border border-zinc-900 bg-zinc-900/95 p-4 text-white shadow-lg backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-300">
                {isAdminPremadeOrder ? "Premade stock batch" : invoiceDraftMode ? "Invoice total" : "Order total"}
              </p>
              <p className="mt-1 text-3xl font-semibold">
                {isAdminPremadeOrder
                  ? "N/A"
                  : invoiceDraftMode
                    ? formatMoney(liveInvoiceTotal)
                    : formatMoney(Number.isFinite(customPriceNumber) ? customPriceNumber : 0)}
              </p>
            </div>
            {isAdminPremadeOrder ? (
              <div className="grid flex-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-300">What gets saved</p>
                  <p className="mt-1 text-sm text-zinc-100">Stock item, batch flavour, and stock weight only.</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-300">Other order fields</p>
                  <p className="mt-1 text-sm text-zinc-100">Pricing, delivery, packaging, and labels are stored as N/A.</p>
                </div>
              </div>
            ) : (
              <div className="grid flex-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-300">Order total</p>
                  <p className="mt-1 text-sm font-semibold">{formatMoney(Number.isFinite(customPriceNumber) ? customPriceNumber : 0)}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-300">Total weight</p>
                  <p className="mt-1 text-sm font-semibold text-zinc-100">{customWeightLabel}</p>
                </div>
              </div>
            )}
          </div>
          <input type="hidden" name="total_price" value={isAdminPremadeOrder ? "" : priceValue} />
          {!isAdminPremadeOrder
            ? batchWeights.map((weight, index) => (
                <input key={`batch-weight-${index}`} type="hidden" name="batch_weight_kg" value={weight} />
              ))
            : null}
          <input type="hidden" name="admin_discount_type" value={isAdminPremadeOrder ? "none" : discountType} />
          <input type="hidden" name="admin_discount_value" value={isAdminPremadeOrder ? "" : discountValue} />
          <input type="hidden" name="admin_price_override" value={isAdminPremadeOrder ? "" : priceOverride} />
          <input type="hidden" name="ingredient_labels_opt_in" value={isAdminPremadeOrder ? "off" : ingredientLabelsOptIn ? "on" : "off"} />
          {isEditMode && initialOrder ? (
            <>
              <input type="hidden" name="id" value={initialOrder.id} />
              <input type="hidden" name="redirect_to" value={`/admin/orders/${initialOrder.id}`} />
              <input type="hidden" name="toast_success" value="Order updated." />
              <input type="hidden" name="toast_error" value="Failed to update order." />
            </>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="admin-card-title text-zinc-900">Order details</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 md:col-span-2">
            <p>Order type</p>
            <input type="hidden" name="category_id" value={categoryId} />
            <div className="mt-2 flex flex-wrap gap-2">
              {categories.map((category) => {
                const isActive = categoryId === category.id;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setCategoryId(category.id)}
                    className={`min-h-11 rounded-full border px-4 py-2 text-sm font-semibold normal-case tracking-normal transition ${
                      isActive
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400"
                    }`}
                  >
                    {category.name}
                  </button>
                );
              })}
              <button
                key={ADMIN_PREMADE_CATEGORY_ID}
                type="button"
                onClick={() => setCategoryId(ADMIN_PREMADE_CATEGORY_ID)}
                className={`min-h-11 rounded-full border px-4 py-2 text-sm font-semibold normal-case tracking-normal transition ${
                  isAdminPremadeOrder
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400"
                }`}
              >
                {ADMIN_PREMADE_ORDER_LABEL}
              </button>
            </div>
          </div>
          {isAdminPremadeOrder ? (
            <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              Batch weight (kg)
              <input
                type="number"
                name="total_weight_kg"
                min={0.01}
                step="0.01"
                required
                value={weightValue}
                onChange={(event) => setWeightValue(event.target.value)}
                className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
              />
            </label>
          ) : null}
          {isAdminPremadeOrder ? (
            <>
              <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                Stock item
                <select
                  name="admin_premade_mode"
                  value={adminPremadeMode}
                  required
                  onChange={(event) => {
                    const next = normalizeAdminPremadeMode(event.target.value);
                    setAdminPremadeMode(next);
                    if (next !== "premade") setAdminPremadeCandyId("");
                    if (next !== "custom") setAdminPremadeCustomName("");
                  }}
                  className="mt-2 min-h-11 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
                >
                  <option value="">Select stock item</option>
                  <option value="premade">Premade candy</option>
                  <option value="custom">Custom candy name</option>
                </select>
              </label>
              <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                {adminPremadeMode === "premade" ? "Premade candy" : "Custom candy name"}
                {adminPremadeMode === "premade" ? (
                  <select
                    name="admin_premade_candy_id"
                    value={adminPremadeCandyId}
                    required
                    onChange={(event) => setAdminPremadeCandyId(event.target.value)}
                    className="mt-2 min-h-11 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
                  >
                    <option value="">Select premade candy</option>
                    {premadeOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {formatPremadeLabel(item)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    name="admin_premade_custom_name"
                    value={adminPremadeCustomName}
                    required={adminPremadeMode === "custom"}
                    disabled={adminPremadeMode !== "custom"}
                    onChange={(event) => setAdminPremadeCustomName(event.target.value)}
                    placeholder={adminPremadeMode === "custom" ? "e.g. Watermelon mix" : "Select stock item first"}
                    className="mt-2 min-h-11 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 disabled:bg-zinc-50 disabled:text-zinc-400"
                  />
                )}
              </label>
              <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                Batch flavour
                <select
                  name="flavor"
                  value={adminPremadeFlavor}
                  required
                  onChange={(event) => setAdminPremadeFlavor(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
                >
                  <option value="">Select flavour</option>
                  {flavors.map((item) => (
                    <option key={item.id} value={item.name}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="md:col-span-2">
                <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Production date</p>
                    <p className="text-sm text-zinc-700">
                      {productionSlotDate
                        ? `Selected: ${formatFullDateLabel(new Date(`${productionSlotDate}T00:00:00`))}`
                        : "Choose a slot from the production calendar."}
                    </p>
                  </div>
                </div>
                <input type="hidden" name="production_slot_date" value={productionSlotDate} />
              </div>
            </>
          ) : null}
          <input type="hidden" name="title" value={derivedOrderTitle ?? ""} />
          <input type="hidden" name="status" value={isEditMode && initialOrder ? initialOrder.status : "unassigned"} />
        </div>
      </div>

      {!isAdminPremadeOrder ? (
        <div
          className={`rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm ${
            !categoryId ? "pointer-events-none opacity-50" : ""
          }`}
        >
          <h3 className="admin-card-title text-zinc-900">Packaging</h3>
          <input type="hidden" name="packaging_option_id" value={packagingOptionId} />
          <input type="hidden" name="order_weight_g" value={weightValue} />
          <div className="mt-4 space-y-5">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Packaging type</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {packagingTypes.length > 0 ? (
                  packagingTypes.map((type) => {
                    const isActive = selectedPackagingType === type;
                    const firstOption = filteredPackagingOptions.find((option) => option.type.trim() === type);
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setPackagingOptionId(firstOption?.id ?? "")}
                        className={`min-h-11 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                          isActive
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400"
                        }`}
                      >
                        {type}
                      </button>
                    );
                  })
                ) : (
                  <p className="text-sm text-zinc-500">Select an order type first.</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[1.5fr_1fr]">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Packaging size</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {packagingOptionsForSelectedType.length > 0 ? (
                    packagingOptionsForSelectedType.map((option) => {
                      const isActive = packagingOptionId === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setPackagingOptionId(option.id)}
                          className={`min-h-11 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                            isActive
                              ? "border-zinc-900 bg-zinc-900 text-white"
                              : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400"
                          }`}
                        >
                          {option.size}
                        </button>
                      );
                    })
                  ) : (
                    <p className="text-sm text-zinc-500">Choose a packaging type.</p>
                  )}
                </div>
              </div>
              <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                Quantity
                <input
                  type="number"
                  name="quantity"
                  min={1}
                  required
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
                />
                {selectedPackagingOption?.max_packages ? (
                  <div className="mt-2 text-[11px] normal-case tracking-normal text-zinc-500">
                    Website max {selectedPackagingOption.max_packages}; admin can exceed.
                  </div>
                ) : null}
              </label>
            </div>

            {isJarOption ? (
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Lid colour</p>
                <input type="hidden" name="jar_lid_color" value={jarLidColor} />
                <div className="mt-2 flex flex-wrap gap-2">
                  {availableLidColors.length > 0 ? (
                    availableLidColors.map((lid) => (
                      <button
                        key={lid}
                        type="button"
                        onClick={() => setJarLidColor(lid)}
                        className={`min-h-11 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                          jarLidColor === lid
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400"
                        }`}
                      >
                        {lid}
                      </button>
                    ))
                  ) : (
                    <p className="text-sm text-zinc-500">No lid options.</p>
                  )}
                </div>
              </div>
            ) : (
              <input type="hidden" name="jar_lid_color" value="" />
            )}

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Production batches</p>
                  <p className="mt-1 text-sm font-semibold text-zinc-900">
                    {customOrderTotalWeightKg > 0
                      ? `${customOrderTotalWeightKg.toFixed(2)}kg total / ${Number(settings.max_total_kg).toFixed(2)}kg max batch`
                      : "Select packaging and quantity"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={applyEqualBatchSplit}
                    disabled={!customOrderTotalWeightKg}
                    className="min-h-11 rounded border border-zinc-900 bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:border-zinc-300 disabled:bg-zinc-200 disabled:text-zinc-500"
                  >
                    Equal split
                  </button>
                  <button
                    type="button"
                    onClick={addBatchWeight}
                    disabled={!customOrderTotalWeightKg || batchWeights.length >= MAX_ADMIN_BATCH_COUNT}
                    className="inline-flex min-h-11 items-center gap-2 rounded border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus size={14} aria-hidden="true" />
                    Add
                  </button>
                </div>
              </div>
              {isOverBatchLimit ? (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                  Equal split would need {suggestedBatchCount} batches. Admin can use fewer batches, but any batch over {maxBatchKg.toFixed(2)}kg exceeds normal slot capacity.
                </p>
              ) : null}
              {batchOverMaxWarning ? (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                  {batchOverMaxWarning}
                </p>
              ) : null}
              {batchWeights.length > 0 ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {batchWeights.map((weight, index) => (
                    <div key={`visible-batch-${index}`} className="flex items-end gap-2">
                      <label className="min-w-0 flex-1 text-xs uppercase tracking-[0.16em] text-zinc-500">
                        Batch {index + 1} kg
                        <input
                          type="number"
                          min={0.01}
                          step="0.01"
                          value={weight}
                          onChange={(event) => updateBatchWeight(index, event.target.value)}
                          className="mt-2 min-h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => removeBatchWeight(index)}
                        disabled={batchWeights.length <= 1}
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:border-rose-300 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={`Remove batch ${index + 1}`}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              {customOrderTotalWeightKg > 0 ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                      batchAllocationValid
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-amber-200 bg-amber-50 text-amber-800"
                    }`}
                  >
                    Allocated: {allocatedBatchKg.toFixed(2)}kg
                  </div>
                  <div
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                      batchAllocationValid
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-amber-200 bg-amber-50 text-amber-800"
                    }`}
                  >
                    {batchAllocationValid
                      ? "Correct amount"
                      : remainingBatchKg > 0
                        ? `Add: ${Math.abs(remainingBatchKg).toFixed(2)}kg`
                        : `Remove: ${Math.abs(remainingBatchKg).toFixed(2)}kg`}
                  </div>
                </div>
              ) : null}
              {batchWeightMismatch ? (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                  Batch total does not match the order weight. Admin can continue after confirming on submit.
                </p>
              ) : null}
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Labels</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-zinc-200 bg-white p-3">
                  <label className="flex items-start gap-3 text-sm text-zinc-700">
                    <input
                      type="checkbox"
                      checked={customLabelsOptIn}
                      onChange={(event) => setCustomLabelsOptIn(event.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                    />
                    <span>
                      <span className="block font-semibold text-zinc-900">Custom labels</span>
                    </span>
                  </label>
                  {customLabelsOptIn ? (
                    <label className="mt-3 block text-xs uppercase tracking-[0.2em] text-zinc-500">
                      Quantity
                      <input
                        type="number"
                        name="labels_count"
                        min={0}
                        max={Math.min(settings.labels_max_bulk, BULK_LABEL_COUNT_MAX)}
                        value={labelsCount}
                        onChange={(event) => {
                          if (!event.target.value.trim()) {
                            setLabelsCount("");
                            return;
                          }
                          const parsed = Number(event.target.value);
                          setLabelsCount(
                            Number.isFinite(parsed)
                              ? String(
                                  Math.min(
                                    Math.max(0, Math.floor(parsed)),
                                    settings.labels_max_bulk,
                                    BULK_LABEL_COUNT_MAX,
                                  )
                                )
                              : "",
                          );
                        }}
                        className="mt-2 min-h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                      />
                    </label>
                  ) : null}
                </div>
                <div className="rounded-lg border border-zinc-200 bg-white p-3">
                  <label className="flex items-start gap-3 text-sm text-zinc-700">
                    <input
                      type="checkbox"
                      checked={ingredientLabelsOptIn}
                      onChange={(event) => setIngredientLabelsOptIn(event.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                    />
                    <span>
                      <span className="block font-semibold text-zinc-900">Ingredient labels</span>
                      <span className="mt-0.5 block text-xs text-zinc-500">{`${formatMoney(ingredientLabelPrice)} each.`}</span>
                    </span>
                  </label>
                  {ingredientLabelsOptIn ? (
                    <label className="mt-3 block text-xs uppercase tracking-[0.2em] text-zinc-500">
                      Quantity
                      <input
                        type="number"
                        min={0}
                        max={Math.min(settings.labels_max_bulk, BULK_LABEL_COUNT_MAX)}
                        value={ingredientLabelsCount}
                        onChange={(event) => {
                          if (!event.target.value.trim()) {
                            setIngredientLabelsCount("");
                            return;
                          }
                          const parsed = Number(event.target.value);
                          const next = Number.isFinite(parsed)
                            ? String(
                                Math.min(
                                  Math.max(0, Math.floor(parsed)),
                                  settings.labels_max_bulk,
                                  BULK_LABEL_COUNT_MAX,
                                )
                              )
                            : "";
                          setIngredientLabelsCount(next);
                        }}
                        className="mt-2 min-h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                      />
                    </label>
                  ) : null}
                </div>
              </div>

              {customLabelsOptIn ? (
                <div className="mt-4 text-xs uppercase tracking-[0.2em] text-zinc-500">
                  <label htmlFor="label-artwork-upload">Label artwork</label>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      id="label-artwork-upload"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp,application/pdf"
                      onChange={(event) => handleLabelUpload(event.target.files?.[0] ?? null)}
                      className="sr-only"
                    />
                    <label
                      htmlFor="label-artwork-upload"
                      className="inline-flex min-h-11 cursor-pointer items-center rounded border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-300"
                    >
                      {labelFileName ? "Change file" : "Choose file"}
                    </label>
                    {labelImageUrl ? (
                      labelImageUrl.startsWith("data:image/") ? (
                        <Image
                          src={labelImageUrl}
                          alt="Label preview"
                          width={44}
                          height={44}
                          className="h-11 w-11 rounded border border-zinc-200 object-cover"
                          unoptimized
                        />
                      ) : labelImageUrl.startsWith("data:application/pdf") ? (
                        <span className="inline-flex h-11 min-w-11 items-center justify-center rounded border border-zinc-200 bg-white px-2 text-[10px] font-semibold text-zinc-600">
                          PDF
                        </span>
                      ) : null
                    ) : null}
                    {labelFileName ? (
                      <span className="text-xs normal-case tracking-normal text-zinc-500" title={labelFileName}>
                        {labelFileName}
                        {labelAttachmentSizeLabel ? ` (${labelAttachmentSizeLabel})` : ""}
                      </span>
                    ) : null}
                    {labelImageUrl ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-[0.08em] text-emerald-700">
                        Ready
                      </span>
                    ) : null}
                  </div>
                  {labelImageError ? (
                    <p className="mt-1 text-xs normal-case tracking-normal text-red-600">{labelImageError}</p>
                  ) : null}
                  {isOptimisingLabelImage ? (
                    <p className="mt-2 text-xs font-semibold normal-case tracking-normal text-zinc-600">Optimising artwork...</p>
                  ) : null}
                </div>
              ) : null}
            </div>

            {!invoiceDraftMode ? (
              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Pricing adjustments</p>
                {isPricing || pricingError ? (
                  <p
                    className={`mt-3 rounded-lg border px-3 py-2 text-xs font-semibold ${
                      pricingError
                        ? "border-amber-200 bg-amber-50 text-amber-800"
                        : "border-zinc-200 bg-zinc-50 text-zinc-600"
                    }`}
                  >
                    {isPricing ? "Calculating price..." : pricingError}
                  </p>
                ) : null}
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                    Discount
                    <select
                      value={discountType}
                      onChange={(event) => setDiscountType(event.target.value as AdminDiscountType)}
                      className="mt-2 min-h-11 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
                    >
                      <option value="none">None</option>
                      <option value="percent">Percent</option>
                      <option value="fixed">Fixed $</option>
                    </select>
                  </label>
                  <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                    Discount value
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={discountValue}
                      disabled={discountType === "none"}
                      onChange={(event) => setDiscountValue(event.target.value)}
                      className="mt-2 min-h-11 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 disabled:bg-zinc-50 disabled:text-zinc-400"
                    />
                  </label>
                  <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                    Override total
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={priceOverride}
                      onChange={(event) => setPriceOverride(event.target.value)}
                      className="mt-2 min-h-11 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
                    />
                  </label>
                </div>
                {quoteItems.length > 0 ? (
                  <div className="mt-4 grid gap-2 text-xs text-zinc-600 sm:grid-cols-2">
                    {quoteItems.map((item) => (
                      <div key={item.label} className="flex justify-between gap-3 rounded border border-zinc-100 bg-zinc-50 px-2 py-1">
                        <span>{item.label}</span>
                        <span className="font-semibold text-zinc-900">{formatMoney(item.amount)}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <input type="hidden" name="design_type" value={isAdminPremadeOrder ? "premade" : categoryId} />
      <input type="hidden" name="design_text" value={isAdminPremadeOrder ? adminPremadeSelectionLabel : designTextValue} />
      <input type="hidden" name="jacket_type" value={isAdminPremadeOrder ? "" : jacketTypeValue} />
      <input type="hidden" name="jacket_color_one" value={isAdminPremadeOrder ? "" : jacketColorOne} />
      <input type="hidden" name="jacket_color_two" value={isAdminPremadeOrder ? "" : jacketColorTwo} />
      {!isBranded && !isAdminPremadeOrder ? <input type="hidden" name="text_color" value={textColor} /> : null}
      {isWedding && !isAdminPremadeOrder ? <input type="hidden" name="heart_color" value={heartColor} /> : null}
      {isBranded && !isAdminPremadeOrder && logoUrl ? <input type="hidden" name="logo_url" value={logoUrl} /> : null}
      {!isAdminPremadeOrder && customLabelsOptIn && labelImageUrl ? <input type="hidden" name="label_image_url" value={labelImageUrl} /> : null}
      {!isAdminPremadeOrder ? <input type="hidden" name="ingredient_labels_count" value={ingredientLabelsCount} /> : null}

      {!isAdminPremadeOrder ? (
        <>
          <div
            className={`rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm ${
              isDesignDisabled ? "pointer-events-none opacity-50" : ""
            }`}
          >
            <h3 className="admin-card-title text-zinc-900">Candy design & flavor</h3>
            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
              <div className="grid gap-4 md:grid-cols-2">
              {isWedding && (
                <>
                  <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                    First {isWeddingInitials ? "initial" : "name"}
                    <input
                      value={weddingLineOne}
                      maxLength={isWeddingInitials ? 1 : 8}
                      onChange={(event) =>
                        setWeddingLineOne(
                          isWeddingInitials
                            ? (event.target.value || "").slice(0, 1).toUpperCase()
                            : (event.target.value || "").slice(0, 8).toUpperCase()
                        )
                      }
                      className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
                      placeholder={isWeddingInitials ? "A" : "Andy"}
                    />
                  </label>
                  <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                    Second {isWeddingInitials ? "initial" : "name"}
                    <input
                      value={weddingLineTwo}
                      maxLength={isWeddingInitials ? 1 : 8}
                      onChange={(event) =>
                        setWeddingLineTwo(
                          isWeddingInitials
                            ? (event.target.value || "").slice(0, 1).toUpperCase()
                            : (event.target.value || "").slice(0, 8).toUpperCase()
                        )
                      }
                      className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
                      placeholder={isWeddingInitials ? "B" : "Bella"}
                    />
                  </label>
                </>
              )}
              {isCustomText && (
                <label className="text-xs uppercase tracking-[0.2em] text-zinc-500 md:col-span-2">
                  Custom text
                  <input
                    value={customText}
                    maxLength={customTextLimit}
                    onChange={(event) => setCustomText((event.target.value || "").slice(0, customTextLimit))}
                    className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
                    placeholder="Your text"
                  />
                  <div className="mt-1 flex items-center justify-between gap-3 text-[11px] normal-case tracking-normal text-zinc-500">
                    <span>
                      {categoryId === "custom-7-14"
                        ? `${LONG_CUSTOM_TEXT_MAX_LENGTH} characters max, including spaces`
                        : `Up to ${SHORT_CUSTOM_TEXT_MAX_LENGTH} letters`}
                    </span>
                    <span>{`${(customText || "").length}/${customTextLimit}`}</span>
                  </div>
                </label>
              )}
              {isBranded ? (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 md:col-span-2">
                  <span className="font-semibold text-zinc-900">Brand name:</span>{" "}
                  {sharedOrganizationName || "Use the organisation / brand name in invoice details."}
                </div>
              ) : null}
              {!isWedding && !isCustomText && !isBranded && (
                <label className="text-xs uppercase tracking-[0.2em] text-zinc-500 md:col-span-2">
                  Design text
                  <input
                    value={designText}
                    onChange={(event) => setDesignText(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
                    placeholder="Design text"
                  />
                </label>
              )}
              <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 md:col-span-2">
                <p>Jacket type</p>
                <input type="hidden" name="jacket" value={jacket} />
                <div className="mt-2 flex flex-wrap gap-2">
                  {JACKET_OPTIONS.map((option) => {
                    const isActive = jacket === option.value;
                    return (
                      <button
                        key={option.value || "single"}
                        type="button"
                        onClick={() => setJacket(option.value)}
                        className={`min-h-11 rounded-full border px-4 py-2 text-sm font-semibold normal-case tracking-normal transition ${
                          isActive
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {jacket !== "rainbow" && (
                <div className="md:col-span-2">
                  <PalettePicker
                    label={showJacketColorTwo ? "Jacket colour 1" : "Jacket colour"}
                    value={jacketColorOne}
                    onChange={setJacketColorOne}
                    groups={paletteGroups}
                    onCustom={() => openCustomPicker("jacket1", jacketColorOne)}
                  />
                </div>
              )}
              {showJacketColorTwo && (
                <div className="md:col-span-2">
                  <PalettePicker
                    label="Jacket colour 2"
                    value={jacketColorTwo}
                    onChange={setJacketColorTwo}
                    groups={paletteGroups}
                    onCustom={() => openCustomPicker("jacket2", jacketColorTwo)}
                  />
                </div>
              )}
              {!isBranded && (
                <div className="md:col-span-2">
                  <PalettePicker
                    label="Text colour"
                    value={textColor}
                    onChange={setTextColor}
                    groups={paletteGroups}
                    onCustom={() => openCustomPicker("text", textColor)}
                  />
                </div>
              )}
              {isWedding && (
                <div className="md:col-span-2">
                  <PalettePicker
                    label="Heart colour"
                    value={heartColor}
                    onChange={setHeartColor}
                    groups={paletteGroups}
                    onCustom={() => openCustomPicker("heart", heartColor)}
                  />
                </div>
              )}
              <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                Candy flavor
                <select
                  name="flavor"
                  value={flavor}
                  onChange={(event) => setFlavor(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
                >
                  <option value="">Select flavor</option>
                  {flavors.map((item) => (
                    <option key={item.id} value={item.name}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              {isBranded && (
                <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 md:col-span-2">
                  <label htmlFor="logo-upload">Upload Your Design</label>
                  <div className="mt-2">
                    <input
                      id="logo-upload"
                      type="file"
                      accept="image/*"
                      onChange={(event) => handleLogoUpload(event.target.files?.[0] ?? null)}
                      className="sr-only"
                    />
                    <label
                      htmlFor="logo-upload"
                      className="inline-flex cursor-pointer items-center rounded border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-300"
                    >
                      Choose file (2mb max)
                    </label>
                  </div>
                  {logoError && (
                    <p className="mt-1 text-xs normal-case tracking-normal text-red-600">{logoError}</p>
                  )}
                  {isOptimisingLogo ? (
                    <div className="mt-2">
                      <ImageOptimizationStatus
                        summary={null}
                        pendingLabel="Optimising image..."
                        helperText="This artwork is compressed before it is attached to the order."
                      />
                    </div>
                  ) : logoSummary ? (
                    <div className="mt-2">
                      <ImageOptimizationStatus
                        summary={logoSummary}
                        helperText="This artwork is compressed before it is attached to the order."
                      />
                    </div>
                  ) : null}
                </div>
              )}
              </div>
              <aside className="flex min-h-[13rem] items-center justify-center px-2 py-2 lg:sticky lg:top-40">
                <CandyPreview
                  designText={!isBranded && !isWedding ? designTextValue || "Candy" : undefined}
                  lineOne={isWedding ? weddingLineOne : undefined}
                  lineTwo={isWedding ? weddingLineTwo : undefined}
                  showHeart={isWedding}
                  mode={previewJacketMode}
                  showPinstripe={previewShowPinstripe}
                  colorOne={jacketColorOne || defaultJacketColor}
                  colorTwo={jacketColorTwo || jacketColorOne || defaultJacketColor}
                  logoUrl={isBranded ? logoUrl : undefined}
                  textColor={textColor || defaultTextColor}
                  heartColor={heartColor || textColor || defaultTextColor}
                  isInitials={isWeddingInitials}
                  customTextVariant={previewCustomTextVariant}
                  dimensions={{ width: 300, height: 223 }}
                  zoom={1.05}
                />
              </aside>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
              <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                Date required
                <input
                  type="date"
                  name="due_date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  className="mt-4 min-h-11 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
                />
              </label>
              <label className="block">
                <span className="admin-card-title text-zinc-900">Production Notes</span>
                <textarea
                  name="notes"
                  key={`notes-${activeInvoiceDraftId}-${orderFieldsKey}`}
                  defaultValue={draftValue(activeInvoiceDraft, "notes", initialOrder?.notes ?? "")}
                  className="mt-4 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
                  rows={5}
                  placeholder="Internal notes for this order."
                />
              </label>
            </div>
          </div>
          {invoiceDraftMode ? renderInvoiceTabs("bottom") : null}
        </>
      ) : null}

        </>
      ) : null}

      {productionSlotPickerOpen ? (
      <AssignmentCalendarModal
        order={productionCalendarOrder}
        allOrders={orders}
        assignments={assignments}
        slots={slots}
        settings={settings}
        onClose={() => {
          setProductionSlotPickerOpen(false);
          setSubmitAfterCalendarPick(false);
          }}
          mode="pick"
          onPickSlot={({ slotDate }) => {
            setProductionSlotDate(slotDate);
            setProductionSlotPickerOpen(false);
            setSubmitAfterCalendarPick(true);
          }}
        />
      ) : null}

      {customPickerOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-zinc-900/40 px-4">
          <div
            className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="admin-subsection-title text-zinc-900">Set a brand color</h3>
              </div>
              <button
                type="button"
                onClick={() => setCustomPickerOpen(false)}
                data-plain-button
                className="rounded-full px-2 py-1 text-lg font-semibold text-zinc-600"
                aria-label="Close"
              >
                X
              </button>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1.2fr] md:items-start">
              <label
                htmlFor="custom-color-picker"
                className="text-xs uppercase tracking-[0.2em] text-zinc-500"
              >
                Click here
              </label>
              <div className="md:col-start-1 md:row-start-2">
                <input
                  id="custom-color-picker"
                  type="color"
                  value={customHex}
                  onChange={(event) => {
                    const next = normalizeHex(event.target.value, customHex);
                    setCustomHex(next);
                    setCustomHexInput(next);
                    const nextCmyk = hexToCmyk(next);
                    if (nextCmyk) setCustomCmyk(nextCmyk);
                    const nextRgba = hexToRgba(next, customRgba.a);
                    if (nextRgba) setCustomRgba(nextRgba);
                  }}
                  className="h-24 w-full cursor-pointer rounded-lg border border-zinc-200 bg-white p-0"
                />
              </div>
              <div className="space-y-2 md:col-start-2 md:row-start-2">
                <div className="flex w-full overflow-hidden rounded-2xl border border-[#e91e63] bg-[#fedae1] divide-x divide-[#e91e63]/30">
                  <button
                    type="button"
                    data-segmented
                    data-active={customInputMode === "hex" ? "true" : "false"}
                    onClick={() => setCustomInputMode("hex")}
                    className="flex-1 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition"
                  >
                    Hex
                  </button>
                  <button
                    type="button"
                    data-segmented
                    data-active={customInputMode === "cmyk" ? "true" : "false"}
                    onClick={() => {
                      setCustomInputMode("cmyk");
                      const next = hexToCmyk(normalizeHex(customHex, defaultJacketColor));
                      if (next) setCustomCmyk(next);
                    }}
                    className="flex-1 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition"
                  >
                    CMYK
                  </button>
                  <button
                    type="button"
                    data-segmented
                    data-active={customInputMode === "rgba" ? "true" : "false"}
                    onClick={() => {
                      setCustomInputMode("rgba");
                      const next = hexToRgba(normalizeHex(customHex, defaultJacketColor), customRgba.a);
                      if (next) setCustomRgba(next);
                    }}
                    className="flex-1 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition"
                  >
                    RGB
                  </button>
                </div>
                {customInputMode === "hex" ? (
                  <div className="space-y-2">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">Hex</div>
                    <input
                      type="text"
                      value={customHexInput}
                      onChange={(event) => {
                        const next = sanitizeHexInput(event.target.value);
                        setCustomHexInput(next);
                        const normalized = parseHexInput(next);
                        if (normalized) {
                          setCustomHex(normalized);
                          const nextCmyk = hexToCmyk(normalized);
                          if (nextCmyk) setCustomCmyk(nextCmyk);
                          const nextRgba = hexToRgba(normalized, customRgba.a);
                          if (nextRgba) setCustomRgba(nextRgba);
                        }
                      }}
                      onBlur={(event) => {
                        const normalized = parseHexInput(event.target.value);
                        if (normalized) {
                          setCustomHex(normalized);
                          setCustomHexInput(normalized);
                          const nextCmyk = hexToCmyk(normalized);
                          if (nextCmyk) setCustomCmyk(nextCmyk);
                          const nextRgba = hexToRgba(normalized, customRgba.a);
                          if (nextRgba) setCustomRgba(nextRgba);
                        } else {
                          setCustomHexInput(customHex);
                        }
                      }}
                      placeholder="#RRGGBB"
                      aria-label="Hex"
                      className="w-full rounded border border-zinc-200 px-2 py-1 text-xs font-medium uppercase tracking-[0.08em]"
                    />
                  </div>
                ) : customInputMode === "cmyk" ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-4 gap-2 text-[10px] uppercase tracking-[0.2em] text-zinc-400">
                      <span>C</span>
                      <span>M</span>
                      <span>Y</span>
                      <span>K</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {(["c", "m", "y", "k"] as const).map((key) => (
                        <input
                          key={key}
                          type="number"
                          min={0}
                          max={100}
                          value={customCmyk[key]}
                          onChange={(event) => {
                            const nextValue = clampChannel(Number(event.target.value));
                            const next = { ...customCmyk, [key]: nextValue };
                            setCustomCmyk(next);
                            const nextHex = cmykToHex(next);
                            setCustomHex(nextHex);
                            setCustomHexInput(nextHex);
                            const nextRgba = hexToRgba(nextHex, customRgba.a);
                            if (nextRgba) setCustomRgba(nextRgba);
                          }}
                          aria-label={`CMYK ${key.toUpperCase()}`}
                          className="rounded border border-zinc-200 px-2 py-1 text-xs"
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2 text-[10px] uppercase tracking-[0.2em] text-zinc-400">
                      <span>R</span>
                      <span>G</span>
                      <span>B</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {(["r", "g", "b"] as const).map((key) => (
                        <input
                          key={key}
                          type="number"
                          min={0}
                          max={255}
                          value={customRgba[key]}
                          onChange={(event) => {
                            const nextValue = clampByte(Number(event.target.value));
                            const next = { ...customRgba, [key]: nextValue };
                            setCustomRgba(next);
                            const nextHex = rgbaToHex(next);
                            setCustomHex(nextHex);
                            setCustomHexInput(nextHex);
                            const nextCmyk = hexToCmyk(nextHex);
                            if (nextCmyk) setCustomCmyk(nextCmyk);
                          }}
                          aria-label={`RGB ${key.toUpperCase()}`}
                          className="rounded border border-zinc-200 px-2 py-1 text-xs"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCustomPickerOpen(false)}
                data-neutral-button
                className="rounded-md px-4 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyCustomColor}
                className="rounded-md border border-zinc-900 bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                Use this colour
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <Link
          href={cancelHref}
          className="rounded border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-300"
        >
          Cancel
        </Link>
        {isAdminPremadeOrder && !isEditMode ? (
          <button
            type="button"
            onClick={() => {
              setSubmitAfterCalendarPick(false);
              setProductionSlotPickerOpen(true);
            }}
            disabled={isSubmittingOrder || !isAdminPremadeReady}
            className="rounded border border-zinc-900 bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:border-zinc-300 disabled:bg-zinc-200 disabled:text-zinc-500"
          >
            Add to Calendar
          </button>
        ) : null}
        {reviewMode ? (
          <button
            type="button"
            onClick={() => setReviewMode(false)}
            className="rounded border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-300"
          >
            Back to edit
          </button>
        ) : null}
        {invoiceDraftMode && !isAdminPremadeOrder && !reviewMode ? (
          <button
            type="button"
            onClick={openReview}
            disabled={isSubmittingOrder || !batchWeightsValid || Boolean(pricingError) || isPricing}
            className="rounded border border-zinc-900 bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:border-zinc-300 disabled:bg-zinc-200 disabled:text-zinc-500"
          >
            Review order
          </button>
        ) : (
          <button
            type="submit"
            name="submit_intent"
            value={invoiceDraftMode && !isAdminPremadeOrder ? "create_tabbed_invoice" : "save"}
            disabled={isSubmittingOrder || (isAdminPremadeOrder ? !isAdminPremadeReady : !batchWeightsValid || Boolean(pricingError))}
            className="rounded border border-zinc-900 bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:border-zinc-300 disabled:bg-zinc-200 disabled:text-zinc-500"
          >
            {isSubmittingOrder
              ? isEditMode
                ? "Saving..."
                : "Creating invoice..."
              : isEditMode
                ? "Save order"
                : isAdminPremadeOrder
                  ? "Add to Orders"
                  : reviewMode
                    ? "Create Square draft invoice"
                    : "Create Invoice"}
          </button>
        )}
        <button
          ref={scheduleSubmitButtonRef}
          type="submit"
          name="submit_intent"
          value="save_and_schedule"
          className="hidden"
          tabIndex={-1}
          aria-hidden="true"
        >
          Add to Calendar
        </button>
      </div>
    </form>
  );
}
