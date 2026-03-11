import type { PackagingOption } from "@/lib/data";

export const DEFAULT_PACKAGING_TYPES = ["Clear Bag", "Zip Bag", "Jar", "Cone", "Bulk"];

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

function normalizeType(value: string) {
  return value.trim().toLowerCase();
}

function getDefaultTypeIndex(type: string) {
  const normalized = normalizeType(type);
  const index = DEFAULT_PACKAGING_TYPES.findIndex((candidate) => normalizeType(candidate) === normalized);
  return index >= 0 ? index : DEFAULT_PACKAGING_TYPES.length + 100;
}

function getStoredTypeSortOrder(type: string, options: PackagingOption[]) {
  const normalized = normalizeType(type);
  const values = options
    .filter((option) => normalizeType(option.type) === normalized)
    .map((option) => Number(option.type_sort_order))
    .filter((value) => Number.isFinite(value));

  return values.length > 0 ? Math.min(...values) : null;
}

function getEffectiveTypeOrder(type: string, options: PackagingOption[]) {
  const stored = getStoredTypeSortOrder(type, options);
  return stored ?? getDefaultTypeIndex(type);
}

export function comparePackagingTypes(a: string, b: string, options: PackagingOption[]) {
  const aOrder = getEffectiveTypeOrder(a, options);
  const bOrder = getEffectiveTypeOrder(b, options);
  if (aOrder !== bOrder) return aOrder - bOrder;

  const aDefaultIndex = getDefaultTypeIndex(a);
  const bDefaultIndex = getDefaultTypeIndex(b);
  if (aDefaultIndex !== bDefaultIndex) return aDefaultIndex - bDefaultIndex;

  return collator.compare(a, b);
}

export function sortPackagingTypes(types: string[], options: PackagingOption[]) {
  return [...types].sort((a, b) => comparePackagingTypes(a, b, options));
}

export function sortPackagingOptions(options: PackagingOption[]) {
  return [...options].sort((a, b) => {
    const typeCompare = comparePackagingTypes(a.type ?? "", b.type ?? "", options);
    if (typeCompare !== 0) return typeCompare;
    return collator.compare(a.size ?? "", b.size ?? "");
  });
}

export function getPackagingTypeSortOrder(type: string, options: PackagingOption[]) {
  return getEffectiveTypeOrder(type, options);
}
