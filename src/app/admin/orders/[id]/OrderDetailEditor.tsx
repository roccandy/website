"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Edit3, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import type { Category, Flavor, OrderRow, PackagingOption, SettingsRow } from "@/lib/data";
import {
  MAX_ADMIN_BATCH_COUNT,
  suggestedAdminBatchWeights,
  type AdminDiscountType,
} from "@/lib/adminLargeOrders";
import { formatDateInput, formatMoney, formatOrderDescription, splitCustomerName } from "../productionScheduleShared";
import { isAdminManagedCustomOrder } from "../scheduleVisibility";
import { upsertOrder } from "../actions";
import { splitWeddingDesign } from "@/app/quote/quoteBuilderShared";

const BULK_LABEL_COUNT_MAX = 1000;

const STATES = ["", "ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"];

const STATUS_OPTIONS = [
  "pending",
  "unassigned",
  "scheduled",
  "made",
  "archived",
  "cancelled",
  "test",
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

type QuoteRequest =
  | { status: "idle" }
  | { status: "invalid"; error: string }
  | {
      status: "ready";
      key: string;
      body: {
        categoryId: string;
        packagingOptionId: string;
        quantity: number;
        labelsCount: number;
        ingredientLabelsCount: number;
        dueDate?: string;
        jacket: string | null;
        batchWeightsKg: string[];
        discountType: AdminDiscountType;
        discountValue: number | null;
        priceOverride: number | null;
      };
    };

type QuoteState = {
  key: string;
  quote: AdminQuoteResponse | null;
  error: string | null;
};

type DetailState = {
  title: string;
  orderDescription: string;
  categoryId: string;
  packagingOptionId: string;
  quantity: string;
  dueDate: string;
  status: string;
  pickup: boolean;
  firstName: string;
  lastName: string;
  customerEmail: string;
  phone: string;
  organizationName: string;
  addressLine1: string;
  addressLine2: string;
  suburb: string;
  state: string;
  postcode: string;
  designType: string;
  designText: string;
  weddingLineOne: string;
  weddingLineTwo: string;
  flavor: string;
  jacket: string;
  jarLidColor: string;
  logoUrl: string;
  labelImageUrl: string;
  labelsEnabled: boolean;
  labelsCount: string;
  ingredientLabelsEnabled: boolean;
  ingredientLabelsCount: string;
  totalWeightKg: string;
  batchWeights: string[];
  totalPrice: string;
  discountType: AdminDiscountType;
  discountValue: string;
  priceOverride: string;
  paymentMethod: string;
  notes: string;
  customerNote: string;
};

type Props = {
  order: OrderRow;
  categories: Category[];
  packagingOptions: PackagingOption[];
  flavors: Flavor[];
  settings: SettingsRow;
  cancelHref: string;
};

function formatInputNumber(value: number | null | undefined, decimals = 2) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "";
  return parsed.toFixed(decimals).replace(/\.?0+$/, "");
}

function roundKg(value: number) {
  return Math.round(value * 100) / 100;
}

function formatKgInput(value: number | null | undefined) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "";
  return roundKg(parsed).toFixed(2).replace(/\.?0+$/, "");
}

function normalizeDiscountType(value: string | null | undefined): AdminDiscountType {
  if (value === "percent" || value === "fixed") return value;
  return "none";
}

function normalizedText(value: string) {
  return value.trim();
}

function normalizedNumberKey(value: string, decimals = 2) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "";
  return parsed.toFixed(decimals);
}

function normalizedBatchKey(values: string[]) {
  return values.map((value) => normalizedNumberKey(value)).filter(Boolean).join("|");
}

function inputClass(changed: boolean) {
  return [
    "mt-1 min-h-10 w-full rounded-lg border px-3 py-2 text-sm text-zinc-900 outline-none transition",
    changed
      ? "border-amber-300 bg-amber-50/60 focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
      : "border-zinc-200 bg-white focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100",
  ].join(" ");
}

function textareaClass(changed: boolean) {
  return [
    "mt-1 min-h-28 w-full rounded-lg border px-3 py-2 text-sm text-zinc-900 outline-none transition",
    changed
      ? "border-amber-300 bg-amber-50/60 focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
      : "border-zinc-200 bg-white focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100",
  ].join(" ");
}

function isImageLikeUrl(value: string) {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.startsWith("data:image/") ||
    /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/.test(normalized)
  );
}

function composeWeddingDesign(lineOne: string, lineTwo: string, initials: boolean) {
  const left = initials ? lineOne.trim().toUpperCase() : lineOne.trim();
  const right = initials ? lineTwo.trim().toUpperCase() : lineTwo.trim();
  if (!left && !right) return "";
  return `${left} ♥ ${right}`.trim();
}

function Field({
  label,
  changed,
  children,
  className = "",
}: {
  label: string;
  changed: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 ${className}`}>
      <span className="flex min-h-5 items-center gap-2">
        {label}
        {changed ? (
          <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-amber-800">
            Unsaved
          </span>
        ) : null}
      </span>
      {children}
    </label>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm">
      <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

function DetailItem({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-[8rem_minmax(0,1fr)] gap-2 ${className}`}>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">{label}</dt>
      <dd className="min-w-0 break-words text-sm font-semibold text-zinc-900">{children || "-"}</dd>
    </div>
  );
}

function AssetPreview({ label, url }: { label: string; url: string }) {
  const trimmed = url.trim();
  return (
    <DetailItem label={label} className="xl:col-span-3">
      {trimmed ? (
        <div className="flex min-w-0 items-center gap-3">
          {isImageLikeUrl(trimmed) ? (
            <Image
              src={trimmed}
              alt={`${label} preview`}
              width={56}
              height={56}
              unoptimized
              className="h-14 w-14 shrink-0 rounded border border-zinc-200 bg-zinc-50 object-contain"
            />
          ) : (
            <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded border border-zinc-200 bg-zinc-50 text-[10px] font-semibold text-zinc-500">
              File
            </span>
          )}
          <a
            href={trimmed}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 truncate text-xs font-semibold text-zinc-700 underline-offset-2 hover:underline"
          >
            {trimmed}
          </a>
        </div>
      ) : (
        "-"
      )}
    </DetailItem>
  );
}

function buildInitialState(order: OrderRow, packagingOptions: PackagingOption[]): DetailState {
  const splitName = splitCustomerName(order.customer_name);
  const packagingOption = packagingOptions.find((option) => option.id === order.packaging_option_id) ?? null;
  const storedQuantity = Number(order.quantity);
  const derivedQuantity =
    packagingOption && Number(packagingOption.candy_weight_g) > 0 && Number(order.total_weight_kg) > 0
      ? roundKg((Number(order.total_weight_kg) * 1000) / Number(packagingOption.candy_weight_g))
      : NaN;
  const quantity =
    Number.isFinite(derivedQuantity) &&
    derivedQuantity > 0 &&
    (!Number.isFinite(storedQuantity) || Math.abs(storedQuantity - derivedQuantity) > 0.01)
      ? derivedQuantity
      : storedQuantity;
  const wedding = splitWeddingDesign(order.design_text);
  const batchWeights =
    Array.isArray(order.admin_batch_weights_kg) && order.admin_batch_weights_kg.length > 0
      ? order.admin_batch_weights_kg
          .map((weight) => Number(weight))
          .filter((weight) => Number.isFinite(weight) && weight > 0)
          .map((weight) => formatKgInput(weight))
      : Number(order.total_weight_kg) > 0
        ? [formatKgInput(order.total_weight_kg)]
        : [];

  return {
    title: order.title ?? "",
    orderDescription: order.order_description ?? "",
    categoryId: order.category_id ?? "",
    packagingOptionId: order.packaging_option_id ?? "",
    quantity: Number.isFinite(quantity) && quantity > 0 ? formatInputNumber(quantity, Number.isInteger(quantity) ? 0 : 2) : "",
    dueDate: formatDateInput(order.due_date),
    status: order.status ?? "pending",
    pickup: Boolean(order.pickup),
    firstName: order.first_name ?? splitName.first,
    lastName: order.last_name ?? splitName.last,
    customerEmail: order.customer_email ?? "",
    phone: order.phone ?? "",
    organizationName: order.organization_name ?? "",
    addressLine1: order.address_line1 ?? "",
    addressLine2: order.address_line2 ?? "",
    suburb: order.suburb ?? "",
    state: order.state ?? "",
    postcode: order.postcode ?? "",
    designType: order.design_type ?? "",
    designText: order.design_text ?? "",
    weddingLineOne: wedding.lineOne,
    weddingLineTwo: wedding.lineTwo,
    flavor: order.flavor ?? "",
    jacket: order.jacket ?? "",
    jarLidColor: order.jar_lid_color ?? "",
    logoUrl: order.logo_url ?? "",
    labelImageUrl: order.label_image_url ?? "",
    labelsEnabled: Number(order.labels_count) > 0,
    labelsCount: order.labels_count ? formatInputNumber(order.labels_count, 0) : "",
    ingredientLabelsEnabled: Number(order.ingredient_labels_count) > 0,
    ingredientLabelsCount: order.ingredient_labels_count
      ? formatInputNumber(order.ingredient_labels_count, 0)
      : "",
    totalWeightKg: formatKgInput(order.total_weight_kg),
    batchWeights,
    totalPrice: order.total_price !== null ? Number(order.total_price).toFixed(2) : "",
    discountType: normalizeDiscountType(order.admin_discount_type),
    discountValue: order.admin_discount_value ? formatInputNumber(order.admin_discount_value) : "",
    priceOverride: order.admin_price_override ? formatInputNumber(order.admin_price_override) : "",
    paymentMethod: order.payment_method ?? "",
    notes: order.notes ?? "",
    customerNote: order.customer_note ?? "",
  };
}

function categoryLabel(value: string, categories: Category[]) {
  if (!value) return "-";
  return categories.find((category) => category.id === value)?.name ?? value;
}

function optionLabel(option: PackagingOption | null | undefined) {
  if (!option) return "-";
  return [option.type, option.size].filter(Boolean).join(" - ");
}

function changedLine(label: string, from: string, to: string) {
  return from.trim() === to.trim() ? null : `${label}: ${from || "-"} -> ${to || "-"}`;
}

export function OrderDetailEditor({
  order,
  categories,
  packagingOptions,
  flavors,
  settings,
  cancelHref,
}: Props) {
  const original = useMemo(() => buildInitialState(order, packagingOptions), [order, packagingOptions]);
  const [draft, setDraft] = useState<DetailState>(original);
  const [quoteState, setQuoteState] = useState<QuoteState>({ key: "", quote: null, error: null });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const sendUpdatedInvoiceInputRef = useRef<HTMLInputElement | null>(null);

  const packagingById = useMemo(
    () => new Map(packagingOptions.map((option) => [option.id, option])),
    [packagingOptions],
  );
  const selectedPackagingOption = packagingById.get(draft.packagingOptionId) ?? null;
  const originalPackagingOption = packagingById.get(original.packagingOptionId) ?? null;
  const isWedding = draft.categoryId.startsWith("weddings");
  const isWeddingInitials = draft.categoryId === "weddings-initials";
  const weddingDesignText = composeWeddingDesign(draft.weddingLineOne, draft.weddingLineTwo, isWeddingInitials);
  const effectiveDesignText = isWedding ? weddingDesignText : draft.designText;
  const effectiveTitle = isWedding ? weddingDesignText || draft.title : draft.title;
  const packagingOptionsForCategory = useMemo(() => {
    const filtered = draft.categoryId
      ? packagingOptions.filter((option) => option.allowed_categories?.includes(draft.categoryId))
      : packagingOptions;
    if (draft.packagingOptionId && !filtered.some((option) => option.id === draft.packagingOptionId)) {
      const current = packagingById.get(draft.packagingOptionId);
      return current ? [current, ...filtered] : filtered;
    }
    return filtered;
  }, [draft.categoryId, draft.packagingOptionId, packagingById, packagingOptions]);

  const customerName = [draft.firstName, draft.lastName].map((value) => value.trim()).filter(Boolean).join(" ");
  const orderLikeForDescription = useMemo(
    () =>
      ({
        ...order,
        order_description: draft.orderDescription || order.order_description,
        packaging_option_id: draft.packagingOptionId || null,
        quantity: Number(draft.quantity) || null,
      }) as OrderRow,
    [draft.orderDescription, draft.packagingOptionId, draft.quantity, order],
  );
  const packagingDescription = formatOrderDescription(orderLikeForDescription, selectedPackagingOption);
  const batchTotalKg = draft.batchWeights.reduce((sum, value) => {
    const parsed = Number(value);
    return sum + (Number.isFinite(parsed) ? parsed : 0);
  }, 0);
  const totalWeightNumber = Number(draft.totalWeightKg);
  const roundedBatchTotalKg = roundKg(batchTotalKg);
  const roundedTotalWeightKg = roundKg(totalWeightNumber);
  const batchAllocationValid =
    draft.batchWeights.length > 0 &&
    draft.batchWeights.length <= MAX_ADMIN_BATCH_COUNT &&
    Number.isFinite(totalWeightNumber) &&
    totalWeightNumber > 0 &&
    Math.abs(roundedBatchTotalKg - roundedTotalWeightKg) <= 0.02;

  const changed = useMemo(
    () => ({
      title: normalizedText(draft.title) !== normalizedText(original.title),
      orderDescription: normalizedText(draft.orderDescription) !== normalizedText(original.orderDescription),
      categoryId: draft.categoryId !== original.categoryId,
      packagingOptionId: draft.packagingOptionId !== original.packagingOptionId,
      quantity: normalizedNumberKey(draft.quantity, 0) !== normalizedNumberKey(original.quantity, 0),
      dueDate: draft.dueDate !== original.dueDate,
      status: draft.status !== original.status,
      pickup: draft.pickup !== original.pickup,
      firstName: normalizedText(draft.firstName) !== normalizedText(original.firstName),
      lastName: normalizedText(draft.lastName) !== normalizedText(original.lastName),
      customerEmail: normalizedText(draft.customerEmail) !== normalizedText(original.customerEmail),
      phone: normalizedText(draft.phone) !== normalizedText(original.phone),
      organizationName: normalizedText(draft.organizationName) !== normalizedText(original.organizationName),
      addressLine1: normalizedText(draft.addressLine1) !== normalizedText(original.addressLine1),
      addressLine2: normalizedText(draft.addressLine2) !== normalizedText(original.addressLine2),
      suburb: normalizedText(draft.suburb) !== normalizedText(original.suburb),
      state: draft.state !== original.state,
      postcode: normalizedText(draft.postcode) !== normalizedText(original.postcode),
      designType: normalizedText(draft.designType) !== normalizedText(original.designType),
      designText: normalizedText(effectiveDesignText) !== normalizedText(original.designText),
      weddingLineOne: normalizedText(draft.weddingLineOne) !== normalizedText(original.weddingLineOne),
      weddingLineTwo: normalizedText(draft.weddingLineTwo) !== normalizedText(original.weddingLineTwo),
      flavor: normalizedText(draft.flavor) !== normalizedText(original.flavor),
      jacket: draft.jacket !== original.jacket,
      jarLidColor: normalizedText(draft.jarLidColor) !== normalizedText(original.jarLidColor),
      logoUrl: normalizedText(draft.logoUrl) !== normalizedText(original.logoUrl),
      labelImageUrl: normalizedText(draft.labelImageUrl) !== normalizedText(original.labelImageUrl),
      labelsEnabled: draft.labelsEnabled !== original.labelsEnabled,
      labelsCount: normalizedNumberKey(draft.labelsCount, 0) !== normalizedNumberKey(original.labelsCount, 0),
      ingredientLabelsEnabled: draft.ingredientLabelsEnabled !== original.ingredientLabelsEnabled,
      ingredientLabelsCount:
        normalizedNumberKey(draft.ingredientLabelsCount, 0) !== normalizedNumberKey(original.ingredientLabelsCount, 0),
      totalWeightKg: normalizedNumberKey(draft.totalWeightKg) !== normalizedNumberKey(original.totalWeightKg),
      batchWeights: normalizedBatchKey(draft.batchWeights) !== normalizedBatchKey(original.batchWeights),
      totalPrice: normalizedNumberKey(draft.totalPrice) !== normalizedNumberKey(original.totalPrice),
      discountType: draft.discountType !== original.discountType,
      discountValue: normalizedNumberKey(draft.discountValue) !== normalizedNumberKey(original.discountValue),
      priceOverride: normalizedNumberKey(draft.priceOverride) !== normalizedNumberKey(original.priceOverride),
      paymentMethod: normalizedText(draft.paymentMethod) !== normalizedText(original.paymentMethod),
      notes: normalizedText(draft.notes) !== normalizedText(original.notes),
      customerNote: normalizedText(draft.customerNote) !== normalizedText(original.customerNote),
    }),
    [draft, effectiveDesignText, original],
  );

  const dirtyCount = Object.values(changed).filter(Boolean).length;
  const priceAffectingChanged =
    changed.categoryId ||
    changed.packagingOptionId ||
    changed.quantity ||
    changed.dueDate ||
    changed.jacket ||
    changed.labelsEnabled ||
    changed.labelsCount ||
    changed.ingredientLabelsEnabled ||
    changed.ingredientLabelsCount ||
    changed.totalWeightKg ||
    changed.batchWeights ||
    changed.discountType ||
    changed.discountValue ||
    changed.priceOverride;

  const quoteRequest = useMemo<QuoteRequest>(() => {
    if (!priceAffectingChanged) {
      return { status: "idle" };
    }

    const quantity = Number(draft.quantity);
    if (!draft.categoryId || !draft.packagingOptionId || !Number.isFinite(quantity) || quantity <= 0) {
      return {
        status: "invalid",
        error: "Order type, packaging, and quantity are required before price can be recalculated.",
      };
    }

    if (!batchAllocationValid) {
      return {
        status: "invalid",
        error: "Batch weights must add up to the total weight before price can be recalculated.",
      };
    }

    const body = {
      categoryId: draft.categoryId,
      packagingOptionId: draft.packagingOptionId,
      quantity,
      labelsCount: draft.labelsEnabled ? Number(draft.labelsCount || 0) : 0,
      ingredientLabelsCount: draft.ingredientLabelsEnabled ? Number(draft.ingredientLabelsCount || 0) : 0,
      dueDate: draft.dueDate || undefined,
      jacket: draft.jacket || null,
      batchWeightsKg: draft.batchWeights,
      discountType: draft.discountType,
      discountValue: draft.discountValue ? Number(draft.discountValue) : null,
      priceOverride: draft.priceOverride ? Number(draft.priceOverride) : null,
    };

    return {
      status: "ready",
      key: JSON.stringify(body),
      body,
    };
  }, [
    batchAllocationValid,
    draft.batchWeights,
    draft.categoryId,
    draft.discountType,
    draft.discountValue,
    draft.dueDate,
    draft.ingredientLabelsCount,
    draft.ingredientLabelsEnabled,
    draft.jacket,
    draft.labelsCount,
    draft.labelsEnabled,
    draft.packagingOptionId,
    draft.priceOverride,
    draft.quantity,
    priceAffectingChanged,
  ]);

  useEffect(() => {
    if (quoteRequest.status !== "ready") return;
    const controller = new AbortController();

    fetch("/api/admin/orders/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify(quoteRequest.body),
    })
      .then(async (response) => {
        const data = (await response.json()) as AdminQuoteResponse;
        if (!response.ok) {
          throw new Error(data.error || "Unable to calculate price.");
        }
        return data;
      })
      .then((data) => {
        setQuoteState({ key: quoteRequest.key, quote: data, error: null });
      })
      .catch((error: Error) => {
        if (controller.signal.aborted) return;
        setQuoteState({ key: quoteRequest.key, quote: null, error: error.message });
      });

    return () => controller.abort();
  }, [quoteRequest]);

  const quote = quoteRequest.status === "ready" && quoteState.key === quoteRequest.key ? quoteState.quote : null;
  const quoteError =
    quoteRequest.status === "invalid"
      ? quoteRequest.error
      : quoteRequest.status === "ready" && quoteState.key === quoteRequest.key
        ? quoteState.error
        : null;
  const isQuoteLoading = quoteRequest.status === "ready" && quoteState.key !== quoteRequest.key;

  const setField = <Key extends keyof DetailState>(key: Key, value: DetailState[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const setPackagingOption = (optionId: string) => {
    const nextOption = packagingById.get(optionId);
    setDraft((current) => {
      const quantity = Number(current.quantity);
      const nextWeight =
        nextOption && Number.isFinite(quantity) && quantity > 0
          ? formatKgInput((Number(nextOption.candy_weight_g) * quantity) / 1000)
          : current.totalWeightKg;
      return {
        ...current,
        packagingOptionId: optionId,
        totalWeightKg: nextWeight,
      };
    });
  };

  const setQuantity = (value: string) => {
    setDraft((current) => {
      const quantity = Number(value);
      const nextWeight =
        selectedPackagingOption && Number.isFinite(quantity) && quantity > 0
          ? formatKgInput((Number(selectedPackagingOption.candy_weight_g) * quantity) / 1000)
          : current.totalWeightKg;
      return {
        ...current,
        quantity: value,
        totalWeightKg: nextWeight,
      };
    });
  };

  const applyEqualBatchSplit = () => {
    const total = Number(draft.totalWeightKg);
    if (!Number.isFinite(total) || total <= 0) return;
    const weights = suggestedAdminBatchWeights(total, Number(settings.max_total_kg));
    if (weights.length === 0) return;
    setField(
      "batchWeights",
      weights.map((weight) => formatKgInput(weight)),
    );
  };

  const updateBatchWeight = (index: number, value: string) => {
    setDraft((current) => ({
      ...current,
      batchWeights: current.batchWeights.map((item, itemIndex) => (itemIndex === index ? value : item)),
    }));
  };

  const removeBatchWeight = (index: number) => {
    setDraft((current) => ({
      ...current,
      batchWeights: current.batchWeights.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const addBatchWeight = () => {
    setDraft((current) => ({
      ...current,
      batchWeights: [...current.batchWeights, ""].slice(0, MAX_ADMIN_BATCH_COUNT),
    }));
  };

  const replacementInvoiceAllowed = Boolean(
    order.square_invoice_id &&
      isAdminManagedCustomOrder(order) &&
      !order.paid_at &&
      order.square_invoice_status?.toUpperCase() !== "PAID",
  );
  const effectiveTotalPrice = quote?.total !== undefined ? quote.total.toFixed(2) : draft.totalPrice;
  const invoiceChangeLines = [
    changedLine("Order type", categoryLabel(original.categoryId, categories), categoryLabel(draft.categoryId, categories)),
    changedLine("Packaging", optionLabel(originalPackagingOption), optionLabel(selectedPackagingOption)),
    changedLine("Quantity", original.quantity, draft.quantity),
    changedLine("Weight", `${original.totalWeightKg || "-"}kg`, `${draft.totalWeightKg || "-"}kg`),
    changedLine("Batches", original.batchWeights.join(" + "), draft.batchWeights.join(" + ")),
    changedLine("Due date", original.dueDate, draft.dueDate),
    changedLine("Jacket", original.jacket || "Single colour", draft.jacket || "Single colour"),
    changedLine("Custom labels", original.labelsEnabled ? original.labelsCount || "Yes" : "No", draft.labelsEnabled ? draft.labelsCount || "Yes" : "No"),
    changedLine(
      "Ingredient labels",
      original.ingredientLabelsEnabled ? original.ingredientLabelsCount || "Yes" : "No",
      draft.ingredientLabelsEnabled ? draft.ingredientLabelsCount || "Yes" : "No",
    ),
    changedLine("Discount", original.discountType, draft.discountType),
    changedLine("Discount value", original.discountValue, draft.discountValue),
    changedLine("Price override", original.priceOverride, draft.priceOverride),
    quote ? changedLine("Calculated total", formatMoney(order.total_price), formatMoney(quote.total)) : null,
  ].filter((line): line is string => Boolean(line));
  const saveDisabled =
    dirtyCount === 0 || isSubmitting || (priceAffectingChanged && (!batchAllocationValid || isQuoteLoading || Boolean(quoteError)));
  const labelMax = Math.min(Number(settings.labels_max_bulk) || BULK_LABEL_COUNT_MAX, BULK_LABEL_COUNT_MAX);
  const shownPaymentMethod = draft.paymentMethod || order.payment_provider || "-";

  if (!isEditing) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-zinc-900 bg-zinc-950 px-4 py-3 text-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid gap-3 text-sm sm:grid-cols-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-400">Total</p>
                <p className="font-semibold">{formatMoney(order.total_price)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-400">Weight</p>
                <p className="font-semibold">{draft.totalWeightKg ? `${draft.totalWeightKg}kg` : "-"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-400">Packaging</p>
                <p className="font-semibold">{packagingDescription || "-"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-400">Payment</p>
                <p className="font-semibold">{shownPaymentMethod}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-white bg-white px-3 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-zinc-100"
            >
              <Edit3 size={14} aria-hidden="true" />
              Edit
            </button>
          </div>
        </div>

        <Section title="Order">
          <DetailItem label="Title">{effectiveTitle || "-"}</DetailItem>
          <DetailItem label="Status">{draft.status || "-"}</DetailItem>
          <DetailItem label="Required">{draft.dueDate || "-"}</DetailItem>
          <DetailItem label="Order type">{categoryLabel(draft.categoryId, categories)}</DetailItem>
          <DetailItem label="Pickup">{draft.pickup ? "Pickup" : "Delivery"}</DetailItem>
          <DetailItem label="Payment">{shownPaymentMethod}</DetailItem>
          <DetailItem label="Description" className="xl:col-span-3">{draft.orderDescription || "-"}</DetailItem>
        </Section>

        <Section title="Customer">
          <DetailItem label="Name">{customerName || order.customer_name || "-"}</DetailItem>
          <DetailItem label="Email">{draft.customerEmail || "-"}</DetailItem>
          <DetailItem label="Phone">{draft.phone || "-"}</DetailItem>
          <DetailItem label="Organisation">{draft.organizationName || "-"}</DetailItem>
          <DetailItem label="Address" className="xl:col-span-2">
            {draft.pickup
              ? "Pickup"
              : [draft.addressLine1, draft.addressLine2, draft.suburb, draft.state, draft.postcode].filter(Boolean).join(", ") || "-"}
          </DetailItem>
        </Section>

        <Section title="Packaging And Production">
          <DetailItem label="Packaging">{optionLabel(selectedPackagingOption)}</DetailItem>
          <DetailItem label="Quantity">{draft.quantity || "-"}</DetailItem>
          <DetailItem label="Weight">{draft.totalWeightKg ? `${draft.totalWeightKg}kg` : "-"}</DetailItem>
          <DetailItem label="Batches" className="xl:col-span-3">
            {draft.batchWeights.length > 0 ? draft.batchWeights.map((weight) => `${weight}kg`).join(" + ") : "-"}
          </DetailItem>
          <DetailItem label="Jar lid">{draft.jarLidColor || "-"}</DetailItem>
        </Section>

        <Section title="Design And Labels">
          <DetailItem label="Design type">{draft.designType || "-"}</DetailItem>
          <DetailItem label="Flavour">{draft.flavor || "-"}</DetailItem>
          <DetailItem label="Jacket">
            {JACKET_OPTIONS.find((option) => option.value === draft.jacket)?.label ?? (draft.jacket || "Single colour")}
          </DetailItem>
          {isWedding ? (
            <>
              <DetailItem label={`First ${isWeddingInitials ? "initial" : "name"}`}>{draft.weddingLineOne || "-"}</DetailItem>
              <DetailItem label={`Second ${isWeddingInitials ? "initial" : "name"}`}>{draft.weddingLineTwo || "-"}</DetailItem>
              <DetailItem label="Design text">{effectiveDesignText || "-"}</DetailItem>
            </>
          ) : (
            <DetailItem label="Design text" className="xl:col-span-3">{draft.designText || "-"}</DetailItem>
          )}
          <DetailItem label="Custom labels">{draft.labelsEnabled ? `Yes - ${draft.labelsCount || "0"}` : "No"}</DetailItem>
          <DetailItem label="Ingredient labels">
            {draft.ingredientLabelsEnabled ? `Yes - ${draft.ingredientLabelsCount || "0"}` : "No"}
          </DetailItem>
          <AssetPreview label="Logo" url={draft.logoUrl} />
          <AssetPreview label="Artwork" url={draft.labelImageUrl} />
        </Section>

        <Section title="Pricing">
          <DetailItem label="Saved total">{formatMoney(order.total_price)}</DetailItem>
          <DetailItem label="Discount">{draft.discountType === "none" ? "No" : draft.discountType}</DetailItem>
          <DetailItem label="Discount value">{draft.discountValue || "-"}</DetailItem>
          <DetailItem label="Price override">{draft.priceOverride || "-"}</DetailItem>
        </Section>

        <Section title="Notes">
          <DetailItem label="Production notes" className="xl:col-span-3">
            <span className="whitespace-pre-wrap font-medium text-zinc-800">{draft.notes || "-"}</span>
          </DetailItem>
          <DetailItem label="Customer note" className="xl:col-span-3">
            <span className="whitespace-pre-wrap font-medium text-zinc-800">{draft.customerNote || "-"}</span>
          </DetailItem>
        </Section>
      </div>
    );
  }

  return (
    <form
      action={upsertOrder}
      className="space-y-4"
      onSubmit={(event) => {
        if (saveDisabled) {
          event.preventDefault();
          return;
        }
        if (sendUpdatedInvoiceInputRef.current) {
          sendUpdatedInvoiceInputRef.current.value = "";
        }
        if (replacementInvoiceAllowed && priceAffectingChanged && invoiceChangeLines.length > 0) {
          const confirmed = window.confirm(
            [
              "Customer will get a new invoice with these changes:",
              "",
              ...invoiceChangeLines,
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
        setIsSubmitting(true);
      }}
    >
      <input type="hidden" name="id" value={order.id} />
      <input type="hidden" name="redirect_to" value={`/admin/orders/${order.id}`} />
      <input type="hidden" name="toast_success" value="Order updated." />
      <input type="hidden" name="toast_error" value="Failed to update order." />
      <input ref={sendUpdatedInvoiceInputRef} type="hidden" name="send_updated_invoice" defaultValue="" />
      <input type="hidden" name="customer_name" value={customerName || order.customer_name || ""} />
      <input type="hidden" name="pickup" value={draft.pickup ? "on" : "off"} />
      <input type="hidden" name="labels_opt_in" value={draft.labelsEnabled ? "on" : "off"} />
      <input type="hidden" name="ingredient_labels_opt_in" value={draft.ingredientLabelsEnabled ? "on" : "off"} />
      <input type="hidden" name="total_price" value={effectiveTotalPrice} />
      {isWedding ? (
        <>
          <input type="hidden" name="title" value={effectiveTitle} />
          <input type="hidden" name="design_text" value={effectiveDesignText} />
        </>
      ) : null}
      {draft.batchWeights.map((weight, index) => (
        <input key={`batch-weight-hidden-${index}`} type="hidden" name="batch_weight_kg" value={weight} />
      ))}

      {isSubmitting ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/90 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 text-center shadow-xl">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-900" />
            <p className="mt-4 text-lg font-semibold text-zinc-900">Saving order</p>
            <p className="mt-2 text-sm text-zinc-600">Updating saved order details.</p>
          </div>
        </div>
      ) : null}

      <div className="sticky top-20 z-20 rounded-lg border border-zinc-900 bg-zinc-950 px-4 py-3 text-white shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-400">Saved total</p>
              <p className="font-semibold">{formatMoney(order.total_price)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-400">Draft total</p>
              <p className="font-semibold">
                {priceAffectingChanged
                  ? isQuoteLoading
                    ? "Calculating"
                    : quote
                      ? formatMoney(quote.total)
                      : "-"
                  : formatMoney(order.total_price)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-400">Packaging</p>
              <p className="font-semibold">{packagingDescription || "-"}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {dirtyCount > 0 ? (
              <span className="rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                {dirtyCount} unsaved
              </span>
            ) : (
              <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-semibold text-zinc-300">
                No changes
              </span>
            )}
            <button
              type="button"
              onClick={() => setDraft(original)}
              disabled={dirtyCount === 0 || isSubmitting}
              className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <RotateCcw size={14} aria-hidden="true" />
              Reset
            </button>
            <button
              type="submit"
              disabled={saveDisabled}
              className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-white bg-white px-3 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Save size={14} aria-hidden="true" />
              Save
            </button>
          </div>
        </div>
        {quoteError ? <p className="mt-2 text-xs font-semibold text-amber-200">{quoteError}</p> : null}
      </div>

      <Section title="Order">
        {isWedding ? (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Title</p>
            <p className="mt-1 text-sm font-semibold text-zinc-900">{effectiveTitle || "-"}</p>
          </div>
        ) : (
          <Field label="Title" changed={changed.title}>
            <input
              name="title"
              value={draft.title}
              onChange={(event) => setField("title", event.target.value)}
              className={inputClass(changed.title)}
            />
          </Field>
        )}
        <Field label="Status" changed={changed.status}>
          <select
            name="status"
            value={draft.status}
            onChange={(event) => setField("status", event.target.value)}
            className={inputClass(changed.status)}
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
            {!STATUS_OPTIONS.includes(draft.status) ? <option value={draft.status}>{draft.status}</option> : null}
          </select>
        </Field>
        <Field label="Date required" changed={changed.dueDate}>
          <input
            type="date"
            name="due_date"
            value={draft.dueDate}
            onChange={(event) => setField("dueDate", event.target.value)}
            className={inputClass(changed.dueDate)}
          />
        </Field>
        <Field label="Order type" changed={changed.categoryId}>
          <select
            name="category_id"
            value={draft.categoryId}
            onChange={(event) => {
              const categoryId = event.target.value;
              setDraft((current) => {
                const allowed = categoryId
                  ? packagingOptions.filter((option) => option.allowed_categories?.includes(categoryId))
                  : packagingOptions;
                const currentAllowed = allowed.some((option) => option.id === current.packagingOptionId);
                return {
                  ...current,
                  categoryId,
                  packagingOptionId: currentAllowed ? current.packagingOptionId : allowed[0]?.id ?? "",
                };
              });
            }}
            className={inputClass(changed.categoryId)}
          >
            <option value="">Select type</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
            {draft.categoryId && !categories.some((category) => category.id === draft.categoryId) ? (
              <option value={draft.categoryId}>{draft.categoryId}</option>
            ) : null}
          </select>
        </Field>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Payment method</p>
          <p className="mt-1 text-sm font-semibold text-zinc-900">{draft.paymentMethod || order.payment_provider || "-"}</p>
          <input type="hidden" name="payment_method" value={draft.paymentMethod} />
        </div>
        <Field label="Pickup / delivery" changed={changed.pickup}>
          <select
            value={draft.pickup ? "pickup" : "delivery"}
            onChange={(event) => setField("pickup", event.target.value === "pickup")}
            className={inputClass(changed.pickup)}
          >
            <option value="delivery">Delivery</option>
            <option value="pickup">Pickup</option>
          </select>
        </Field>
        <Field label="Description" changed={changed.orderDescription} className="xl:col-span-3">
          <textarea
            name="order_description"
            value={draft.orderDescription}
            onChange={(event) => setField("orderDescription", event.target.value)}
            className={textareaClass(changed.orderDescription)}
          />
        </Field>
      </Section>

      <Section title="Customer">
        <Field label="First name" changed={changed.firstName}>
          <input
            name="first_name"
            value={draft.firstName}
            onChange={(event) => setField("firstName", event.target.value)}
            className={inputClass(changed.firstName)}
          />
        </Field>
        <Field label="Last name" changed={changed.lastName}>
          <input
            name="last_name"
            value={draft.lastName}
            onChange={(event) => setField("lastName", event.target.value)}
            className={inputClass(changed.lastName)}
          />
        </Field>
        <Field label="Email" changed={changed.customerEmail}>
          <input
            type="email"
            name="customer_email"
            value={draft.customerEmail}
            onChange={(event) => setField("customerEmail", event.target.value)}
            className={inputClass(changed.customerEmail)}
          />
        </Field>
        <Field label="Phone" changed={changed.phone}>
          <input
            name="phone"
            value={draft.phone}
            onChange={(event) => setField("phone", event.target.value)}
            className={inputClass(changed.phone)}
          />
        </Field>
        <Field label="Organisation" changed={changed.organizationName}>
          <input
            name="organization_name"
            value={draft.organizationName}
            onChange={(event) => setField("organizationName", event.target.value)}
            className={inputClass(changed.organizationName)}
          />
        </Field>
        <Field label="State" changed={changed.state}>
          <select
            name="state"
            value={draft.state}
            onChange={(event) => setField("state", event.target.value)}
            className={inputClass(changed.state)}
          >
            {STATES.map((state) => (
              <option key={state || "blank"} value={state}>
                {state || "Select state"}
              </option>
            ))}
            {draft.state && !STATES.includes(draft.state) ? <option value={draft.state}>{draft.state}</option> : null}
          </select>
        </Field>
        <Field label="Address line 1" changed={changed.addressLine1}>
          <input
            name="address_line1"
            value={draft.addressLine1}
            onChange={(event) => setField("addressLine1", event.target.value)}
            className={inputClass(changed.addressLine1)}
          />
        </Field>
        <Field label="Address line 2" changed={changed.addressLine2}>
          <input
            name="address_line2"
            value={draft.addressLine2}
            onChange={(event) => setField("addressLine2", event.target.value)}
            className={inputClass(changed.addressLine2)}
          />
        </Field>
        <Field label="Suburb" changed={changed.suburb}>
          <input
            name="suburb"
            value={draft.suburb}
            onChange={(event) => setField("suburb", event.target.value)}
            className={inputClass(changed.suburb)}
          />
        </Field>
        <Field label="Postcode" changed={changed.postcode}>
          <input
            name="postcode"
            value={draft.postcode}
            onChange={(event) => setField("postcode", event.target.value)}
            className={inputClass(changed.postcode)}
          />
        </Field>
      </Section>

      <Section title="Packaging And Production">
        <Field label="Packaging" changed={changed.packagingOptionId} className="xl:col-span-2">
          <select
            name="packaging_option_id"
            value={draft.packagingOptionId}
            onChange={(event) => setPackagingOption(event.target.value)}
            className={inputClass(changed.packagingOptionId)}
          >
            <option value="">Select packaging</option>
            {packagingOptionsForCategory.map((option) => (
              <option key={option.id} value={option.id}>
                {optionLabel(option)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Quantity" changed={changed.quantity}>
          <input
            type="number"
            name="quantity"
            min={1}
            value={draft.quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className={inputClass(changed.quantity)}
          />
        </Field>
        <Field label="Weight kg" changed={changed.totalWeightKg}>
          <input
            type="number"
            name="total_weight_kg"
            min={0.01}
            step="0.01"
            value={draft.totalWeightKg}
            onChange={(event) => setField("totalWeightKg", event.target.value)}
            className={inputClass(changed.totalWeightKg)}
          />
        </Field>
        <Field label="Jar lid colour" changed={changed.jarLidColor}>
          <input
            name="jar_lid_color"
            value={draft.jarLidColor}
            onChange={(event) => setField("jarLidColor", event.target.value)}
            className={inputClass(changed.jarLidColor)}
          />
        </Field>
        <div className="xl:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                Batch weights
                {changed.batchWeights ? (
                  <span className="ml-2 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] normal-case tracking-normal text-amber-800">
                    Unsaved
                  </span>
                ) : null}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {formatInputNumber(batchTotalKg)}kg allocated of {draft.totalWeightKg || "0"}kg
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={applyEqualBatchSplit}
                className="inline-flex min-h-9 items-center rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
              >
                Equal split
              </button>
              <button
                type="button"
                onClick={addBatchWeight}
                disabled={draft.batchWeights.length >= MAX_ADMIN_BATCH_COUNT}
                className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={14} aria-hidden="true" />
                Add
              </button>
            </div>
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-3 xl:grid-cols-4">
            {draft.batchWeights.map((weight, index) => (
              <div key={`batch-${index}`} className="flex items-center gap-2">
                <input
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={weight}
                  onChange={(event) => updateBatchWeight(index, event.target.value)}
                  className={inputClass(changed.batchWeights)}
                  aria-label={`Batch ${index + 1} weight`}
                />
                <button
                  type="button"
                  onClick={() => removeBatchWeight(index)}
                  disabled={draft.batchWeights.length <= 1}
                  className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 hover:border-rose-300 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={`Remove batch ${index + 1}`}
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
          {!batchAllocationValid ? (
            <p className="mt-2 text-xs font-semibold text-amber-700">
              Batch weights need to equal the order weight before price-affecting changes can be saved.
            </p>
          ) : null}
        </div>
      </Section>

      <Section title="Design And Labels">
        <Field label="Design type" changed={changed.designType}>
          <input
            name="design_type"
            value={draft.designType}
            onChange={(event) => setField("designType", event.target.value)}
            className={inputClass(changed.designType)}
          />
        </Field>
        <Field label="Flavour" changed={changed.flavor}>
          <input
            name="flavor"
            list="order-flavors"
            value={draft.flavor}
            onChange={(event) => setField("flavor", event.target.value)}
            className={inputClass(changed.flavor)}
          />
          <datalist id="order-flavors">
            {flavors.map((flavor) => (
              <option key={flavor.id} value={flavor.name} />
            ))}
          </datalist>
        </Field>
        <Field label="Jacket" changed={changed.jacket}>
          <select
            name="jacket"
            value={draft.jacket}
            onChange={(event) => setField("jacket", event.target.value)}
            className={inputClass(changed.jacket)}
          >
            {JACKET_OPTIONS.map((option) => (
              <option key={option.value || "single"} value={option.value}>
                {option.label}
              </option>
            ))}
            {draft.jacket && !JACKET_OPTIONS.some((option) => option.value === draft.jacket) ? (
              <option value={draft.jacket}>{draft.jacket}</option>
            ) : null}
          </select>
        </Field>
        {isWedding ? (
          <>
            <Field label={`First ${isWeddingInitials ? "initial" : "name"}`} changed={changed.weddingLineOne}>
              <input
                value={draft.weddingLineOne}
                maxLength={isWeddingInitials ? 3 : 30}
                onChange={(event) => setField("weddingLineOne", event.target.value)}
                className={inputClass(changed.weddingLineOne)}
              />
            </Field>
            <Field label={`Second ${isWeddingInitials ? "initial" : "name"}`} changed={changed.weddingLineTwo}>
              <input
                value={draft.weddingLineTwo}
                maxLength={isWeddingInitials ? 3 : 30}
                onChange={(event) => setField("weddingLineTwo", event.target.value)}
                className={inputClass(changed.weddingLineTwo)}
              />
            </Field>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Design text</p>
              <p className="mt-1 text-sm font-semibold text-zinc-900">{effectiveDesignText || "-"}</p>
            </div>
          </>
        ) : (
          <Field label="Design text" changed={changed.designText} className="xl:col-span-3">
            <textarea
              name="design_text"
              value={draft.designText}
              onChange={(event) => setField("designText", event.target.value)}
              className={textareaClass(changed.designText)}
            />
          </Field>
        )}
        <Field label="Custom labels" changed={changed.labelsEnabled || changed.labelsCount}>
          <div className="mt-1 grid grid-cols-[7rem_minmax(0,1fr)] gap-2">
            <select
              value={draft.labelsEnabled ? "yes" : "no"}
              onChange={(event) => setField("labelsEnabled", event.target.value === "yes")}
              className={inputClass(changed.labelsEnabled)}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
            <input
              type="number"
              name="labels_count"
              min={0}
              max={labelMax}
              value={draft.labelsCount}
              disabled={!draft.labelsEnabled}
              onChange={(event) => setField("labelsCount", event.target.value)}
              className={inputClass(changed.labelsCount)}
            />
          </div>
        </Field>
        <Field label="Ingredient labels" changed={changed.ingredientLabelsEnabled || changed.ingredientLabelsCount}>
          <div className="mt-1 grid grid-cols-[7rem_minmax(0,1fr)] gap-2">
            <select
              value={draft.ingredientLabelsEnabled ? "yes" : "no"}
              onChange={(event) => setField("ingredientLabelsEnabled", event.target.value === "yes")}
              className={inputClass(changed.ingredientLabelsEnabled)}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
            <input
              type="number"
              name="ingredient_labels_count"
              min={0}
              max={labelMax}
              value={draft.ingredientLabelsCount}
              disabled={!draft.ingredientLabelsEnabled}
              onChange={(event) => setField("ingredientLabelsCount", event.target.value)}
              className={inputClass(changed.ingredientLabelsCount)}
            />
          </div>
        </Field>
        <Field label="Logo" changed={changed.logoUrl} className="xl:col-span-3">
          <div className="mt-1 flex min-w-0 items-center gap-3">
            {draft.logoUrl && isImageLikeUrl(draft.logoUrl) ? (
              <Image
                src={draft.logoUrl}
                alt="Logo preview"
                width={56}
                height={56}
                unoptimized
                className="h-14 w-14 shrink-0 rounded border border-zinc-200 bg-zinc-50 object-contain"
              />
            ) : null}
            <input
              name="logo_url"
              value={draft.logoUrl}
              onChange={(event) => setField("logoUrl", event.target.value)}
              className={inputClass(changed.logoUrl)}
            />
          </div>
        </Field>
        <Field label="Artwork" changed={changed.labelImageUrl} className="xl:col-span-3">
          <div className="mt-1 flex min-w-0 items-center gap-3">
            {draft.labelImageUrl && isImageLikeUrl(draft.labelImageUrl) ? (
              <Image
                src={draft.labelImageUrl}
                alt="Artwork preview"
                width={56}
                height={56}
                unoptimized
                className="h-14 w-14 shrink-0 rounded border border-zinc-200 bg-zinc-50 object-contain"
              />
            ) : null}
            <input
              name="label_image_url"
              value={draft.labelImageUrl}
              onChange={(event) => setField("labelImageUrl", event.target.value)}
              className={inputClass(changed.labelImageUrl)}
            />
          </div>
        </Field>
      </Section>

      <Section title="Pricing">
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Saved total</p>
          <p className="mt-2 text-sm font-semibold text-zinc-900">{formatMoney(order.total_price)}</p>
        </div>
        <Field label="Discount type" changed={changed.discountType}>
          <select
            name="admin_discount_type"
            value={draft.discountType}
            onChange={(event) => setField("discountType", event.target.value as AdminDiscountType)}
            className={inputClass(changed.discountType)}
          >
            <option value="none">None</option>
            <option value="percent">Percent</option>
            <option value="fixed">Fixed</option>
          </select>
        </Field>
        <Field label="Discount value" changed={changed.discountValue}>
          <input
            type="number"
            name="admin_discount_value"
            min={0}
            step="0.01"
            value={draft.discountValue}
            disabled={draft.discountType === "none"}
            onChange={(event) => setField("discountValue", event.target.value)}
            className={inputClass(changed.discountValue)}
          />
        </Field>
        <Field label="Price override" changed={changed.priceOverride}>
          <input
            type="number"
            name="admin_price_override"
            min={0}
            step="0.01"
            value={draft.priceOverride}
            onChange={(event) => setField("priceOverride", event.target.value)}
            className={inputClass(changed.priceOverride)}
          />
        </Field>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm xl:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Calculated draft</p>
          <p className="mt-1 text-lg font-semibold text-zinc-900">
            {priceAffectingChanged
              ? isQuoteLoading
                ? "Calculating"
                : quote
                  ? formatMoney(quote.total)
                  : "-"
              : formatMoney(order.total_price)}
          </p>
          {quote?.items?.length ? (
            <div className="mt-3 grid gap-1 text-xs text-zinc-600 sm:grid-cols-2">
              {quote.items.map((item) => (
                <div key={item.label} className="flex justify-between gap-3">
                  <span>{item.label}</span>
                  <span className="font-semibold text-zinc-900">{formatMoney(item.amount)}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </Section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-900">Notes</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Production notes" changed={changed.notes}>
            <textarea
              name="notes"
              value={draft.notes}
              onChange={(event) => setField("notes", event.target.value)}
              className={textareaClass(changed.notes)}
            />
          </Field>
          <Field label="Customer note" changed={changed.customerNote}>
            <textarea
              name="customer_note"
              value={draft.customerNote}
              onChange={(event) => setField("customerNote", event.target.value)}
              className={textareaClass(changed.customerNote)}
            />
          </Field>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link
          href={cancelHref}
          className="inline-flex min-h-10 items-center rounded-lg border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-300"
        >
          Back
        </Link>
        <button
          type="submit"
          disabled={saveDisabled}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-zinc-900 bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Save size={16} aria-hidden="true" />
          Save order
        </button>
      </div>
    </form>
  );
}
