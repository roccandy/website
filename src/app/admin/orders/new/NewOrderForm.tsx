"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { ImageOptimizationStatus } from "@/components/ImageOptimizationStatus";
import {
  analyzeImageOptimization,
  fileToDataUrl,
  optimizeBrowserImageToDataUrl,
  type ImageOptimizationSummary,
} from "@/lib/clientImageOptimization";
import type { Category, ColorPaletteRow, Flavor, PackagingOption, PremadeCandy, SettingsRow } from "@/lib/data";
import { upsertOrder } from "../actions";
import { paletteSections } from "@/app/admin/settings/palette";

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
  const priceLabel = Number.isFinite(item.price) ? `$${Number(item.price).toFixed(2)}` : "";
  const parts = [item.name, weightLabel, priceLabel].filter(Boolean);
  return parts.join(" - ");
}

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
    <details ref={detailsRef} className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
      <summary className="flex cursor-pointer list-none items-center gap-3 text-xs font-semibold text-zinc-700">
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
                    className={`palette-swatch h-8 w-full rounded-full border ${
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
            className="mt flex h-9 w-full items-center justify-center rounded-full px-3 text-[11px] font-semibold hover:text-zinc-800"
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
};

export function NewOrderForm({ categories, packagingOptions, flavors, palette, premadeCandies, settings }: Props) {
  const defaultJacketColor = useMemo(() => getPaletteHex(palette, "grey", "light", "#d1d5db"), [palette]);
  const defaultTextColor = useMemo(() => getPaletteHex(palette, "grey", "light", "#b7b7b7"), [palette]);
  const paletteGroups = useMemo(() => buildPaletteGroups(palette), [palette]);
  const [deliveryMode, setDeliveryMode] = useState<"delivery" | "pickup">("delivery");
  const [categoryId, setCategoryId] = useState("");
  const [packagingOptionId, setPackagingOptionId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [labelsCount, setLabelsCount] = useState("");
  const [labelsCountTouched, setLabelsCountTouched] = useState(false);
  const [jacket, setJacket] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priceValue, setPriceValue] = useState("");
  const [weightValue, setWeightValue] = useState("");
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [isPricing, setIsPricing] = useState(false);
  const [premadeSelections, setPremadeSelections] = useState<Array<{ id: string; quantity: string }>>([]);
  const [weddingLineOne, setWeddingLineOne] = useState("");
  const [weddingLineTwo, setWeddingLineTwo] = useState("");
  const [customText, setCustomText] = useState("");
  const [brandName, setBrandName] = useState("");
  const [designText, setDesignText] = useState("");
  const [jacketColorOne, setJacketColorOne] = useState(defaultJacketColor);
  const [jacketColorTwo, setJacketColorTwo] = useState(defaultJacketColor);
  const [textColor, setTextColor] = useState(defaultTextColor);
  const [heartColor, setHeartColor] = useState(defaultTextColor);
  const [flavor, setFlavor] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoSummary, setLogoSummary] = useState<ImageOptimizationSummary | null>(null);
  const [isOptimisingLogo, setIsOptimisingLogo] = useState(false);
  const [ingredientLabelsOptIn, setIngredientLabelsOptIn] = useState(false);
  const [labelFileName, setLabelFileName] = useState("");
  const [labelImageUrl, setLabelImageUrl] = useState("");
  const [labelImageError, setLabelImageError] = useState<string | null>(null);
  const [labelImageSummary, setLabelImageSummary] = useState<ImageOptimizationSummary | null>(null);
  const [isOptimisingLabelImage, setIsOptimisingLabelImage] = useState(false);
  const [customPickerOpen, setCustomPickerOpen] = useState(false);
  const [customTarget, setCustomTarget] = useState<"heart" | "text" | "jacket1" | "jacket2" | null>(null);
  const [customHex, setCustomHex] = useState(defaultJacketColor);
  const [customHexInput, setCustomHexInput] = useState(defaultJacketColor);
  const [customCmyk, setCustomCmyk] = useState<Cmyk>(
    () => hexToCmyk(defaultJacketColor) ?? { c: 0, m: 0, y: 0, k: 0 },
  );
  const [customRgba, setCustomRgba] = useState<Rgba>(
    () => hexToRgba(defaultJacketColor) ?? { r: 0, g: 0, b: 0, a: 1 },
  );
  const [customInputMode, setCustomInputMode] = useState<"hex" | "cmyk" | "rgba">("hex");
  const showAddress = deliveryMode === "delivery";
  const filteredPackagingOptions = useMemo(() => {
    if (!categoryId) return packagingOptions;
    return packagingOptions.filter((option) => option.allowed_categories?.includes(categoryId));
  }, [categoryId, packagingOptions]);
  const selectedPackagingOption = useMemo(() => {
    return packagingOptions.find((option) => option.id === packagingOptionId) || null;
  }, [packagingOptions, packagingOptionId]);
  const packageTypeLabel = useMemo(() => {
    const raw = selectedPackagingOption?.type?.trim().toLowerCase();
    return raw || "package";
  }, [selectedPackagingOption?.type]);
  const premadeOptions = useMemo(
    () => premadeCandies.filter((item) => item.is_active),
    [premadeCandies]
  );
  const ingredientLabelPrice = Number(settings.ingredient_label_price ?? 0);
  const premadeSubtotal = useMemo(
    () =>
      premadeSelections.reduce((sum, selection) => {
        const premade = premadeOptions.find((item) => item.id === selection.id);
        const quantityValue = Number(selection.quantity);
        if (!premade || !Number.isFinite(quantityValue) || quantityValue <= 0) return sum;
        const unitPrice = Number(premade.price);
        return Number.isFinite(unitPrice) ? sum + unitPrice * quantityValue : sum;
      }, 0),
    [premadeOptions, premadeSelections],
  );
  const customPriceNumber = Number(priceValue);
  const combinedPriceNumber =
    (Number.isFinite(customPriceNumber) ? customPriceNumber : 0) + premadeSubtotal;
  const formatMoney = (value: number | null | undefined) =>
    Number.isFinite(value ?? NaN) ? `$${Number(value).toFixed(2)}` : "$0.00";
  const addPremadeSelection = () => {
    setPremadeSelections((prev) => [...prev, { id: "", quantity: "1" }]);
  };
  const updatePremadeSelection = (index: number, patch: Partial<{ id: string; quantity: string }>) => {
    setPremadeSelections((prev) =>
      prev.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item))
    );
  };
  const removePremadeSelection = (index: number) => {
    setPremadeSelections((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };
  const isWedding = categoryId.startsWith("weddings");
  const isWeddingInitials = categoryId === "weddings-initials";
  const isCustomText = categoryId.startsWith("custom-");
  const isBranded = categoryId === "branded";
  const isDesignDisabled = !categoryId;
  const showJacketColorTwo = jacket === "two_colour" || jacket === "two_colour_pinstripe";
  const customTextLimit = categoryId === "custom-7-14" ? 14 : 6;
  const designTextValue = useMemo(() => {
    if (isWedding) {
      const left = isWeddingInitials
        ? (weddingLineOne || "").trim().toUpperCase()
        : (weddingLineOne || "").trim();
      const right = isWeddingInitials
        ? (weddingLineTwo || "").trim().toUpperCase()
        : (weddingLineTwo || "").trim();
      if (!left && !right) return "";
      return `${left} \u2665 ${right}`.trim();
    }
    if (isCustomText) return (customText || "").trim();
    if (isBranded) return (brandName || "").trim();
    return (designText || "").trim();
  }, [brandName, customText, designText, isBranded, isCustomText, isWedding, isWeddingInitials, weddingLineOne, weddingLineTwo]);
  const jacketTypeValue = useMemo(() => {
    if (jacket === "rainbow") return "rainbow";
    if (jacket === "two_colour" || jacket === "two_colour_pinstripe") return "two_colour";
    if (jacket === "pinstripe") return "pinstripe";
    return "";
  }, [jacket]);
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

  useEffect(() => {
    if (!categoryId || !packagingOptionId) return;
    const isValid = filteredPackagingOptions.some((option) => option.id === packagingOptionId);
    if (!isValid) {
      setPackagingOptionId("");
    }
  }, [categoryId, packagingOptionId, filteredPackagingOptions]);

  useEffect(() => {
    if (!packagingOptionId) {
      if (!labelsCountTouched) setLabelsCount("");
      return;
    }
    if (!labelsCountTouched) {
      setLabelsCount(quantity ? quantity : "");
    }
  }, [labelsCountTouched, packagingOptionId, quantity]);

  useEffect(() => {
    const qtyNumber = Number(quantity);
    if (!categoryId || !packagingOptionId || !Number.isFinite(qtyNumber) || qtyNumber <= 0) {
      setPriceValue("");
      setWeightValue("");
      setPricingError(null);
      return;
    }

    const labelsNumber = Number(labelsCount);
    const resolvedLabels = Number.isFinite(labelsNumber) && labelsNumber > 0 ? labelsNumber : 0;
    const extras: { jacket: "rainbow" | "two_colour" | "pinstripe" }[] = [];
    if (jacket === "rainbow") extras.push({ jacket: "rainbow" });
    if (jacket === "two_colour") extras.push({ jacket: "two_colour" });
    if (jacket === "pinstripe") extras.push({ jacket: "pinstripe" });
    if (jacket === "two_colour_pinstripe") {
      extras.push({ jacket: "two_colour" }, { jacket: "pinstripe" });
    }

    let active = true;
    setIsPricing(true);
    setPricingError(null);

    fetch("/api/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryId,
        packaging: [{ optionId: packagingOptionId, quantity: qtyNumber }],
        labelsCount: resolvedLabels,
        ingredientLabelsCount: ingredientLabelsOptIn ? qtyNumber : 0,
        dueDate: dueDate || undefined,
        extras: extras.length ? extras : undefined,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error || "Unable to calculate price");
        }
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        const total = Number(data.total);
        const totalWeightKg = Number(data.totalWeightKg);
        setPriceValue(Number.isFinite(total) ? total.toFixed(2) : "");
        setWeightValue(Number.isFinite(totalWeightKg) ? (totalWeightKg * 1000).toFixed(0) : "");
      })
      .catch((error: Error) => {
        if (!active) return;
        setPriceValue("");
        setWeightValue("");
        setPricingError(error.message);
      })
      .finally(() => {
        if (!active) return;
        setIsPricing(false);
      });

    return () => {
      active = false;
    };
  }, [categoryId, packagingOptionId, quantity, labelsCount, ingredientLabelsOptIn, jacket, dueDate]);

  return (
    <form action={upsertOrder} className="space-y-6">
      <div className="sticky top-20 z-20">
        <div className="rounded-2xl border border-zinc-900 bg-zinc-900/95 p-4 text-white shadow-lg backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-300">Order total</p>
              <p className="mt-1 text-3xl font-semibold">{formatMoney(combinedPriceNumber)}</p>
            </div>
            <div className="grid flex-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-300">Custom candy</p>
                <p className="mt-1 text-sm font-semibold">{formatMoney(Number.isFinite(customPriceNumber) ? customPriceNumber : 0)}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-300">Pre-made add-ons</p>
                <p className="mt-1 text-sm font-semibold">{formatMoney(premadeSubtotal)}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-300">Status</p>
                <p className="mt-1 text-sm text-zinc-100">{isPricing ? "Calculating price..." : pricingError || "Price updates automatically."}</p>
              </div>
            </div>
          </div>
          <input type="hidden" name="total_price" value={priceValue} />
          <input type="hidden" name="ingredient_labels_opt_in" value={ingredientLabelsOptIn ? "on" : "off"} />
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-zinc-900">Order details</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Title
            <input
              name="title"
              required
              className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
              placeholder="Order title"
            />
          </label>
          <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Order type
            <select
              name="category_id"
              required
              className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="" disabled>
                Select order type
              </option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Packaging option
            <select
              name="packaging_option_id"
              required
              disabled={!categoryId}
              className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 disabled:bg-zinc-50 disabled:text-zinc-400"
              value={packagingOptionId}
              onChange={(event) => setPackagingOptionId(event.target.value)}
            >
              <option value="" disabled>
                {categoryId ? "Select packaging option" : "Select order type first"}
              </option>
              {filteredPackagingOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.type} - {option.size}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Quantity
            <input
              type="number"
              name="quantity"
              min={1}
              required
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
            />
            {selectedPackagingOption?.max_packages ? (
              <div className="mt-2 text-[11px] text-zinc-500">
                Max {selectedPackagingOption.max_packages}
              </div>
            ) : null}
          </label>
          <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Labels count
            <input
              type="number"
              name="labels_count"
              min={0}
              value={labelsCount}
              onChange={(event) => {
                setLabelsCountTouched(true);
                setLabelsCount(event.target.value);
              }}
              className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
            />
            <div className="mt-2 text-[11px] text-zinc-500">Defaults to the quantity, but can be edited manually.</div>
          </label>
          <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Date required
            <input
              type="date"
              name="due_date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
            />
          </label>
          <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Total weight (g)
            <input
              type="number"
              name="order_weight_g"
              min={1}
              required
              readOnly
              value={weightValue}
              className="mt-2 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900"
            />
          </label>
          <input type="hidden" name="status" value="unassigned" />
        </div>
      </div>

      <div
        className={`rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm ${
          isDesignDisabled ? "pointer-events-none opacity-50" : ""
        }`}
      >
        <h3 className="text-base font-semibold text-zinc-900">Candy design & flavor</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
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
            </label>
          )}
          {isBranded && (
            <label className="text-xs uppercase tracking-[0.2em] text-zinc-500 md:col-span-2">
              Brand name
              <input
                value={brandName}
                onChange={(event) => setBrandName(event.target.value)}
                className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
                placeholder="Brand name"
              />
            </label>
          )}
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
          <label className="text-xs uppercase tracking-[0.2em] text-zinc-500 md:col-span-2">
            Jacket type
            <select
              name="jacket"
              className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
              value={jacket}
              onChange={(event) => setJacket(event.target.value)}
            >
              {JACKET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
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
              className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
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
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 md:col-span-2">
            <div className="space-y-4">
              <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
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
                    className="inline-flex cursor-pointer items-center rounded border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-300"
                  >
                    {labelFileName ? "Change file" : "Choose file"}
                  </label>
                  {labelImageUrl ? (
                    labelImageUrl.startsWith("data:image/") ? (
                      <Image
                        src={labelImageUrl}
                        alt="Label preview"
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded border border-zinc-200 object-cover"
                        unoptimized
                      />
                    ) : labelImageUrl.startsWith("data:application/pdf") ? (
                      <span className="inline-flex h-10 min-w-10 items-center justify-center rounded border border-zinc-200 bg-white px-2 text-[10px] font-semibold text-zinc-600">
                        PDF
                      </span>
                    ) : null
                  ) : null}
                  {labelFileName ? (
                    <span className="text-xs normal-case tracking-normal text-zinc-500" title={labelFileName}>
                      {labelFileName}
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
                  <div className="mt-2">
                    <ImageOptimizationStatus
                      summary={null}
                      pendingLabel="Optimising artwork..."
                      helperText="Image uploads are compressed before they are added to the order. PDFs stay as PDF."
                    />
                  </div>
                ) : labelImageSummary ? (
                  <div className="mt-2">
                    <ImageOptimizationStatus
                      summary={labelImageSummary}
                      helperText="Image uploads are compressed before they are added to the order. PDFs stay as PDF."
                    />
                  </div>
                ) : null}
              </div>
              <label className="flex items-start gap-3 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={ingredientLabelsOptIn}
                  onChange={(event) => setIngredientLabelsOptIn(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                />
                <span className="space-y-0.5">
                  <span className="block text-sm font-semibold text-zinc-900">Ingredient labels</span>
                  <span className="block text-xs text-zinc-500">
                    {`Add ingredient labels to each ${packageTypeLabel}. ${formatMoney(ingredientLabelPrice)} each.`}
                  </span>
                </span>
              </label>
            </div>
          </div>
          <input type="hidden" name="design_type" value={categoryId} />
          <input type="hidden" name="design_text" value={designTextValue} />
          <input type="hidden" name="jacket_type" value={jacketTypeValue} />
          <input type="hidden" name="jacket_color_one" value={jacketColorOne} />
          <input type="hidden" name="jacket_color_two" value={jacketColorTwo} />
          {!isBranded && <input type="hidden" name="text_color" value={textColor} />}
          {isWedding && <input type="hidden" name="heart_color" value={heartColor} />}
          {isBranded && logoUrl && <input type="hidden" name="logo_url" value={logoUrl} />}
          {labelImageUrl && <input type="hidden" name="label_image_url" value={labelImageUrl} />}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-zinc-900">Pre-made add-ons</h3>
          </div>
          <button
            type="button"
            onClick={addPremadeSelection}
            disabled={premadeOptions.length === 0}
            className="rounded border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Add pre-made
          </button>
        </div>
        {premadeOptions.length > 0 && premadeSelections.length > 0 ? (
          <div className="mt-4 space-y-3">
            {premadeSelections.map((selection, index) => (
              <div key={`premade-${index}`} className="grid gap-3 md:grid-cols-[1.6fr,0.6fr,auto] md:items-end">
                <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Pre-made candy
                  <select
                    name="premade_id"
                    value={selection.id}
                    onChange={(event) => updatePremadeSelection(index, { id: event.target.value })}
                    className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
                  >
                    <option value="">Select pre-made candy</option>
                    {premadeOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {formatPremadeLabel(item)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Qty
                  <input
                    type="number"
                    name="premade_quantity"
                    min={1}
                    value={selection.quantity}
                    onChange={(event) => updatePremadeSelection(index, { quantity: event.target.value })}
                    className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => removePremadeSelection(index)}
                  className="rounded border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-600 hover:border-zinc-300"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-zinc-900">Customer details</h3>
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
              className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
            />
          </label>
          <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Last name
            <input
              name="last_name"
              className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
            />
          </label>
          <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Email address
            <input
              type="email"
              name="customer_email"
              className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
            />
          </label>
          <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Phone number
            <input
              name="phone"
              className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
            />
          </label>
          <label className="text-xs uppercase tracking-[0.2em] text-zinc-500 md:col-span-2">
            Organization name
            <input
              name="organization_name"
              className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
            />
          </label>
        </div>
      </div>

      {showAddress && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-900">Delivery address</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-xs uppercase tracking-[0.2em] text-zinc-500 md:col-span-2">
              Address line 1
              <input
                name="address_line1"
                className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
              />
            </label>
            <label className="text-xs uppercase tracking-[0.2em] text-zinc-500 md:col-span-2">
              Address line 2
              <input
                name="address_line2"
                className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
              />
            </label>
            <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              Suburb
              <input
                name="suburb"
                className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
              />
            </label>
            <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              Postcode
              <input
                name="postcode"
                className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
              />
            </label>
            <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              State
              <select
                name="state"
                className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
                defaultValue=""
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
      )}

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-zinc-900">Notes</h3>
        <textarea
          name="notes"
          className="mt-4 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
          rows={4}
          placeholder="Internal notes for production."
        />
      </div>

      {customPickerOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-zinc-900/40 px-4">
          <div
            className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-zinc-900">Set a brand color</h3>
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
          href="/admin/orders"
          className="rounded border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-300"
        >
          Cancel
        </Link>
        <button
          type="submit"
          className="rounded border border-zinc-900 bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          Save order
        </button>
      </div>
    </form>
  );
}
