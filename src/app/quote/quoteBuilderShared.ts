import type { Category, LabelType } from "@/lib/data";

export type OrderTypeId = "weddings" | "text" | "branded";

export const ORDER_TYPES: { id: OrderTypeId; label: string }[] = [
  { id: "weddings", label: "Weddings" },
  { id: "text", label: "Custom text" },
  { id: "branded", label: "Branded" },
];

export const SHORT_CUSTOM_TEXT_MAX_LENGTH = 6;
export const LONG_CUSTOM_TEXT_MAX_LENGTH = 15;

export const ORDER_SUBTYPES: Record<OrderTypeId, { id: string; label: string }[]> = {
  weddings: [
    { id: "weddings-initials", label: "Initials" },
    { id: "weddings-both-names", label: "Both names" },
  ],
  text: [
    { id: "custom-1-6", label: "1-6 letters" },
    { id: "custom-7-14", label: "15 characters max" },
  ],
  branded: [{ id: "branded", label: "Branded" }],
};

export const ORDER_TYPE_TITLES: Record<OrderTypeId, string> = {
  weddings: "Wedding Candy",
  text: "Custom Text Candy",
  branded: "Branded Candy",
};

export const SUBTITLE_BY_CATEGORY: Record<string, string> = {
  "weddings-both-names": "Names & Hearts",
  "weddings-initials": "Initials & Hearts",
  "custom-1-6": "Text: Up to 6 letters",
  "custom-7-14": "Text: 15 characters max",
  branded: "Logo Branded Candy",
};

const PACKAGING_IMAGE_BUCKET = "packaging-images";

const LABEL_SHAPE_LABELS: Record<LabelType["shape"], string> = {
  square: "Square",
  rectangular: "Rectangular",
  circle: "Circle",
};

export function inferOrderTypeFromCategory(value?: string | null): OrderTypeId | undefined {
  if (!value) return undefined;
  if (value === "weddings" || value.startsWith("weddings-")) return "weddings";
  if (value === "text" || value.startsWith("custom-")) return "text";
  if (value === "branded") return "branded";
  return undefined;
}

export function splitWeddingDesign(value?: string | null) {
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

export function resolveInitialDesignerSelection(input: {
  initialOrderType?: OrderTypeId;
  queryOrderType?: OrderTypeId;
  querySubtype?: string | null;
  categories: Category[];
}) {
  const resolvedInitialOrderType =
    ORDER_TYPES.find((type) => type.id === input.initialOrderType)?.id ?? ORDER_TYPES[0]?.id ?? "weddings";
  const initialOrderTypeResolved = input.queryOrderType ?? resolvedInitialOrderType;
  const hasExplicitOrderType = Boolean(input.queryOrderType || input.initialOrderType);
  const initialSubtype = (() => {
    if (input.querySubtype) return input.querySubtype;
    if (initialOrderTypeResolved === "branded") {
      return ORDER_SUBTYPES.branded[0]?.id ?? "branded";
    }
    if (hasExplicitOrderType) return "";
    return ORDER_SUBTYPES[initialOrderTypeResolved]?.[0]?.id ?? input.categories[0]?.id ?? "";
  })();

  return {
    initialOrderTypeResolved,
    initialSubtype,
  };
}

export function resolveSyncedDesignerSelection(input: {
  orderType: OrderTypeId;
  categoryId: string;
  queryOrderType?: OrderTypeId;
  querySubtype?: string | null;
  initialOrderType?: OrderTypeId;
  urlOrderType?: OrderTypeId;
  hasManualSubtype: boolean;
}) {
  const nextOrderType = input.queryOrderType ?? input.initialOrderType ?? input.urlOrderType;
  if (!nextOrderType) return null;

  const validQuerySubtype =
    input.querySubtype && ORDER_SUBTYPES[nextOrderType]?.some((sub) => sub.id === input.querySubtype)
      ? input.querySubtype
      : undefined;
  const isValidSubtype = ORDER_SUBTYPES[nextOrderType]?.some((sub) => sub.id === input.categoryId);
  const allowQuerySubtype = !input.hasManualSubtype;
  const hasExplicitOrderType = Boolean(input.queryOrderType || input.initialOrderType || input.urlOrderType);
  const shouldRequireSubtypeSelection =
    hasExplicitOrderType && !validQuerySubtype && nextOrderType !== "branded" && !input.hasManualSubtype;

  let nextSubtype = input.categoryId;
  if (allowQuerySubtype && validQuerySubtype) {
    nextSubtype = validQuerySubtype;
  } else if (shouldRequireSubtypeSelection) {
    nextSubtype = "";
  } else if (nextOrderType === "branded") {
    nextSubtype = ORDER_SUBTYPES.branded[0]?.id ?? "branded";
  } else if (!isValidSubtype) {
    nextSubtype = ORDER_SUBTYPES[nextOrderType]?.[0]?.id ?? "";
  }

  return {
    nextOrderType,
    nextSubtype,
  };
}

export function buildPublicImageUrl(imagePath: string | null | undefined) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base || !imagePath) return "";
  const encoded = encodeURIComponent(imagePath);
  return `${base}/storage/v1/object/public/${PACKAGING_IMAGE_BUCKET}/${encoded}`;
}

export function formatLabelTypeLabel(labelType: LabelType) {
  const shape = LABEL_SHAPE_LABELS[labelType.shape] ?? labelType.shape;
  const dimension = (labelType.dimensions || "").trim();
  return dimension ? `${shape} ${dimension}` : shape;
}

export function toTitleCase(value: string) {
  return value.replace(/\w\S*/g, (part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase());
}
