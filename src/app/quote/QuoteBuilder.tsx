"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Montserrat } from "next/font/google";
import type {
  Category,
  ColorPaletteRow,
  Flavor,
  LabelRange,
  LabelType,
  PackagingOption,
  PackagingOptionImage,
  SettingsRow,
} from "@/lib/data";
import { CandyPreview } from "./CandyPreview";
import { paletteSections } from "@/app/admin/settings/palette";
import { useCart, type CustomCartItem } from "@/components/CartProvider";

type OrderTypeId = "weddings" | "text" | "branded";

type Props = {
  categories: Category[];
  packagingOptions: PackagingOption[];
  packagingImages: PackagingOptionImage[];
  settings: SettingsRow;
  flavors: Flavor[];
  palette: ColorPaletteRow[];
  labelTypes: LabelType[];
  labelRanges: LabelRange[];
  minBasePrices: Record<string, number>;
  initialOrderType?: OrderTypeId;
};

type Selection = { optionId: string; quantity: number };
type QuoteItem = { label: string; amount: number };
type QuoteResult = {
  basePrice: number;
  packagingPrice: number;
  labelsPrice: number;
  ingredientLabelsPrice: number;
  extrasPrice: number;
  urgencyFee: number;
  transactionFee: number;
  total: number;
  totalWeightKg: number;
  items: QuoteItem[];
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

const FEATURE_LABELS = ["Vegan", "Gluten Free", "Dairy Free", "Handmade", "Aust Made", "Free Delivery"];
const montserratLight = Montserrat({
  subsets: ["latin"],
  weight: ["200"],
});

function normalizeOrderType(value?: string | null): OrderTypeId | undefined {
  if (value === "weddings" || value === "text" || value === "branded") {
    return value as OrderTypeId;
  }
  return undefined;
}

function inferOrderTypeFromCategory(value?: string | null): OrderTypeId | undefined {
  if (!value) return undefined;
  if (value === "weddings" || value.startsWith("weddings-")) return "weddings";
  if (value === "text" || value.startsWith("custom-")) return "text";
  if (value === "branded") return "branded";
  return normalizeOrderType(value);
}

function splitWeddingDesign(value?: string | null) {
  const safe = (value || "").trim();
  if (!safe) return { lineOne: "", lineTwo: "" };
  const heartSplit = safe.split(/\s*\u2764\uFE0F?\s*/);
  if (heartSplit.length >= 2) {
    return { lineOne: heartSplit[0].trim(), lineTwo: heartSplit.slice(1).join(" ").trim() };
  }
  const ampSplit = safe.split(/\s*&\s*/);
  if (ampSplit.length >= 2) {
    return { lineOne: ampSplit[0].trim(), lineTwo: ampSplit.slice(1).join(" ").trim() };
  }
  return { lineOne: safe, lineTwo: "" };
}

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

function hexToRgba(hex: string, alpha = 1): Rgba | null {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return null;
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
    a: clampAlpha(alpha),
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

function PalettePicker({
  label,
  value,
  onChange,
  groups,
  onCustom,
  placeholderLabel = "Select colour",
  placeholderSwatch,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  groups: PaletteGroup[];
  onCustom: () => void;
  placeholderLabel?: string;
  placeholderSwatch?: string;
}) {
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const flat = groups.flatMap((group) => group.options);
  const hasValue = Boolean(value);
  const selected = hasValue ? flat.find((option) => option.hex.toLowerCase() === value.toLowerCase()) : undefined;
  const selectedLabel = hasValue ? selected?.label ?? "Custom" : placeholderLabel;
  const swatchValue = hasValue ? value : placeholderSwatch ?? "#e5e7eb";
  const handleSelect = (hex: string) => {
    onChange(hex);
    if (detailsRef.current) {
      detailsRef.current.open = false;
    }
  };
  return (
    <details ref={detailsRef} className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
      <summary className="flex cursor-pointer list-none items-center gap-3 text-xs font-semibold text-zinc-700">
        <span className="normal-case tracking-[0.04em] text-zinc-500">{label}</span>
        <span className="ml-auto flex items-center gap-2 text-[11px] font-medium text-zinc-600">
          <span>{selectedLabel}</span>
          <span
            style={{
              width: 20,
              height: 20,
              backgroundColor: swatchValue,
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
                      } as React.CSSProperties
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

const ORDER_TYPES: { id: OrderTypeId; label: string }[] = [
  { id: "weddings", label: "Weddings" },
  { id: "text", label: "Custom text" },
  { id: "branded", label: "Branded" },
];

const ORDER_SUBTYPES: Record<OrderTypeId, { id: string; label: string }[]> = {
  weddings: [
    { id: "weddings-initials", label: "Initials" },
    { id: "weddings-both-names", label: "Both names" },
  ],
  text: [
    { id: "custom-1-6", label: "1-6 letters" },
    { id: "custom-7-14", label: "7-14 letters" },
  ],
  branded: [{ id: "branded", label: "Branded" }],
};

const ORDER_TYPE_TITLES: Record<OrderTypeId, string> = {
  weddings: "Wedding Candy",
  text: "Custom Text Candy",
  branded: "Branded Candy",
};

const SUBTITLE_BY_CATEGORY: Record<string, string> = {
  "weddings-both-names": "Names & Hearts",
  "weddings-initials": "Initials & Hearts",
  "custom-1-6": "Text: Up to 6 letters",
  "custom-7-14": "Text: 7 - 14 letters",
  branded: "Logo Branded Candy",
};

const PACKAGING_IMAGE_BUCKET = "packaging-images";
const LID_COLOR_SWATCH: Record<string, string> = {
  black: "#1f1f1f",
  silver: "#d7d7d7",
  gold: "#d2b16f",
};
const INGREDIENT_LABEL_PREVIEW_SRC = "/labels/ingredient-label.png";
const LABEL_SHAPE_LABELS: Record<LabelType["shape"], string> = {
  square: "Square",
  rectangular: "Rectangular",
  circle: "Circle",
};

function buildPublicImageUrl(imagePath: string | null | undefined) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base || !imagePath) return "";
  const encoded = encodeURIComponent(imagePath);
  return `${base}/storage/v1/object/public/${PACKAGING_IMAGE_BUCKET}/${encoded}`;
}

function formatLabelTypeLabel(labelType: LabelType) {
  const shape = LABEL_SHAPE_LABELS[labelType.shape] ?? labelType.shape;
  const dimension = (labelType.dimensions || "").trim();
  return dimension ? `${shape} ${dimension}` : shape;
}

function toTitleCase(value: string) {
  return value.replace(/\w\S*/g, (part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase());
}

export function QuoteBuilder({
  categories,
  packagingOptions,
  packagingImages,
  settings,
  flavors,
  palette,
  labelTypes,
  labelRanges,
  minBasePrices,
  initialOrderType,
}: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { items, addCustomItem, updateCustomItem } = useCart();
  const editItemId = searchParams?.get("edit")?.trim() ?? "";
  const editItem = useMemo(
    () =>
      editItemId
        ? (items.find((item): item is CustomCartItem => item.type === "custom" && item.id === editItemId) ?? null)
        : null,
    [items, editItemId]
  );
  const isEditing = Boolean(editItemId && editItem);
  const appliedEditRef = useRef<string | null>(null);
  const paletteGroups = useMemo(() => buildPaletteGroups(palette), [palette]);
  const labelTypeById = useMemo(() => new Map(labelTypes.map((labelType) => [labelType.id, labelType])), [labelTypes]);
  const sortedLabelRanges = useMemo(
    () => [...labelRanges].sort((a, b) => Number(a.upper_bound) - Number(b.upper_bound)),
    [labelRanges]
  );
  const ingredientLabelType = useMemo(() => {
    const id = settings.ingredient_label_type_id;
    return id ? labelTypeById.get(id) ?? null : null;
  }, [settings.ingredient_label_type_id, labelTypeById]);
  const ingredientLabelPrice = Number.isFinite(Number(settings.ingredient_label_price))
    ? Number(settings.ingredient_label_price)
    : 0;
  const defaultJacketColor = useMemo(
    () => getPaletteHex(palette, "grey", "light", "#d1d5db"),
    [palette],
  );
  const defaultTextColor = useMemo(
    () => getPaletteHex(palette, "grey", "light", "#b7b7b7"),
    [palette],
  );
    const resolvedInitialOrderType =
      ORDER_TYPES.find((type) => type.id === initialOrderType)?.id ?? ORDER_TYPES[0]?.id ?? "weddings";
    const queryOrderType = normalizeOrderType(searchParams?.get("type"));
    const querySubtype = searchParams?.get("subtype") ?? undefined;
    const initialOrderTypeResolved = queryOrderType ?? resolvedInitialOrderType;
    const hasExplicitOrderType = Boolean(queryOrderType || initialOrderType);
    const validInitialQuerySubtype =
      querySubtype && ORDER_SUBTYPES[initialOrderTypeResolved]?.some((sub) => sub.id === querySubtype)
        ? querySubtype
        : undefined;
    const initialSubtype = (() => {
      if (validInitialQuerySubtype) return validInitialQuerySubtype;
      if (initialOrderTypeResolved === "branded") {
        return ORDER_SUBTYPES.branded[0]?.id ?? "branded";
      }
      if (hasExplicitOrderType) return "";
      return ORDER_SUBTYPES[initialOrderTypeResolved]?.[0]?.id ?? categories[0]?.id ?? "";
    })();
    const [orderType, setOrderType] = useState<OrderTypeId>(initialOrderTypeResolved);
    const [categoryId, setCategoryId] = useState(initialSubtype);
  const showSubtype = orderType !== "branded";
  const needsSubtypeSelection = showSubtype && !categoryId;

  const [selectionType, setSelectionType] = useState<string>("");
  const [selectionSize, setSelectionSize] = useState<string>("");
  const [selectionQtyInput, setSelectionQtyInput] = useState("1");
  const [jarLidColor, setJarLidColor] = useState("");
  const [packagingImageFailed, setPackagingImageFailed] = useState(false);

  const [labelsOptIn, setLabelsOptIn] = useState(false);
  const [ingredientLabelsOptIn, setIngredientLabelsOptIn] = useState(false);
  const [labelTypeId, setLabelTypeId] = useState("");
  const [labelCountOverride, setLabelCountOverride] = useState(0);
  const [labelImageUrl, setLabelImageUrl] = useState("");
  const [labelImageError, setLabelImageError] = useState<string | null>(null);
  const [labelFileName, setLabelFileName] = useState("");
  const [ingredientPreviewFailed, setIngredientPreviewFailed] = useState(false);
  const [rainbowJacket, setRainbowJacket] = useState(false);
  const [pinstripeJacket, setPinstripeJacket] = useState(false);
  const [twoColourJacket, setTwoColourJacket] = useState(false);
  const [result, setResult] = useState<QuoteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [initialOne, setInitialOne] = useState("");
  const [initialTwo, setInitialTwo] = useState("");
  const [nameOne, setNameOne] = useState("");
  const [nameTwo, setNameTwo] = useState("");
  const [customText, setCustomText] = useState("");
  const [orgName, setOrgName] = useState("");
  const [flavor, setFlavor] = useState("");
  const [jacketColorOne, setJacketColorOne] = useState("");
  const [jacketColorTwo, setJacketColorTwo] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoError, setLogoError] = useState<string | null>(null);
  const [heartColor, setHeartColor] = useState("");
  const [textColor, setTextColor] = useState("");
  const [customPickerOpen, setCustomPickerOpen] = useState(false);
  const [customTarget, setCustomTarget] = useState<"heart" | "text" | "jacket1" | "jacket2" | null>(null);
  const [customHex, setCustomHex] = useState(defaultJacketColor);
  const [customHexInput, setCustomHexInput] = useState(defaultJacketColor);
  const [customCmyk, setCustomCmyk] = useState<Cmyk>(() => hexToCmyk(defaultJacketColor) ?? { c: 0, m: 0, y: 0, k: 0 });
  const [customRgba, setCustomRgba] = useState<Rgba>(() => hexToRgba(defaultJacketColor) ?? { r: 0, g: 0, b: 0, a: 1 });
  const [customInputMode, setCustomInputMode] = useState<"hex" | "cmyk" | "rgba">("hex");
  const designSectionRef = useRef<HTMLDivElement | null>(null);
  const previewWrapRef = useRef<HTMLDivElement | null>(null);
  const previewStickyRef = useRef<HTMLDivElement | null>(null);
  const priceSectionRef = useRef<HTMLDivElement | null>(null);
  const priceWrapRef = useRef<HTMLDivElement | null>(null);
  const priceStickyRef = useRef<HTMLDivElement | null>(null);
  const hasManualSubtypeRef = useRef(false);

  const capturePreviewSvg = () => {
    if (typeof window === "undefined") return null;
    const root = previewStickyRef.current;
    if (!root) return null;

    const svgs = Array.from(root.querySelectorAll("svg"));
    if (svgs.length === 0) return null;

    const baseSvg = svgs[0].cloneNode(true) as SVGSVGElement;
    for (let i = 1; i < svgs.length; i += 1) {
      const svg = svgs[i];
      const children = Array.from(svg.childNodes).map((node) => node.cloneNode(true));
      children.forEach((child) => baseSvg.appendChild(child));
    }
    if (!baseSvg.getAttribute("xmlns")) {
      baseSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    }
    if (!baseSvg.getAttribute("viewBox")) {
      baseSvg.setAttribute("viewBox", "0 0 1772 1300");
    }

    try {
      return new XMLSerializer().serializeToString(baseSvg);
    } catch {
      return null;
    }
  };

  const capturePreviewPngDataUrl = async (svgMarkup: string | null) => {
    if (typeof window === "undefined" || !svgMarkup) return null;

    const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);

    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const nextImage = new Image();
        nextImage.onload = () => resolve(nextImage);
        nextImage.onerror = () => reject(new Error("Preview image load failed."));
        nextImage.src = objectUrl;
      });

      const canvas = document.createElement("canvas");
      canvas.width = 886;
      canvas.height = 650;
      const context = canvas.getContext("2d");
      if (!context) return null;

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/png");
    } catch {
      return null;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const navEntry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const isReload = navEntry?.type === "reload" || performance.navigation?.type === 1;
    if (isReload) {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, []);

  const openCustomPicker = (target: "heart" | "text" | "jacket1" | "jacket2", current: string) => {
    const fallback = target === "text" || target === "heart" ? defaultTextColor : defaultJacketColor;
    const normalized = normalizeHex(current, fallback);
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
    const fallback = customTarget === "text" || customTarget === "heart" ? defaultTextColor : defaultJacketColor;
    const normalized = normalizeHex(customHex, fallback);
    if (customTarget === "heart") setHeartColor(normalized);
    if (customTarget === "text") setTextColor(normalized);
    if (customTarget === "jacket1") setJacketColorOne(normalized);
    if (customTarget === "jacket2") setJacketColorTwo(normalized);
    setCustomPickerOpen(false);
  };
  const toggleRainbow = () =>
    setRainbowJacket((prev) => {
      const next = !prev;
      if (next) {
        setPinstripeJacket(false);
        setTwoColourJacket(false);
      }
      return next;
    });
  const togglePinstripe = () =>
    setPinstripeJacket((prev) => {
      const next = !prev;
      if (next) setRainbowJacket(false);
      return next;
    });
  const toggleTwoColour = () =>
    setTwoColourJacket((prev) => {
      const next = !prev;
      if (next) setRainbowJacket(false);
      return next;
    });

  useEffect(() => {
    if (!editItemId || !editItem) return;
    if (appliedEditRef.current === editItemId) return;
    appliedEditRef.current = editItemId;

    const fallbackCategory =
      (editItem.categoryId && categories.some((category) => category.id === editItem.categoryId)
        ? editItem.categoryId
        : null) ||
      (editItem.designType && categories.some((category) => category.id === editItem.designType)
        ? editItem.designType
        : null) ||
      "";
    const nextOrderType = inferOrderTypeFromCategory(fallbackCategory || editItem.designType || orderType) ?? orderType;

    hasManualSubtypeRef.current = true;
    setOrderType(nextOrderType);
    setCategoryId(nextOrderType === "branded" ? "branded" : fallbackCategory);

    const matchedPackaging = editItem.packagingOptionId
      ? packagingOptions.find((option) => option.id === editItem.packagingOptionId)
      : null;
    if (matchedPackaging) {
      setSelectionType(matchedPackaging.type);
      setSelectionSize(matchedPackaging.size);
    }
    setSelectionQtyInput(String(Math.max(1, editItem.quantity || 1)));
    setJarLidColor(editItem.jarLidColor || "");

    const labelsEnabled = Boolean((editItem.labelsCount ?? 0) > 0 || editItem.labelImageUrl || editItem.labelTypeId);
    setLabelsOptIn(labelsEnabled);
    setLabelTypeId(editItem.labelTypeId || "");
    setLabelCountOverride(Math.max(0, editItem.labelsCount ?? 0));
    setLabelImageUrl(editItem.labelImageUrl || "");
    setLabelFileName("");
    setLabelImageError(null);
    setIngredientLabelsOptIn(Boolean(editItem.ingredientLabelsOptIn));

    const hasJacketExtra = (name: "rainbow" | "two_colour" | "pinstripe") =>
      Boolean(editItem.jacketExtras?.some((extra) => extra.jacket === name));
    const jacketValue = editItem.jacket || "";
    setRainbowJacket(jacketValue === "rainbow" || hasJacketExtra("rainbow"));
    setTwoColourJacket(
      jacketValue === "two_colour" || jacketValue === "two_colour_pinstripe" || hasJacketExtra("two_colour")
    );
    setPinstripeJacket(
      jacketValue === "pinstripe" || jacketValue === "two_colour_pinstripe" || hasJacketExtra("pinstripe")
    );
    setJacketColorOne(editItem.jacketColorOne || "");
    setJacketColorTwo(editItem.jacketColorTwo || "");
    setTextColor(editItem.textColor || "");
    setHeartColor(editItem.heartColor || "");
    setFlavor(editItem.flavor || "");
    setLogoUrl(editItem.logoUrl || "");
    setLogoError(null);

    const designSource = (editItem.designText || editItem.title || "").trim();
    const parsedWedding = splitWeddingDesign(designSource);
    if (nextOrderType === "weddings") {
      const useInitials = fallbackCategory === "weddings-initials";
      if (useInitials) {
        setInitialOne(parsedWedding.lineOne.slice(0, 1).toUpperCase());
        setInitialTwo(parsedWedding.lineTwo.slice(0, 1).toUpperCase());
        setNameOne("");
        setNameTwo("");
      } else {
        setNameOne(parsedWedding.lineOne.slice(0, 8).toUpperCase());
        setNameTwo(parsedWedding.lineTwo.slice(0, 8).toUpperCase());
        setInitialOne("");
        setInitialTwo("");
      }
      setCustomText("");
      setOrgName("");
    } else if (nextOrderType === "text") {
      setCustomText(designSource);
      setInitialOne("");
      setInitialTwo("");
      setNameOne("");
      setNameTwo("");
      setOrgName("");
    } else if (nextOrderType === "branded") {
      setOrgName(designSource);
      setCustomText("");
      setInitialOne("");
      setInitialTwo("");
      setNameOne("");
      setNameTwo("");
    }
  }, [categories, editItem, editItemId, orderType, packagingOptions]);

  useEffect(() => {
    const urlOrderType =
      typeof window !== "undefined"
        ? normalizeOrderType(new URLSearchParams(window.location.search).get("type"))
        : undefined;
      const nextOrderType = queryOrderType ?? initialOrderType ?? urlOrderType;
      if (!nextOrderType) return;

      const validQuerySubtype =
        querySubtype && ORDER_SUBTYPES[nextOrderType]?.some((sub) => sub.id === querySubtype) ? querySubtype : undefined;
      const isValidSubtype = ORDER_SUBTYPES[nextOrderType]?.some((sub) => sub.id === categoryId);
      const allowQuerySubtype = !hasManualSubtypeRef.current;
      const hasExplicitOrderType = Boolean(queryOrderType || initialOrderType || urlOrderType);
      const shouldRequireSubtypeSelection =
        hasExplicitOrderType && !validQuerySubtype && nextOrderType !== "branded" && !hasManualSubtypeRef.current;

      let nextSubtype = categoryId;
      if (allowQuerySubtype && validQuerySubtype) {
        nextSubtype = validQuerySubtype;
      } else if (shouldRequireSubtypeSelection) {
        nextSubtype = "";
      } else if (nextOrderType === "branded") {
        nextSubtype = ORDER_SUBTYPES.branded[0]?.id ?? "branded";
      } else if (!isValidSubtype) {
        nextSubtype = ORDER_SUBTYPES[nextOrderType]?.[0]?.id ?? "";
      }

      if (nextOrderType !== orderType) {
        setOrderType(nextOrderType);
      }
      if (nextSubtype !== categoryId) {
        setCategoryId(nextSubtype);
      }
    }, [queryOrderType, querySubtype, initialOrderType, orderType, categoryId]);
  const rainbowDisabled = pinstripeJacket || twoColourJacket;
  const pinstripeDisabled = rainbowJacket;
  const twoColourDisabled = rainbowJacket;
  const previewJacketMode = rainbowJacket ? "rainbow" : twoColourJacket ? "two_colour" : pinstripeJacket ? "pinstripe" : "";
  const previewShowPinstripe = pinstripeJacket;
  const showColourTwo = twoColourJacket && !rainbowJacket;
  const previewJacketColorOne = jacketColorOne || defaultJacketColor;
  const previewJacketColorTwo = jacketColorTwo || defaultJacketColor;
  const previewTextColor = textColor || defaultTextColor;
  const previewHeartColor = heartColor || defaultTextColor;
  const formatMoney = (value: number) => `$${value.toFixed(2)}`;
  const mainTitle = ORDER_TYPE_TITLES[orderType] ?? "Candy";
  const subtitleLabel =
    SUBTITLE_BY_CATEGORY[categoryId] ?? categories.find((category) => category.id === categoryId)?.name ?? "";
  const basePrice = minBasePrices[categoryId];
  const hasBasePrice = typeof basePrice === "number" && Number.isFinite(basePrice);
  const subtitle = subtitleLabel && hasBasePrice ? `${subtitleLabel} - base ${formatMoney(basePrice)}` : subtitleLabel;
  const handleLogoUpload = (file?: File | null) => {
    if (!file) {
      setLogoUrl("");
      setLogoError(null);
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoUrl("");
      setLogoError("File is too large. Max 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setLogoUrl(result);
      setLogoError(null);
    };
    reader.onerror = () => {
      setLogoUrl("");
      setLogoError("Unable to read the file.");
    };
    reader.readAsDataURL(file);
  };
  const handleLabelUpload = (file?: File | null) => {
    if (!file) {
      setLabelFileName("");
      setLabelImageUrl("");
      setLabelImageError(null);
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLabelFileName("");
      setLabelImageUrl("");
      setLabelImageError("File is too large. Max 2MB.");
      return;
    }
    setLabelFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setLabelImageUrl(result);
      setLabelImageError(null);
    };
    reader.onerror = () => {
      setLabelFileName("");
      setLabelImageUrl("");
      setLabelImageError("Unable to read the file.");
    };
    reader.readAsDataURL(file);
  };

  const selectionQty = useMemo(() => {
    const parsed = Number(selectionQtyInput);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [selectionQtyInput]);
  const totalPackages = useMemo(() => selectionQty, [selectionQty]);

  const filteredPackaging = useMemo(
    () => packagingOptions.filter((p) => p.allowed_categories.includes(categoryId)),
    [packagingOptions, categoryId]
  );

  const packagingTypes = useMemo(
    () => Array.from(new Set(filteredPackaging.map((p) => p.type))),
    [filteredPackaging]
  );

  // Keep a valid default selection for type/size when options load or change.
  useEffect(() => {
    if (packagingTypes.length === 0) {
      if (selectionType) setSelectionType("");
      if (selectionSize) setSelectionSize("");
      return;
    }
    if (!selectionType || !packagingTypes.includes(selectionType)) {
      setSelectionType(packagingTypes[0]);
      setSelectionSize("");
    }
  }, [packagingTypes, selectionType, selectionSize]);

  const sizesForType = useMemo(() => {
    if (!selectionType) return [];
    const isJarType = selectionType.toLowerCase().includes("jar");
    const extractLeadingNumber = (value: string) => {
      const match = value.trim().match(/^(\d+)/);
      return match ? Number(match[1]) : null;
    };
    return filteredPackaging
      .filter((p) => p.type === selectionType)
      .map((opt, index) => ({ opt, index }))
      .sort((a, b) => {
        if (isJarType) {
          const aWeight = Number(a.opt.candy_weight_g);
          const bWeight = Number(b.opt.candy_weight_g);
          if (Number.isFinite(aWeight) && Number.isFinite(bWeight) && aWeight !== bWeight) {
            return aWeight - bWeight;
          }
        }
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
  }, [filteredPackaging, selectionType]);

  useEffect(() => {
    if (!selectionType) return;
    if (sizesForType.length === 0) {
      if (selectionSize) setSelectionSize("");
      return;
    }
    if (!selectionSize || !sizesForType.some((opt) => opt.size === selectionSize)) {
      setSelectionSize(sizesForType[0].size);
    }
  }, [selectionType, selectionSize, sizesForType]);

  const selectedOptionId = useMemo(() => {
    const found = sizesForType.find((p) => p.size === selectionSize);
    return found?.id ?? "";
  }, [sizesForType, selectionSize]);

  const selectedOption = useMemo(
    () => packagingOptions.find((p) => p.id === selectedOptionId),
    [packagingOptions, selectedOptionId]
  );
  const availableLabelTypes = useMemo(() => {
    const ids = selectedOption?.label_type_ids ?? [];
    return ids.map((id) => labelTypeById.get(id)).filter((item): item is LabelType => Boolean(item));
  }, [labelTypeById, selectedOption?.label_type_ids]);
  const hasLabelTypes = availableLabelTypes.length > 0;
  const isJarOption = useMemo(
    () => (selectedOption?.type ?? "").toLowerCase().includes("jar"),
    [selectedOption]
  );
  const availableLidColors = useMemo(
    () => (selectedOption?.lid_colors ?? []).filter(Boolean),
    [selectedOption]
  );

  useEffect(() => {
    if (!selectedOption?.max_packages) return;
    const parsed = Number(selectionQtyInput);
    if (!Number.isFinite(parsed)) return;
    const maxPackages = Number(selectedOption.max_packages);
    if (!Number.isFinite(maxPackages)) return;
    if (parsed <= maxPackages) return;
    setSelectionQtyInput(String(maxPackages));
  }, [selectionQtyInput, selectedOption?.max_packages]);

  useEffect(() => {
    if (!isJarOption) {
      if (jarLidColor) setJarLidColor("");
      return;
    }
    if (availableLidColors.length === 0) {
      if (jarLidColor) setJarLidColor("");
      return;
    }
    if (!availableLidColors.includes(jarLidColor)) {
      setJarLidColor(availableLidColors[0]);
    }
  }, [availableLidColors, isJarOption, jarLidColor]);

  const hasBulkSelection = useMemo(() => {
    const opt = packagingOptions.find((p) => p.id === selectedOptionId);
    return !!opt && opt.type.toLowerCase() === "bulk" && selectionQty > 0;
  }, [packagingOptions, selectedOptionId, selectionQty]);
  const maxCustomLabelCountForPricing = useMemo(() => {
    if (!selectedOption) return 0;
    const maxPackages = Number(selectedOption.max_packages ?? 0);
    if (!Number.isFinite(maxPackages) || maxPackages <= 0) return 0;
    return Math.max(0, Math.min(Math.floor(maxPackages), settings.labels_max_bulk));
  }, [selectedOption, settings.labels_max_bulk]);
  const packageTypeLabel = useMemo(() => {
    if (!selectedOption) return "package";
    return ((selectedOption.type || "").trim().toLowerCase() || "package");
  }, [selectedOption]);

  const totalWeightKg = useMemo(() => {
    const lookup = new Map(packagingOptions.map((p) => [p.id, p]));
    const opt = selectedOptionId ? lookup.get(selectedOptionId) : null;
    const totalG = opt ? Number(opt.candy_weight_g) * selectionQty : 0;
    return totalG / 1000;
  }, [selectionQty, selectedOptionId, packagingOptions]);

  const packagingImage = useMemo(() => {
    if (!selectedOptionId || !categoryId) return null;
    const lidKey = isJarOption ? jarLidColor : "";
    return (
      packagingImages.find(
        (img) =>
          img.packaging_option_id === selectedOptionId &&
          img.category_id === categoryId &&
          img.lid_color === lidKey
      ) ?? null
    );
  }, [categoryId, isJarOption, jarLidColor, packagingImages, selectedOptionId]);

  const packagingImageUrl = useMemo(
    () => buildPublicImageUrl(packagingImage?.image_path),
    [packagingImage?.image_path]
  );

  useEffect(() => {
    setPackagingImageFailed(false);
  }, [packagingImageUrl]);

  const isWedding = orderType === "weddings";
  const isWeddingInitials = isWedding && categoryId.includes("weddings-initials");
  const isText = orderType === "text";
  const isBranded = orderType === "branded";
  const isShortCustom = isText && categoryId === "custom-1-6";
  const maxCustomLength = isShortCustom ? 6 : 14;
  const designTitle = isWedding
    ? isWeddingInitials
      ? `${(initialOne || "").trim().toUpperCase()} ❤️ ${(initialTwo || "").trim().toUpperCase()}`
      : `${(nameOne || "").trim()} ❤️ ${(nameTwo || "").trim()}`
    : isBranded
      ? (orgName || "").trim()
      : (customText || "").trim();
  const designValid = Boolean(
    (isWedding && (isWeddingInitials ? initialOne && initialTwo : nameOne && nameTwo)) ||
      (isText && customText) ||
      (isBranded && logoUrl) ||
      (!isWedding && !isText && !isBranded) // fallback
  );
  const jacketColorsValid = rainbowJacket
    ? true
    : showColourTwo
      ? Boolean(jacketColorOne) && Boolean(jacketColorTwo)
      : Boolean(jacketColorOne);
  const textColorValid = isBranded ? true : Boolean(textColor);
  const heartColorValid = isWedding ? Boolean(heartColor) : true;
  const colorsValid = jacketColorsValid && textColorValid && heartColorValid;
  const labelTypeValid = !labelsOptIn || (hasLabelTypes && Boolean(labelTypeId));
  const designRequirementLabel = isWedding
    ? isWeddingInitials
      ? "Initials"
      : "Names"
    : isText
      ? "Custom text"
    : isBranded
        ? "Design upload"
        : "Design details";
  const flavorValid = Boolean(flavor);
  const canPlace =
    !!result &&
    designValid &&
    flavorValid &&
    colorsValid &&
    labelTypeValid &&
    (!labelsOptIn || !!labelImageUrl);
  const missingFields = useMemo(() => {
    const missing: string[] = [];
    if (!selectedOptionId || selectionQty <= 0) {
      missing.push("Packaging & quantity");
    }
    if (!designValid) {
      missing.push(designRequirementLabel);
    }
    if (!rainbowJacket && (!jacketColorOne || (showColourTwo && !jacketColorTwo))) {
      missing.push(showColourTwo ? "Jacket colours" : "Jacket colour");
    }
    if (!isBranded && !textColor) {
      missing.push("Text colour");
    }
    if (isWedding && !heartColor) {
      missing.push("Heart colour");
    }
    if (!flavorValid) {
      missing.push("Candy flavor");
    }
    if (labelsOptIn && !labelImageUrl) {
      missing.push("Label artwork");
    }
    if (labelsOptIn && !labelTypeValid) {
      missing.push("Label type");
    }
    return missing;
  }, [
    designRequirementLabel,
    designValid,
    flavorValid,
    heartColor,
    isBranded,
    isWedding,
    jacketColorOne,
    jacketColorTwo,
    labelImageUrl,
    labelTypeValid,
    labelsOptIn,
    rainbowJacket,
    selectedOptionId,
    selectionQty,
    showColourTwo,
    textColor,
  ]);

  useEffect(() => {
    if (!hasBulkSelection) {
      setLabelCountOverride(0);
    }
  }, [hasBulkSelection]);

  useEffect(() => {
    if (!labelsOptIn) {
      setLabelFileName("");
      setLabelImageUrl("");
      setLabelImageError(null);
    }
  }, [labelsOptIn]);

  useEffect(() => {
    if (!labelsOptIn) {
      if (labelTypeId) setLabelTypeId("");
      return;
    }
    const hasValidSelection =
      labelTypeId && availableLabelTypes.some((labelType) => labelType.id === labelTypeId);
    if (hasValidSelection) return;
    const nextDefault = availableLabelTypes[0]?.id ?? "";
    if (nextDefault) {
      setLabelTypeId(nextDefault);
    } else if (labelTypeId) {
      setLabelTypeId("");
    }
  }, [availableLabelTypes, labelTypeId, labelsOptIn]);

  useEffect(() => {
    if (hasBulkSelection && labelsOptIn && labelCountOverride === 0 && totalPackages > 0) {
      setLabelCountOverride(Math.min(totalPackages, settings.labels_max_bulk));
    }
  }, [hasBulkSelection, labelsOptIn, labelCountOverride, totalPackages, settings.labels_max_bulk]);

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      if (!categoryId || !selectedOptionId || selectionQty <= 0) {
        setResult(null);
        setError(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const body: {
          categoryId: string;
          packaging: Selection[];
          labelsCount?: number;
          ingredientLabelsCount?: number;
          extras?: { jacket: "rainbow" | "two_colour" | "pinstripe" }[];
        } = {
          categoryId,
          packaging: [{ optionId: selectedOptionId, quantity: selectionQty }],
        };

        if (labelsOptIn) {
          if (hasBulkSelection) {
            const capped =
              labelCountOverride > 0
                ? Math.min(labelCountOverride, settings.labels_max_bulk)
                : 0;
            body.labelsCount = capped;
          } else {
            body.labelsCount = totalPackages;
          }
        }
        if (ingredientLabelsOptIn) {
          body.ingredientLabelsCount = totalPackages;
        }
        const jacketExtras: { jacket: "rainbow" | "two_colour" | "pinstripe" }[] = [];
        if (rainbowJacket) jacketExtras.push({ jacket: "rainbow" });
        if (twoColourJacket) jacketExtras.push({ jacket: "two_colour" });
        if (pinstripeJacket) jacketExtras.push({ jacket: "pinstripe" });
        if (jacketExtras.length) body.extras = jacketExtras;

        const res = await fetch("/api/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        const data = (await res.json()) as QuoteResult & { error?: string };
        if (!res.ok) {
          setError(data.error || "Unable to calculate");
          setResult(null);
        } else {
          setResult(data);
          setError(null);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        const message = err instanceof Error ? err.message : "Unable to calculate";
        setError(message);
        setResult(null);
      } finally {
        setLoading(false);
      }
    };
    const timeout = setTimeout(run, 200);
    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [
    categoryId,
    selectedOptionId,
    selectionQty,
    totalPackages,
    rainbowJacket,
    pinstripeJacket,
    twoColourJacket,
    labelsOptIn,
    ingredientLabelsOptIn,
    hasBulkSelection,
    labelCountOverride,
    settings.labels_max_bulk,
  ]);

  useEffect(() => {
    const container = designSectionRef.current;
    const preview = previewWrapRef.current;
    const stickyEl = previewStickyRef.current;
    if (!container || !preview || !stickyEl) return;

    const mql = window.matchMedia("(max-width: 1023px)");
    const priceSticky = priceStickyRef.current;
    const headerEl = document.querySelector<HTMLElement>("[data-quote-header]");
    const topGap = 16;
    const priceGap = 12;
    let raf = 0;

    const reset = () => {
      stickyEl.style.position = "static";
      stickyEl.style.top = "";
      stickyEl.style.left = "";
      stickyEl.style.width = "";
      stickyEl.style.zIndex = "";
      preview.style.height = "";
    };

    const update = () => {
      if (!mql.matches) {
        reset();
        return;
      }
      const containerRect = container.getBoundingClientRect();
      const wrapRect = preview.getBoundingClientRect();
      const scrollY = window.scrollY;
      const containerTop = scrollY + containerRect.top;
      const containerBottom = containerTop + containerRect.height;
      const wrapTop = scrollY + wrapRect.top;
      const previewHeight = stickyEl.offsetHeight;
      const priceHeight = priceSticky?.offsetHeight ?? 0;
      const baseOffset = (headerEl?.getBoundingClientRect().height ?? 0) + topGap;
      const topOffset = baseOffset + priceHeight + priceGap;

      const start = wrapTop - topOffset;
      const end = containerBottom - topOffset - previewHeight;

      if (scrollY < start) {
        reset();
        return;
      }

      preview.style.height = `${previewHeight}px`;
      const width = wrapRect.width;
      const left = wrapRect.left;

      if (scrollY <= end) {
        stickyEl.style.position = "fixed";
        stickyEl.style.top = `${topOffset}px`;
        stickyEl.style.left = `${left}px`;
        stickyEl.style.width = `${width}px`;
        stickyEl.style.zIndex = "20";
        return;
      }

      const absoluteTop = container.clientHeight - previewHeight;
      stickyEl.style.position = "absolute";
      stickyEl.style.top = `${absoluteTop}px`;
      stickyEl.style.left = `${wrapRect.left - containerRect.left}px`;
      stickyEl.style.width = `${width}px`;
      stickyEl.style.zIndex = "1";
    };

    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    const observer = new ResizeObserver(onScroll);
    observer.observe(container);
    observer.observe(preview);
    if (priceSticky) {
      observer.observe(priceSticky);
    }
    if (headerEl) {
      observer.observe(headerEl);
    }

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    mql.addEventListener("change", onScroll);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      mql.removeEventListener("change", onScroll);
      observer.disconnect();
      reset();
    };
  }, [selectionQty, selectedOptionId]);

  useEffect(() => {
    const container = priceSectionRef.current;
    const wrap = priceWrapRef.current;
    const stickyEl = priceStickyRef.current;
    if (!container || !wrap || !stickyEl) return;

    const headerEl = document.querySelector<HTMLElement>("[data-quote-header]");
    const topGap = 16;
    let raf = 0;
    let lockedWidth = 0;

    const reset = () => {
      stickyEl.style.position = "static";
      stickyEl.style.top = "";
      stickyEl.style.left = "";
      stickyEl.style.width = "";
      stickyEl.style.zIndex = "";
      wrap.style.height = "";
      wrap.style.width = "";
    };

    const measureRestingWidth = () => {
      const prev = {
        position: stickyEl.style.position,
        top: stickyEl.style.top,
        left: stickyEl.style.left,
        width: stickyEl.style.width,
        zIndex: stickyEl.style.zIndex,
        wrapHeight: wrap.style.height,
        wrapWidth: wrap.style.width,
      };

      reset();
      const measured = Math.ceil(Math.max(wrap.getBoundingClientRect().width, stickyEl.getBoundingClientRect().width, 220)) + 2;
      const viewportMax = Math.max(220, window.innerWidth - 16);

      stickyEl.style.position = prev.position;
      stickyEl.style.top = prev.top;
      stickyEl.style.left = prev.left;
      stickyEl.style.width = prev.width;
      stickyEl.style.zIndex = prev.zIndex;
      wrap.style.height = prev.wrapHeight;
      wrap.style.width = prev.wrapWidth;

      return Math.min(measured, viewportMax);
    };

    const update = () => {
      const containerRect = container.getBoundingClientRect();
      const wrapRect = wrap.getBoundingClientRect();
      const scrollY = window.scrollY;
      const containerTop = scrollY + containerRect.top;
      const containerBottom = containerTop + containerRect.height;
      const wrapTop = scrollY + wrapRect.top;
      const stickyHeight = stickyEl.offsetHeight;
      const topOffset = (headerEl?.getBoundingClientRect().height ?? 0) + topGap;

      const start = wrapTop - topOffset;
      const end = containerBottom - topOffset - stickyHeight;

      if (scrollY < start) {
        reset();
        lockedWidth = measureRestingWidth();
        return;
      }

      if (!lockedWidth) {
        lockedWidth = measureRestingWidth();
      }
      const width = Math.min(lockedWidth, Math.max(220, window.innerWidth - 16));
      wrap.style.height = `${stickyHeight}px`;
      wrap.style.width = `${width}px`;
      const currentWrapRect = wrap.getBoundingClientRect();
      const left = Math.min(Math.max(Math.round(currentWrapRect.left), 8), Math.max(8, window.innerWidth - width - 8));

      if (scrollY <= end) {
        stickyEl.style.position = "fixed";
        stickyEl.style.top = `${topOffset}px`;
        stickyEl.style.left = `${left}px`;
        stickyEl.style.width = `${width}px`;
        stickyEl.style.zIndex = "30";
        return;
      }

      const absoluteTop = container.clientHeight - stickyHeight;
      stickyEl.style.position = "absolute";
      stickyEl.style.top = `${absoluteTop}px`;
      stickyEl.style.left = `${Math.round(left - containerRect.left)}px`;
      stickyEl.style.width = `${width}px`;
      stickyEl.style.zIndex = "1";
    };

    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    const observer = new ResizeObserver(onScroll);
    observer.observe(container);
    observer.observe(wrap);
    observer.observe(stickyEl);
    if (headerEl) {
      observer.observe(headerEl);
    }

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      observer.disconnect();
      reset();
    };
  }, [showBreakdown, loading, error, needsSubtypeSelection, result?.total, result?.transactionFee, result?.items.length]);


  return (
    <div className="relative space-y-6">
      <section className="pt-10 text-center lg:mx-auto lg:max-w-5xl">
        <h1 className="normal-case text-[45px] font-medium tracking-tight text-[rgb(146,146,177)]">{mainTitle}</h1>
        <p className={`${montserratLight.className} mt-3 text-[14px] font-[200] tracking-[0.03em] text-zinc-600`}>
          <span className="hidden sm:inline">{FEATURE_LABELS.join(" | ")}</span>
          <span className="sm:hidden">
            {FEATURE_LABELS.slice(0, 3).join(" | ")}
            <br />
            {FEATURE_LABELS.slice(3).join(" | ")}
          </span>
        </p>
        {subtitle && <p className="mt-2 text-[24px] font-medium text-[rgb(146,146,177)]">{subtitle}</p>}
      </section>

      <div ref={priceSectionRef} className="relative min-w-0 space-y-6 lg:mx-auto lg:max-w-5xl">
        {/* Price sidebar */}
        <div ref={priceWrapRef} className="relative mx-auto w-fit max-w-full overflow-visible">
          <div ref={priceStickyRef} className="w-fit max-w-full overflow-visible">
            <div
              className={`relative border border-zinc-200 bg-white p-3 shadow-sm shadow-lg lg:shadow-lg ${
                showBreakdown ? "rounded-t-2xl rounded-b-none" : "rounded-2xl"
              }`}
            >
              {needsSubtypeSelection ? (
                <p className="text-sm text-zinc-500 text-center">Select your order type</p>
              ) : result ? (
                <div className="space-y-2">
                  {(() => {
                    const subtotal = Math.max(0, result.total - result.transactionFee);
                    return (
                      <div className="flex items-center justify-center gap-3">
                        <div className="flex items-center gap-2">
                          <p
                            className="text-center text-2xl font-semibold leading-none"
                            style={{ fontFamily: "var(--font-heading), sans-serif", color: "rgb(63,63,70)" }}
                          >
                            ${subtotal.toFixed(2)}
                          </p>
                          {loading && (
                            <span className="inline-flex items-center">
                              <span className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700" />
                              <span className="sr-only">Updating</span>
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowBreakdown((prev) => !prev)}
                          data-neutral-button
                          className="whitespace-nowrap rounded px-2 py-1 text-xs font-semibold hover:border-zinc-400"
                        >
                          {showBreakdown ? "Hide breakdown" : "Show breakdown"}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <p className="text-sm text-zinc-500">
                  {loading ? "Calculating..." : "Select packaging to see price"}
                </p>
              )}
              {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
            </div>
            {result && showBreakdown && (
              <div className="absolute left-0 right-0 top-[calc(100%-1px)] z-40 rounded-b-2xl border border-zinc-200 border-t-0 bg-white px-3 pb-3 pt-2 shadow-lg">
                <div className="space-y-1 text-sm text-zinc-700">
                  {result.items.map((item: QuoteItem) => (
                    <div key={item.label} className="flex justify-between border-b border-zinc-100 pb-1">
                      <span>{item.label}</span>
                      <span>${item.amount.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="mt-1 border-t border-zinc-200 pt-1 text-zinc-700">
                    <p className="text-[11px] text-zinc-500">Subtotal excludes transaction fee.</p>
                    <div className="flex justify-between text-xs">
                      <span>Total with fee</span>
                      <span>${result.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        {/* Step 1: Subtype */}
        {showSubtype && (
          <div className="flex justify-center">
            <div
              className="inline-flex w-auto max-w-full overflow-hidden rounded-full"
              style={{
                borderColor: "rgb(239,232,239)",
                borderWidth: "0.5px",
                borderStyle: "solid",
                backgroundColor: "rgb(250,243,247)",
              }}
            >
                  {ORDER_SUBTYPES[orderType]?.map((sub, index) => {
                    const isActive = categoryId === sub.id;
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => {
                          hasManualSubtypeRef.current = true;
                          setCategoryId(sub.id);
                        }}
                        className={`px-6 py-3 text-sm font-semibold normal-case tracking-[0.04em] transition ${index > 0 ? "border-l" : ""}`}
                        style={{
                          backgroundColor: isActive ? "rgb(247,228,236)" : "rgb(250,243,247)",
                          borderColor: "rgb(239,232,239)",
                          color: "rgb(124,121,131)",
                          fontFamily: "var(--font-body), sans-serif",
                        }}
                      >
                        {toTitleCase(sub.label)}
                      </button>
                    );
                  })}
            </div>
          </div>
        )}

        <div className={`space-y-6 ${needsSubtypeSelection ? "opacity-40 pointer-events-none" : ""}`}>
          {/* Step 2: Packaging (single selection) */}
          <div className="mt-4 w-full border-t border-zinc-200 pt-4 space-y-3">
            <div className="grid items-start gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold normal-case text-zinc-900">Packaging</h3>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold normal-case tracking-[0.04em] text-zinc-500">Packaging Type</p>
                      <div className="flex w-full flex-wrap gap-2">
                        {packagingTypes.length > 0 ? (
                          packagingTypes.map((type) => {
                            const isActive = selectionType === type;
                            return (
                              <button
                                key={type}
                                type="button"
                                onClick={() => {
                                  setSelectionType(type);
                                  setSelectionSize("");
                                }}
                                className="rounded-full px-4 py-2 text-xs font-semibold normal-case tracking-[0.08em] transition"
                                style={{
                                  backgroundColor: isActive ? "rgb(247,228,236)" : "rgb(250,243,247)",
                                  borderColor: "rgb(239,232,239)",
                                  borderWidth: "0.5px",
                                  borderStyle: "solid",
                                  color: "rgb(124,121,131)",
                                  fontFamily: "var(--font-body), sans-serif",
                                }}
                              >
                                {toTitleCase(type)}
                              </button>
                            );
                          })
                      ) : (
                        <span className="w-full px-4 py-3 text-left text-xs font-semibold normal-case tracking-[0.04em] text-zinc-400">
                          No types available
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold normal-case tracking-[0.04em] text-zinc-500">Packaging Size</p>
                      <div className="flex w-full flex-wrap gap-2">
                        {selectionType ? (
                          <>
                            {sizesForType.map((opt) => {
                              const isActive = selectionSize === opt.size;
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => setSelectionSize(opt.size)}
                                  className="rounded-full px-3 py-2 text-xs font-semibold normal-case tracking-[0.08em] transition"
                                style={{
                                  backgroundColor: isActive ? "rgb(247,228,236)" : "rgb(250,243,247)",
                                  borderColor: "rgb(239,232,239)",
                                  borderWidth: "0.5px",
                                  borderStyle: "solid",
                                  color: "rgb(124,121,131)",
                                  fontFamily: "var(--font-body), sans-serif",
                                }}
                                >
                                  <span className="whitespace-nowrap">{toTitleCase(opt.size)}</span>
                                </button>
                              );
                            })}
                          </>
                      ) : (
                        <span className="w-full px-4 py-3 text-left text-xs font-semibold normal-case tracking-[0.04em] text-zinc-400">
                          Select a type to see sizes
                        </span>
                      )}
                    </div>
                  </div>

                  {isJarOption && availableLidColors.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold normal-case tracking-[0.04em] text-zinc-500">Jar Lid Colour</p>
                        <div className="flex w-full flex-wrap gap-2">
                          {availableLidColors.map((color) => {
                            const swatch = LID_COLOR_SWATCH[color] ?? color;
                            const isActive = jarLidColor === color;
                            return (
                              <button
                                key={color}
                                type="button"
                                onClick={() => setJarLidColor(color)}
                                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold normal-case tracking-[0.08em] transition"
                                style={{
                                  backgroundColor: isActive ? "rgb(247,228,236)" : "rgb(250,243,247)",
                                  borderColor: "rgb(239,232,239)",
                                  borderWidth: "0.5px",
                                  borderStyle: "solid",
                                  color: "rgb(124,121,131)",
                                  fontFamily: "var(--font-body), sans-serif",
                                }}
                              >
                                <span>{toTitleCase(color)}</span>
                                <span
                                  className="h-3.5 w-3.5 rounded-full border border-white/60"
                                  style={{ backgroundColor: swatch }}
                                  aria-hidden="true"
                                />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <p className="text-xs font-semibold normal-case tracking-[0.04em] text-zinc-500">
                      Quantity{selectedOption ? ` (Max ${selectedOption.max_packages})` : ""}
                    </p>
                    <div className="flex w-full overflow-hidden rounded-full border border-zinc-200 bg-white">
                      <input
                        type="number"
                        min={0}
                        max={selectedOption?.max_packages}
                        value={selectionQtyInput}
                        onChange={(e) => setSelectionQtyInput(e.target.value)}
                        aria-label="Quantity"
                        className="w-full px-4 py-2 text-center text-sm font-semibold text-zinc-900 outline-none"
                      />
                    </div>
                  </div>
                  </div>

              </div>

              <div className="flex h-full items-start justify-center">
                <div className="aspect-square w-[375px] max-w-full rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                  {packagingImageUrl && !packagingImageFailed ? (
                    <img
                      src={packagingImageUrl}
                      alt={`Packaging preview for ${selectionType} ${selectionSize}`}
                      className="h-full w-full object-contain"
                      loading="lazy"
                      onError={() => setPackagingImageFailed(true)}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-zinc-500">
                      {packagingImageFailed || (selectedOptionId && categoryId)
                        ? "Preview not available yet."
                        : "Select packaging to preview."}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 w-full border-t border-zinc-200 pt-4">
              <h3 className="text-lg font-semibold normal-case text-zinc-900">Labels (optional)</h3>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-3">
                  <label className="group flex items-start gap-3 px-1 py-1 text-sm text-zinc-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={labelsOptIn}
                      onChange={(e) => setLabelsOptIn(e.target.checked)}
                      className="peer sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded border border-[rgb(239,232,239)] bg-[rgb(250,243,247)] text-transparent transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[rgb(247,228,236)] peer-checked:border-[rgb(247,228,236)] peer-checked:bg-[rgb(247,228,236)] peer-checked:text-[rgb(124,121,131)]"
                    >
                      <svg
                        viewBox="0 0 20 20"
                        className="h-3 w-3"
                        aria-hidden="true"
                      >
                        <path
                          d="M7.7 13.2 4.8 10.3l-1 1 3.9 3.9 8.5-8.5-1-1z"
                          fill="currentColor"
                        />
                      </svg>
                    </span>
                    <span className="flex-1 space-y-0.5">
                      <span className="block text-sm font-semibold text-zinc-900">Custom Labels</span>
                      <span className="block text-xs text-zinc-500">
                        Add a custom printed label or logo to your packaging.
                      </span>
                      <span className="block text-xs text-zinc-500">
                        {maxCustomLabelCountForPricing > 0
                          ? "price varies based on packaging quantity"
                          : "Select packaging to calculate"}
                      </span>
                    </span>
                  </label>
                  {labelsOptIn && (
                    <div className="space-y-3">
                      <div className="rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-700">
                        <p className="text-[11px] font-semibold normal-case tracking-[0.1em] text-zinc-500">Label Type</p>
                        {hasLabelTypes ? (
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            {availableLabelTypes.map((labelType) => {
                              const isActive = labelTypeId === labelType.id;
                              return (
                                <button
                                  key={labelType.id}
                                  type="button"
                                  onClick={() => setLabelTypeId(labelType.id)}
                                  aria-pressed={isActive}
                                  className="inline-flex w-full items-center justify-between rounded-full px-3 py-2 text-left text-[11px] font-semibold normal-case tracking-[0.08em] transition"
                                  style={{
                                    backgroundColor: isActive ? "rgb(247,228,236)" : "rgb(250,243,247)",
                                    borderColor: "rgb(239,232,239)",
                                    borderWidth: "0.5px",
                                    borderStyle: "solid",
                                    color: "rgb(124,121,131)",
                                    fontFamily: "var(--font-body), sans-serif",
                                  }}
                                >
                                  <span>{formatLabelTypeLabel(labelType)}</span>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-zinc-500">No label types set for this packaging yet.</p>
                        )}
                      </div>
                      {hasBulkSelection && (
                        <label className="block text-xs text-zinc-600">
                          Labels Count (Max {settings.labels_max_bulk})
                          <input
                            type="number"
                            min={0}
                            max={settings.labels_max_bulk}
                            value={labelCountOverride}
                            onChange={(e) => setLabelCountOverride(Number(e.target.value))}
                            className="mt-1 w-full rounded-full border border-zinc-300 bg-white px-3 py-2 text-[11px] font-semibold normal-case tracking-[0.08em] text-zinc-700 shadow-sm transition focus:border-[#e91e63] focus:outline-none focus:ring-2 focus:ring-[#e91e63]/20"
                          />
                        </label>
                      )}
                      <div className="rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-700">
                        <span className="block text-[11px] font-semibold normal-case tracking-[0.1em] text-zinc-500">
                          Artwork File
                        </span>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <input
                            id="label-artwork-upload"
                            type="file"
                            accept=".pdf,.jpg,.jpeg"
                            onChange={(e) => handleLabelUpload(e.target.files?.[0])}
                            className="sr-only"
                          />
                          <label
                            htmlFor="label-artwork-upload"
                            className="inline-flex items-center rounded-full border border-zinc-300 bg-white px-3 py-2 text-[11px] font-semibold normal-case tracking-[0.08em] text-zinc-700 shadow-sm transition hover:border-zinc-400"
                          >
                            {labelFileName ? "Change file" : "Choose file"}
                          </label>
                          {labelImageUrl ? (
                            labelImageUrl.startsWith("data:image/") ? (
                              <img
                                src={labelImageUrl}
                                alt="Label preview"
                                className="h-10 w-10 rounded border border-zinc-200 object-cover"
                              />
                            ) : labelImageUrl.startsWith("data:application/pdf") ? (
                              <span className="inline-flex h-10 min-w-10 items-center justify-center rounded border border-zinc-200 bg-zinc-50 px-2 text-[10px] font-semibold text-zinc-600">
                                PDF
                              </span>
                            ) : null
                          ) : null}
                          {labelFileName && (
                            <span className="text-xs text-zinc-500" title={labelFileName}>
                              {labelFileName}
                            </span>
                          )}
                          {labelImageUrl && (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-[0.08em] text-emerald-700">
                              Ready
                            </span>
                          )}
                        </div>
                        {labelImageError && (
                          <span className="mt-1 block text-xs text-red-600">{labelImageError}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-3">
                  <label className="group flex items-start gap-3 px-1 py-1 text-sm text-zinc-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ingredientLabelsOptIn}
                      onChange={(e) => setIngredientLabelsOptIn(e.target.checked)}
                      className="peer sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded border border-[rgb(239,232,239)] bg-[rgb(250,243,247)] text-transparent transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[rgb(247,228,236)] peer-checked:border-[rgb(247,228,236)] peer-checked:bg-[rgb(247,228,236)] peer-checked:text-[rgb(124,121,131)]"
                    >
                      <svg
                        viewBox="0 0 20 20"
                        className="h-3 w-3"
                        aria-hidden="true"
                      >
                        <path
                          d="M7.7 13.2 4.8 10.3l-1 1 3.9 3.9 8.5-8.5-1-1z"
                          fill="currentColor"
                        />
                      </svg>
                    </span>
                    <span className="flex-1 space-y-0.5">
                      <span className="block text-sm font-semibold text-zinc-900">Ingredient Labels</span>
                      <span className="block text-xs text-zinc-500">
                        Add ingredient labels to your packaging
                      </span>
                      <span className="block text-xs text-zinc-500">
                        {`+$${ingredientLabelPrice.toFixed(2)} per ${packageTypeLabel}`}
                      </span>
                    </span>
                  </label>
                  {ingredientLabelsOptIn ? (
                    <div className="rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-700">
                      <p className="text-[11px] font-semibold normal-case tracking-[0.1em] text-zinc-500">Label Type</p>
                      <div className="mt-2">
                        <span
                          className="inline-flex items-center rounded-full px-3 py-2 text-[11px] font-semibold normal-case tracking-[0.08em]"
                          style={{
                            backgroundColor: "rgb(247,228,236)",
                            borderColor: "rgb(239,232,239)",
                            borderWidth: "0.5px",
                            borderStyle: "solid",
                            color: "rgb(124,121,131)",
                            fontFamily: "var(--font-body), sans-serif",
                          }}
                        >
                          {ingredientLabelType ? formatLabelTypeLabel(ingredientLabelType) : "Circle 30mm"}
                        </span>
                      </div>
                    </div>
                  ) : null}
                  {ingredientLabelsOptIn && !ingredientPreviewFailed && (
                    <div className="w-40 overflow-hidden rounded-lg border border-zinc-200 bg-white">
                      <img
                        src={INGREDIENT_LABEL_PREVIEW_SRC}
                        alt="Ingredient label preview"
                        className="h-auto w-full object-contain"
                        loading="lazy"
                        onError={() => setIngredientPreviewFailed(true)}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Step 4: Design */}
          <div
            ref={designSectionRef}
            className="mt-4 w-full border-t border-zinc-200 pt-4 relative overflow-visible"
          >
          <div>
            <h3 className="text-lg font-semibold normal-case text-zinc-900">Design</h3>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 md:items-start">
            <div
              ref={previewWrapRef}
              className="order-1 w-full md:order-2 md:flex md:h-[360px] md:items-center md:justify-center md:self-start"
            >
              <div ref={previewStickyRef} className="flex justify-center">
                <CandyPreview
                  designText={
                    isWeddingInitials
                      ? undefined
                      : isText && !isBranded
                        ? (customText || "").trim()
                        : !isWedding && !isText && !isBranded
                          ? designTitle || "Candy"
                          : undefined
                  }
                  lineOne={
                    isWedding
                      ? isWeddingInitials
                        ? (initialOne || "").trim().toUpperCase()
                        : (nameOne || "").trim()
                      : undefined
                  }
                  lineTwo={
                    isWedding
                      ? isWeddingInitials
                        ? (initialTwo || "").trim().toUpperCase()
                        : (nameTwo || "").trim()
                      : undefined
                  }
                  mode={previewJacketMode}
                  showPinstripe={previewShowPinstripe}
                  colorOne={previewJacketColorOne}
                  colorTwo={previewJacketColorTwo}
                  showHeart={isWedding}
                  logoUrl={isBranded ? logoUrl : undefined}
                  heartColor={previewHeartColor}
                  textColor={previewTextColor}
                  isInitials={isWeddingInitials}
                  dimensions={{ width: 420, height: 312 }}
                  zoom={1.3}
                />
              </div>
            </div>
            <div className="order-2 md:order-1">
              <div className="grid gap-3 md:grid-cols-2">
              {isWedding && (
                <>
                    <label className="text-xs font-semibold normal-case tracking-[0.04em] text-zinc-900">
                      First {isWeddingInitials ? "initial" : "name"}
                      <input
                        type="text"
                        value={isWeddingInitials ? initialOne : nameOne}
                        maxLength={isWeddingInitials ? 1 : 8}
                        onChange={(e) =>
                          isWeddingInitials
                            ? setInitialOne((e.target.value || "").slice(0, 1).toUpperCase())
                            : setNameOne((e.target.value || "").slice(0, 8).toUpperCase())
                        }
                        required
                        className="mt-1 w-full rounded border border-zinc-200 px-3 py-2 text-sm uppercase"
                        placeholder={isWeddingInitials ? "A" : "Andy"}
                      />
                    {!isWeddingInitials && (
                      <div className="mt-1 text-right text-[11px] text-zinc-500">{`${(nameOne || "").length}/8`}</div>
                    )}
                  </label>
                    <label className="text-xs font-semibold normal-case tracking-[0.04em] text-zinc-900">
                      Second {isWeddingInitials ? "initial" : "name"}
                      <input
                        type="text"
                        value={isWeddingInitials ? initialTwo : nameTwo}
                        maxLength={isWeddingInitials ? 1 : 8}
                        onChange={(e) =>
                          isWeddingInitials
                            ? setInitialTwo((e.target.value || "").slice(0, 1).toUpperCase())
                            : setNameTwo((e.target.value || "").slice(0, 8).toUpperCase())
                        }
                        required
                        className="mt-1 w-full rounded border border-zinc-200 px-3 py-2 text-sm uppercase"
                        placeholder={isWeddingInitials ? "S" : "Sylvi"}
                      />
                    {!isWeddingInitials && (
                      <div className="mt-1 text-right text-[11px] text-zinc-500">{`${(nameTwo || "").length}/8`}</div>
                    )}
                  </label>
                </>
              )}
              {isText && (
                <label className="text-xs normal-case tracking-[0.04em] text-zinc-500 md:col-span-2">
                  Custom text
                  <input
                    type="text"
                    value={customText}
                    maxLength={maxCustomLength}
                    onChange={(e) => setCustomText((e.target.value || "").slice(0, maxCustomLength))}
                    required
                    className="mt-1 w-full rounded border border-zinc-200 px-3 py-2 text-sm"
                    placeholder="Your text"
                  />
                </label>
              )}
              {!isBranded && (
                <div className="md:col-span-2">
                  <PalettePicker
                    label="Text colour"
                    value={textColor}
                    onChange={setTextColor}
                    groups={paletteGroups}
                    onCustom={() => openCustomPicker("text", textColor)}
                    placeholderSwatch={defaultTextColor}
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
                      placeholderSwatch={defaultTextColor}
                    />
                  </div>
                )}
              <div className="md:col-span-2">
                  <p className="text-xs font-semibold normal-case tracking-[0.04em] text-zinc-900">
                    Jacket type & colors
                  </p>
                <div className="mt-2 flex flex-col gap-2 text-sm">
                  <label
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 ${
                      rainbowDisabled && !rainbowJacket
                        ? "bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed"
                        : "bg-white text-zinc-700 border-zinc-200"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={rainbowJacket}
                      onChange={toggleRainbow}
                      disabled={rainbowDisabled && !rainbowJacket}
                      className="peer sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className="inline-flex h-5 w-5 items-center justify-center rounded border border-[rgb(239,232,239)] bg-[rgb(250,243,247)] text-transparent transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[rgb(247,228,236)] peer-checked:border-[rgb(247,228,236)] peer-checked:bg-[rgb(247,228,236)] peer-checked:text-[rgb(124,121,131)] peer-disabled:opacity-60"
                    >
                      <svg viewBox="0 0 20 20" className="h-3 w-3" aria-hidden="true">
                        <path d="M7.7 13.2 4.8 10.3l-1 1 3.9 3.9 8.5-8.5-1-1z" fill="currentColor" />
                      </svg>
                    </span>
                    <span>
                      Rainbow Jacket <span className="text-zinc-500">+{formatMoney(settings.jacket_rainbow)}</span>
                    </span>
                  </label>
                  <label
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 ${
                      pinstripeDisabled && !pinstripeJacket
                        ? "bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed"
                        : "bg-white text-zinc-700 border-zinc-200"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={pinstripeJacket}
                      onChange={togglePinstripe}
                      disabled={pinstripeDisabled && !pinstripeJacket}
                      className="peer sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className="inline-flex h-5 w-5 items-center justify-center rounded border border-[rgb(239,232,239)] bg-[rgb(250,243,247)] text-transparent transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[rgb(247,228,236)] peer-checked:border-[rgb(247,228,236)] peer-checked:bg-[rgb(247,228,236)] peer-checked:text-[rgb(124,121,131)] peer-disabled:opacity-60"
                    >
                      <svg viewBox="0 0 20 20" className="h-3 w-3" aria-hidden="true">
                        <path d="M7.7 13.2 4.8 10.3l-1 1 3.9 3.9 8.5-8.5-1-1z" fill="currentColor" />
                      </svg>
                    </span>
                    <span>
                      Pin Stripe Jacket <span className="text-zinc-500">+{formatMoney(settings.jacket_pinstripe)}</span>
                    </span>
                  </label>
                  <label
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 ${
                      twoColourDisabled && !twoColourJacket
                        ? "bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed"
                        : "bg-white text-zinc-700 border-zinc-200"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={twoColourJacket}
                      onChange={toggleTwoColour}
                      disabled={twoColourDisabled && !twoColourJacket}
                      className="peer sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className="inline-flex h-5 w-5 items-center justify-center rounded border border-[rgb(239,232,239)] bg-[rgb(250,243,247)] text-transparent transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[rgb(247,228,236)] peer-checked:border-[rgb(247,228,236)] peer-checked:bg-[rgb(247,228,236)] peer-checked:text-[rgb(124,121,131)] peer-disabled:opacity-60"
                    >
                      <svg viewBox="0 0 20 20" className="h-3 w-3" aria-hidden="true">
                        <path d="M7.7 13.2 4.8 10.3l-1 1 3.9 3.9 8.5-8.5-1-1z" fill="currentColor" />
                      </svg>
                    </span>
                    <span>
                      2 Colour Jacket <span className="text-zinc-500">+{formatMoney(settings.jacket_two_colour)}</span>
                    </span>
                  </label>
                  {!rainbowJacket && (
                    <div className="mt-1 space-y-3">
                      <PalettePicker
                        label={showColourTwo ? "Jacket Colour 1" : "Jacket Colour"}
                        value={jacketColorOne}
                        onChange={setJacketColorOne}
                        groups={paletteGroups}
                        onCustom={() => openCustomPicker("jacket1", jacketColorOne)}
                        placeholderSwatch={defaultJacketColor}
                      />
                      {showColourTwo && (
                        <PalettePicker
                          label="Jacket Colour 2"
                          value={jacketColorTwo}
                          onChange={setJacketColorTwo}
                          groups={paletteGroups}
                          onCustom={() => openCustomPicker("jacket2", jacketColorTwo)}
                          placeholderSwatch={defaultJacketColor}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
              {isBranded && (
                <div>
                  <label htmlFor="logo-upload" className="text-xs normal-case tracking-[0.04em] text-zinc-500">
                    Upload Your Design
                  </label>
                  <div className="mt-1">
                    <input
                      id="logo-upload"
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleLogoUpload(e.target.files?.[0] ?? null)}
                      className="sr-only"
                    />
                    <label
                      htmlFor="logo-upload"
                      className="inline-flex cursor-pointer items-center rounded border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-300"
                    >
                      Choose file (2mb max)
                    </label>
                  </div>
                  {logoError && <p className="mt-1 text-xs text-red-600">{logoError}</p>}
                </div>
              )}
            </div>
            </div>
          </div>
        </div>
          <div className="mt-4 w-full border-t border-zinc-200 pt-4">
            <h3 className="text-lg font-semibold normal-case text-zinc-900">Flavour</h3>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {flavors.map((f) => {
                const isActive = flavor === f.name;
                return (
                  <button
                    key={f.id}
                    type="button"
                    data-plain-button
                    onClick={() => {
                      setFlavor(f.name);
                    }}
                    aria-pressed={isActive}
                    className="w-full"
                  >
                    <span
                      className="inline-flex w-full items-center justify-center rounded-full px-4 py-2 text-xs font-semibold normal-case tracking-[0.08em] transition"
                      style={{
                        backgroundColor: isActive ? "rgb(247,228,236)" : "rgb(250,243,247)",
                        borderColor: "rgb(239,232,239)",
                        borderWidth: "0.5px",
                        borderStyle: "solid",
                        color: "rgb(124,121,131)",
                        fontFamily: "var(--font-body), sans-serif",
                      }}
                    >
                      <span>{toTitleCase(f.name)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h3 className="text-lg font-semibold text-zinc-900">Ready to continue?</h3>
            <p className="mt-2 text-sm text-zinc-600">
              You can add delivery, payment, and contact details in the cart.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={async () => {
                  setPlaceError(null);
                  if (!canPlace) {
                    const missingText = missingFields.length ? missingFields.join(", ") : "required fields";
                    setPlaceError(`Please complete: ${missingText}.`);
                    return;
                  }
                  setPlacing(true);
                  try {
                    const title = designTitle;
                    const description = selectedOption ? `${selectedOption.type} - ${selectedOption.size}` : "";
                    const labelsCount = labelsOptIn
                      ? hasBulkSelection
                        ? labelCountOverride > 0
                          ? Math.min(labelCountOverride, settings.labels_max_bulk)
                          : 0
                        : totalPackages
                      : null;
                    const jacketValue = rainbowJacket
                      ? "rainbow"
                      : twoColourJacket && pinstripeJacket
                        ? "two_colour_pinstripe"
                        : twoColourJacket
                          ? "two_colour"
                          : pinstripeJacket
                            ? "pinstripe"
                            : null;
                    const jacketExtras = [
                      ...(rainbowJacket ? [{ jacket: "rainbow" as const }] : []),
                      ...(twoColourJacket ? [{ jacket: "two_colour" as const }] : []),
                      ...(pinstripeJacket ? [{ jacket: "pinstripe" as const }] : []),
                    ];
                    const previewSvg = capturePreviewSvg();
                    const previewPngDataUrl = await capturePreviewPngDataUrl(previewSvg);

                    const customItemPayload: Omit<CustomCartItem, "id" | "type"> = {
                      title: title || mainTitle,
                      description,
                      categoryId,
                      packagingOptionId: selectedOptionId,
                      maxPackages: selectedOption?.max_packages ?? null,
                      totalPrice: result?.total ?? null,
                      totalWeightKg,
                      quantity: selectionQty,
                      packagingLabel: description,
                      jarLidColor: isJarOption ? jarLidColor || null : null,
                      labelsCount,
                      labelImageUrl: labelsOptIn ? labelImageUrl || null : null,
                      labelTypeId: labelsOptIn ? labelTypeId || null : null,
                      ingredientLabelsOptIn,
                      jacket: jacketValue,
                      jacketType: previewJacketMode || null,
                      jacketColorOne,
                      jacketColorTwo,
                      textColor: isBranded ? null : textColor,
                      heartColor: isWedding ? heartColor : null,
                      flavor,
                      logoUrl: logoUrl || null,
                      previewSvg,
                      previewPngDataUrl,
                      designType: categoryId || orderType,
                      designText: title || mainTitle,
                      jacketExtras,
                    };
                    if (isEditing && editItem) {
                      updateCustomItem(editItem.id, customItemPayload);
                    } else {
                      addCustomItem(customItemPayload);
                    }
                    router.push("/checkout");
                  } catch (addError) {
                    const message = addError instanceof Error ? addError.message : "Unable to add item to cart.";
                    setPlaceError(message);
                    setPlacing(false);
                  }
                }}
                aria-disabled={!canPlace || placing}
                className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold shadow-sm ${
                  placing
                    ? "cursor-not-allowed border border-zinc-200 bg-zinc-100 text-zinc-500"
                    : canPlace
                      ? "border border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800"
                      : "border border-zinc-200 bg-zinc-100 text-zinc-500 hover:border-zinc-300"
                }`}
              >
                {placing ? (isEditing ? "Updating..." : "Adding...") : isEditing ? "Update cart item" : "Continue to cart"}
              </button>
            </div>
            {placeError && <p className="mt-2 text-xs text-red-600">{placeError}</p>}
          </div>
        </div>

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
                    ?
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
    </div>
  );
}
