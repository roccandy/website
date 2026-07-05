import type { Category, LabelType } from "@/lib/data";

export type OrderTypeId = "weddings" | "text" | "branded";

export const ORDER_TYPES: { id: OrderTypeId; label: string }[] = [
  { id: "weddings", label: "Weddings" },
  { id: "text", label: "Custom text" },
  { id: "branded", label: "Branded" },
];

export const SHORT_CUSTOM_TEXT_MAX_LENGTH = 6;
export const LONG_CUSTOM_TEXT_MAX_LENGTH = 14;
export const LONG_CUSTOM_TEXT_MAX_SPACES = 2;
export const LONG_CUSTOM_TEXT_MAX_SINGLE_WORD_LENGTH = 10;
export type CustomTextVariant = "short" | "long";

export function countCustomTextLetters(value: string) {
  return value.replace(/\s/g, "").length;
}

export function sanitizeCustomTextInput(value: string, variant: CustomTextVariant) {
  const upper = (value || "").toUpperCase();
  if (variant === "short") return upper.slice(0, SHORT_CUSTOM_TEXT_MAX_LENGTH);

  const normalized = upper.replace(/\s+/g, " ").trimStart();
  const spaceCount = (normalized.match(/ /g) ?? []).length;
  const enforceThreeWordCap = spaceCount >= LONG_CUSTOM_TEXT_MAX_SPACES;
  let letters = 0;
  let spaces = 0;
  let currentWordLetters = 0;
  let next = "";

  for (const char of normalized) {
    if (char === " ") {
      if (spaces >= LONG_CUSTOM_TEXT_MAX_SPACES || next.endsWith(" ")) continue;
      spaces += 1;
      currentWordLetters = 0;
      next += char;
      continue;
    }
    if (letters >= LONG_CUSTOM_TEXT_MAX_LENGTH) continue;
    if (currentWordLetters >= LONG_CUSTOM_TEXT_MAX_SINGLE_WORD_LENGTH) continue;
    if (enforceThreeWordCap && currentWordLetters >= SHORT_CUSTOM_TEXT_MAX_LENGTH) continue;
    letters += 1;
    currentWordLetters += 1;
    next += char;
  }

  return next;
}

export function hasLongCustomTextSingleWordLimitIssue(value: string, variant: CustomTextVariant) {
  if (variant !== "long") return false;
  const normalized = (value || "").toUpperCase().replace(/\s+/g, " ").trimStart();
  return normalized
    .split(" ")
    .filter(Boolean)
    .some((word) => word.length > LONG_CUSTOM_TEXT_MAX_SINGLE_WORD_LENGTH);
}

export function hasLongCustomTextWordLimitIssue(value: string, variant: CustomTextVariant) {
  if (variant !== "long") return false;
  const normalized = (value || "").toUpperCase().replace(/\s+/g, " ").trimStart();
  const spaceCount = (normalized.match(/ /g) ?? []).length;
  if (spaceCount < LONG_CUSTOM_TEXT_MAX_SPACES) return false;
  return normalized
    .split(" ")
    .filter(Boolean)
    .some((word) => word.length > SHORT_CUSTOM_TEXT_MAX_LENGTH);
}

export function isCustomTextValid(value: string, variant: CustomTextVariant) {
  const text = value.trim();
  if (!text) return false;
  if (variant === "short") return text.length <= SHORT_CUSTOM_TEXT_MAX_LENGTH;

  const letters = countCustomTextLetters(text);
  const spaces = (text.match(/\s/g) ?? []).length;
  if (letters > LONG_CUSTOM_TEXT_MAX_LENGTH || spaces > LONG_CUSTOM_TEXT_MAX_SPACES) return false;

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > 3) return false;
  if (words.some((word) => word.length > LONG_CUSTOM_TEXT_MAX_SINGLE_WORD_LENGTH)) return false;
  if (words.length === 3 && words.some((word) => word.length > SHORT_CUSTOM_TEXT_MAX_LENGTH)) return false;
  return true;
}

export const ORDER_SUBTYPES: Record<OrderTypeId, { id: string; label: string }[]> = {
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

export const ORDER_TYPE_TITLES: Record<OrderTypeId, string> = {
  weddings: "Wedding Candy",
  text: "Custom Text Candy",
  branded: "Branded Candy",
};

export const SUBTITLE_BY_CATEGORY: Record<string, string> = {
  "weddings-both-names": "Names & Hearts",
  "weddings-initials": "Initials & Hearts",
  "custom-1-6": "Text: Up to 6 letters",
  "custom-7-14": "Text: 7 - 14 letters",
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
  const heartSplit = safe.split(/\s*(?:\u2665|\u2764\uFE0F?)\s*/);
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
