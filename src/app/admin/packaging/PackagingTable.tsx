"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Category, LabelType, PackagingOption, PackagingOptionImage } from "@/lib/data";
import {
  comparePackagingTypes,
  getPackagingTypeSortOrder,
  sortPackagingOptions,
  sortPackagingTypes,
} from "@/lib/packaging";
import { deletePackaging, updatePackagingTypeOrder, upsertPackaging, uploadPackagingImage } from "./actions";

type Props = {
  options: PackagingOption[];
  categories: Category[];
  images: PackagingOptionImage[];
  maxTotalKg: number;
  labelTypes: LabelType[];
};

type ComboSortKey = "key" | "category" | "type" | "size" | "lid" | "image";
type SortDirection = "asc" | "desc";

function toCategoryString(arr: string[]) {
  return arr.join(", ");
}

const LID_OPTIONS = ["black", "silver", "gold"] as const;
const DEFAULT_TYPES = ["Clear Bag", "Zip Bag", "Jar", "Cone", "Bulk"];
const PACKAGING_IMAGE_BUCKET = "packaging-images";
const LABEL_SHAPES: Array<{ value: LabelType["shape"]; label: string }> = [
  { value: "square", label: "Square" },
  { value: "rectangular", label: "Rectangular" },
  { value: "circle", label: "Circle" },
];
const ORDER_IMAGE_PREFIX: Record<string, string> = {
  "weddings-initials": "initials",
  "weddings-both-names": "names",
  "custom-1-6": "text1-6",
  "custom-7-14": "text7-14",
  branded: "branded",
};
const PACKAGING_TYPE_OVERRIDES: Record<string, string> = {
  "clear bag": "bags",
  "zip bag": "zip-bags",
  jar: "jars",
  cone: "cones",
  bulk: "bulk",
};

function normalizeToken(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
}

function toDomId(value: string) {
  return value.replace(/[^a-z0-9-_]+/gi, "-");
}

function buildPublicImageUrl(imagePath?: string | null) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base || !imagePath) return "";
  const encoded = encodeURIComponent(imagePath);
  return `${base}/storage/v1/object/public/${PACKAGING_IMAGE_BUCKET}/${encoded}`;
}

function resolveOrderPrefix(categoryId: string) {
  const mapped = ORDER_IMAGE_PREFIX[categoryId];
  return mapped ? normalizeToken(mapped) : normalizeToken(categoryId);
}

function resolvePackagingTypeSlug(type: string) {
  const raw = type.trim().toLowerCase();
  const mapped = PACKAGING_TYPE_OVERRIDES[raw];
  return mapped ? normalizeToken(mapped) : normalizeToken(raw);
}

function resolvePackagingSizeSlug(typeSlug: string, size: string) {
  if (!typeSlug || typeSlug === "bulk") return "";
  const normalized = size.trim().toLowerCase();
  if (typeSlug === "jars") {
    const first = normalized.split(" ")[0] ?? "";
    return normalizeToken(first);
  }
  const cleaned = normalized.replace(/pc/g, "").replace(/\s+/g, "");
  return normalizeToken(cleaned);
}

function formatSizeLabel(type: string, size: string) {
  if (!type.toLowerCase().includes("jar")) return size;
  const trimmed = size.trim();
  if (!trimmed) return size;
  const withoutGrams = trimmed.replace(/\s*\(?\d+\s*g\)?$/i, "");
  return withoutGrams || trimmed;
}

function formatLabelType(type: Pick<LabelType, "shape" | "dimensions">) {
  const shapeLabel = LABEL_SHAPES.find((shape) => shape.value === type.shape)?.label ?? type.shape;
  const dimension = (type.dimensions || "").trim();
  return dimension ? `${shapeLabel} ${dimension}` : shapeLabel;
}

function buildComboKey(type: string, size: string, categoryId: string, lidColor: string) {
  const orderPrefix = resolveOrderPrefix(categoryId);
  const typeSlug = resolvePackagingTypeSlug(type);
  const sizeSlug = resolvePackagingSizeSlug(typeSlug, size);
  const lidSlug = lidColor ? normalizeToken(lidColor) : "";
  const parts = [orderPrefix, typeSlug, sizeSlug, lidSlug].filter(Boolean);
  return parts.join("_");
}

export function PackagingTable({ options, categories, images, maxTotalKg, labelTypes }: Props) {
  const [editMode, setEditMode] = useState(false);
  const [comboSort, setComboSort] = useState<{ key: ComboSortKey; direction: SortDirection } | null>(null);
  const [orderedTypes, setOrderedTypes] = useState<string[]>([]);
  const [draggedType, setDraggedType] = useState<string | null>(null);
  const [dragTargetType, setDragTargetType] = useState<string | null>(null);
  const [allowedSelections, setAllowedSelections] = useState<Record<string, string[]>>({});
  const [newAllowed, setNewAllowed] = useState<string[]>([]);
  const [lidSelections, setLidSelections] = useState<Record<string, string[]>>({});
  const [newLids, setNewLids] = useState<string[]>([]);
  const [labelSelections, setLabelSelections] = useState<Record<string, string[]>>({});
  const [newLabelSelections, setNewLabelSelections] = useState<string[]>([]);
  const [typeValues, setTypeValues] = useState<Record<string, string>>({});
  const [sizeValues, setSizeValues] = useState<Record<string, string>>({});
  const [customTypeMode, setCustomTypeMode] = useState<Record<string, boolean>>({});
  const [customSizeMode, setCustomSizeMode] = useState<Record<string, boolean>>({});
  const [newTypeValue, setNewTypeValue] = useState("");
  const [newSizeValue, setNewSizeValue] = useState("");
  const [newTypeCustom, setNewTypeCustom] = useState(false);
  const [newSizeCustom, setNewSizeCustom] = useState(false);
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [focusMaxPackagesId, setFocusMaxPackagesId] = useState<string | null>(null);
  const hasDirty = dirtyIds.size > 0;
  const uniqueTypesFromOptions = useMemo(
    () => sortPackagingTypes(Array.from(new Set(options.map((opt) => opt.type).filter(Boolean))), options),
    [options]
  );
  const hasTypeOrderChanges = orderedTypes.join("|||") !== uniqueTypesFromOptions.join("|||");
  const typeOptions = useMemo(() => {
    const unique = new Set<string>(DEFAULT_TYPES);
    options.forEach((opt) => {
      if (opt.type) unique.add(opt.type);
    });
    return sortPackagingTypes(Array.from(unique), options);
  }, [options]);
  const sizeOptionsByType = useMemo(() => {
    const map = new Map<string, string[]>();
    options.forEach((opt) => {
      const type = opt.type;
      if (!type) return;
      const list = map.get(type) ?? [];
      if (!list.includes(opt.size)) {
        list.push(opt.size);
      }
      map.set(type, list);
    });
    return map;
  }, [options]);
  const labelTypeById = useMemo(() => {
    const map = new Map<string, LabelType>();
    labelTypes.forEach((labelType) => map.set(labelType.id, labelType));
    return map;
  }, [labelTypes]);
  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((cat) => map.set(cat.id, cat.name));
    return map;
  }, [categories]);
  const imageMap = useMemo(() => {
    const map = new Map<string, PackagingOptionImage>();
    images.forEach((image) => {
      const key = `${image.packaging_option_id}::${image.category_id}::${image.lid_color}`;
      map.set(key, image);
    });
    return map;
  }, [images]);
  const sortedOptions = useMemo(() => sortPackagingOptions(options), [options]);
  const typeSortOrderByType = useMemo(() => {
    const map = new Map<string, number>();
    orderedTypes.forEach((type, index) => map.set(type, index));
    return map;
  }, [orderedTypes]);
  const comboRows = useMemo(() => {
    const rows = options.flatMap((opt) => {
      const isJar = opt.type.toLowerCase().includes("jar");
      const lidColors = isJar ? (opt.lid_colors ?? []) : [""];
      return opt.allowed_categories.flatMap((categoryId) =>
        lidColors.map((lidColor) => ({
          key: `${opt.id}::${categoryId}::${lidColor}`,
          packagingOption: opt,
          categoryId,
          lidColor,
          comboKey: buildComboKey(opt.type, opt.size, categoryId, lidColor),
        }))
      );
    });
    return rows.sort((a, b) => {
      const catA = (categoryNameById.get(a.categoryId) ?? a.categoryId).toLowerCase();
      const catB = (categoryNameById.get(b.categoryId) ?? b.categoryId).toLowerCase();
      if (catA !== catB) return catA.localeCompare(catB);
      const typeCompare = comparePackagingTypes(a.packagingOption.type, b.packagingOption.type, options);
      if (typeCompare !== 0) return typeCompare;
      const sizeA = a.packagingOption.size.toLowerCase();
      const sizeB = b.packagingOption.size.toLowerCase();
      if (sizeA !== sizeB) return sizeA.localeCompare(sizeB);
      return (a.lidColor || "").toLowerCase().localeCompare((b.lidColor || "").toLowerCase());
    });
  }, [categoryNameById, options]);
  const sortedComboRows = useMemo(() => {
    if (!comboSort) return comboRows;
    const direction = comboSort.direction === "asc" ? 1 : -1;
    const resolveValue = (row: (typeof comboRows)[number]) => {
      switch (comboSort.key) {
        case "key":
          return row.comboKey;
        case "category":
          return categoryNameById.get(row.categoryId) ?? row.categoryId;
        case "type":
          return row.packagingOption.type;
        case "size":
          return formatSizeLabel(row.packagingOption.type, row.packagingOption.size);
        case "lid":
          return row.lidColor || "";
        case "image":
          return imageMap.get(row.key)?.image_path ?? "";
        default:
          return "";
      }
    };
    return [...comboRows].sort((a, b) => {
      const aValue = resolveValue(a).toLowerCase();
      const bValue = resolveValue(b).toLowerCase();
      if (aValue !== bValue) return aValue.localeCompare(bValue) * direction;
      return a.comboKey.toLowerCase().localeCompare(b.comboKey.toLowerCase());
    });
  }, [categoryNameById, comboRows, comboSort, imageMap]);
  const missingCombos = useMemo(
    () => comboRows.filter((row) => !imageMap.get(row.key)?.image_path),
    [comboRows, imageMap]
  );
  const missingComboList = useMemo(() => {
    return missingCombos
      .map((row) => {
        const categoryName = categoryNameById.get(row.categoryId) ?? row.categoryId;
        const sizeLabel = formatSizeLabel(row.packagingOption.type, row.packagingOption.size);
        const lidLabel = row.lidColor ? ` - Lids: ${row.lidColor}` : "";
        const sizeValue = sizeLabel || row.packagingOption.size || "-";
        return {
          key: row.key,
          label: `${row.packagingOption.type} - ${categoryName} - ${sizeValue}${lidLabel}`,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [categoryNameById, missingCombos]);
  const originalMap = useMemo(() => {
    const map = new Map<string, PackagingOption>();
    options.forEach((o) => map.set(o.id, o));
    return map;
  }, [options]);

  useEffect(() => {
    const initial: Record<string, string[]> = {};
    const initialLids: Record<string, string[]> = {};
    const initialLabels: Record<string, string[]> = {};
    const initialTypes: Record<string, string> = {};
    const initialSizes: Record<string, string> = {};
    const initialTypeCustom: Record<string, boolean> = {};
    const initialSizeCustom: Record<string, boolean> = {};
    options.forEach((opt) => {
      initial[opt.id] = opt.allowed_categories;
      initialLids[opt.id] = opt.lid_colors ?? [];
      initialLabels[opt.id] = opt.label_type_ids ?? [];
      initialTypes[opt.id] = opt.type;
      initialSizes[opt.id] = opt.size;
      initialTypeCustom[opt.id] = !typeOptions.includes(opt.type);
      const sizesForType = sizeOptionsByType.get(opt.type) ?? [];
      initialSizeCustom[opt.id] = sizesForType.length === 0 || !sizesForType.includes(opt.size);
    });
    // Reset selections when options refresh.
    setAllowedSelections(initial);
    setLidSelections(initialLids);
    setLabelSelections(initialLabels);
    setNewAllowed([]);
    setNewLids([]);
    setNewLabelSelections([]);
    setTypeValues(initialTypes);
    setSizeValues(initialSizes);
    setCustomTypeMode(initialTypeCustom);
    setCustomSizeMode(initialSizeCustom);
    setNewTypeValue("");
    setNewSizeValue("");
    setNewTypeCustom(false);
    setNewSizeCustom(false);
    setDirtyIds(new Set());
  }, [options, sizeOptionsByType, typeOptions]);

  useEffect(() => {
    setOrderedTypes(uniqueTypesFromOptions);
  }, [uniqueTypesFromOptions]);

  useEffect(() => {
    if (!editMode || !focusMaxPackagesId) return;
    const input = document.getElementById(`max-packages-${focusMaxPackagesId}`) as HTMLInputElement | null;
    if (!input) return;
    input.focus();
    input.select();
    setFocusMaxPackagesId(null);
  }, [editMode, focusMaxPackagesId]);

  const markDirty = (id: string) => {
    setDirtyIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const toggleAllowed = (id: string, catId: string) => {
    setAllowedSelections((prev) => {
      const current = prev[id] ?? [];
      const exists = current.includes(catId);
      const next = exists ? current.filter((c) => c !== catId) : [...current, catId];
      return { ...prev, [id]: next };
    });
    markDirty(id);
  };

  const toggleLidColor = (id: string, color: string) => {
    setLidSelections((prev) => {
      const current = prev[id] ?? [];
      const exists = current.includes(color);
      const next = exists ? current.filter((c) => c !== color) : [...current, color];
      return { ...prev, [id]: next };
    });
    markDirty(id);
  };

  const toggleLabelType = (id: string, labelId: string) => {
    setLabelSelections((prev) => {
      const current = prev[id] ?? [];
      const exists = current.includes(labelId);
      const next = exists ? current.filter((c) => c !== labelId) : [...current, labelId];
      return { ...prev, [id]: next };
    });
    markDirty(id);
  };

  const sameList = (a: string[], b: string[]) =>
    a.length === b.length && a.every((value) => b.includes(value));

  const recomputeDirty = () => {
    const next = new Set<string>();
    options.forEach((opt) => {
      const form = document.getElementById(`pack-${opt.id}`) as HTMLFormElement | null;
      if (!form) return;
      const type = typeValues[opt.id] ?? opt.type ?? "";
      const size = sizeValues[opt.id] ?? opt.size ?? "";
      const candy_weight_g = Number(
        (form.elements.namedItem("candy_weight_g") as HTMLInputElement | null)?.value ?? 0
      );
      const unit_price = Number(
        (form.elements.namedItem("unit_price") as HTMLInputElement | null)?.value ?? 0
      );
      const max_packages = Number(
        (form.elements.namedItem("max_packages") as HTMLInputElement | null)?.value ?? 0
      );
      const allowed_categories = allowedSelections[opt.id] ?? [];
      const lid_colors = lidSelections[opt.id] ?? [];
      const label_type_ids = labelSelections[opt.id] ?? [];
      const original = originalMap.get(opt.id);
      const allowedSame =
        original &&
        allowed_categories.length === original.allowed_categories.length &&
        allowed_categories.every((c) => original.allowed_categories.includes(c));
      const lidSame = original ? sameList(lid_colors, original.lid_colors ?? []) : false;
      const labelSame = original ? sameList(label_type_ids, original.label_type_ids ?? []) : false;
      const isSame =
        original &&
        original.type === type &&
        original.size === size &&
        Number(original.candy_weight_g) === candy_weight_g &&
        Number(original.unit_price) === unit_price &&
        Number(original.max_packages) === max_packages &&
        allowedSame &&
        lidSame &&
        labelSame;
      if (!isSame) next.add(opt.id);
    });
    // Handle new row: if any field filled or any allowed selected, mark dirty
    const newForm = document.getElementById("pack-new") as HTMLFormElement | null;
    if (newForm) {
      const type = newTypeValue;
      const size = newSizeValue;
      const candy = (newForm.elements.namedItem("candy_weight_g") as HTMLInputElement | null)?.value ?? "";
      const unit = (newForm.elements.namedItem("unit_price") as HTMLInputElement | null)?.value ?? "";
      const max = (newForm.elements.namedItem("max_packages") as HTMLInputElement | null)?.value ?? "";
      const hasAllowed = newAllowed.length > 0;
      const hasLids = newLids.length > 0;
      const hasLabels = newLabelSelections.length > 0;
      const anyField = [type, size, candy, unit, max].some((v) => v !== "");
      if (anyField || hasAllowed || hasLids || hasLabels) next.add("new");
      else next.delete("new");
    }
    setDirtyIds(next);
  };

  useEffect(() => {
    if (!editMode) return;
    recomputeDirty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    allowedSelections,
    lidSelections,
    labelSelections,
    typeValues,
    sizeValues,
    newAllowed,
    newLids,
    newLabelSelections,
    newTypeValue,
    newSizeValue,
    editMode,
  ]);

  const handleSaveAll = () => {
    document.querySelectorAll<HTMLFormElement>("form[data-pack-form]").forEach((f) => {
      const id = f.dataset.id;
      const isNew = f.dataset.new === "true";
      if (isNew ? dirtyIds.has("new") : id && dirtyIds.has(id)) {
        f.requestSubmit();
      }
    });
    setDirtyIds(new Set());
    try {
      const evt = new CustomEvent("toast", { detail: { message: "Packaging saved", tone: "success" } });
      window.dispatchEvent(evt);
    } catch {
      // no-op
    }
  };

  const handleComboSort = (key: ComboSortKey) => {
    setComboSort((prev) => {
      if (!prev || prev.key !== key) {
        return { key, direction: "asc" };
      }
      return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
    });
  };

  const sortLabel = (key: ComboSortKey) => {
    if (!comboSort || comboSort.key !== key) return null;
    return comboSort.direction === "asc" ? "asc" : "desc";
  };

  const ariaSort = (key: ComboSortKey) => {
    if (!comboSort || comboSort.key !== key) return "none";
    return comboSort.direction === "asc" ? "ascending" : "descending";
  };

  const formatKg = (value: number) => {
    if (!Number.isFinite(value)) return "-";
    const rounded = Math.round(value * 100) / 100;
    return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(2)} Kg`;
  };

  const moveType = (sourceType: string, targetType: string) => {
    if (!sourceType || !targetType || sourceType === targetType) return;
    setOrderedTypes((prev) => {
      const next = [...prev];
      const sourceIndex = next.indexOf(sourceType);
      const targetIndex = next.indexOf(targetType);
      if (sourceIndex < 0 || targetIndex < 0) return prev;
      next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, sourceType);
      return next;
    });
  };

  return (
    <>
      {missingCombos.length > 0 && (
        <details className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <summary className="cursor-pointer font-semibold">
            {missingCombos.length} image combination
            {missingCombos.length === 1 ? "" : "s"} missing image
            {missingCombos.length === 1 ? "" : "s"}
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-red-700">
            {missingComboList.map((item) => (
              <li key={item.key}>{item.label}</li>
            ))}
          </ul>
        </details>
      )}
      <div className="flex gap-2">
        {!editMode && (
          <button
            type="button"
            onClick={() => setEditMode(true)}
            className="inline-flex items-center rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800"
          >
            Edit
          </button>
        )}
        {editMode && (
          <>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={!hasDirty}
              className={`inline-flex items-center rounded-md px-3 py-1.5 text-xs font-semibold ${
                hasDirty
                  ? "bg-zinc-900 text-white hover:bg-zinc-800"
                  : "bg-zinc-100 text-zinc-500"
              }`}
            >
              Save all
            </button>
            <button
              type="button"
              onClick={() => setEditMode(false)}
              className="inline-flex items-center rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:border-zinc-400"
            >
              Done (view only)
            </button>
          </>
        )}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Website package type order</p>
            <h3 className="text-lg font-semibold text-zinc-900">Packaging types</h3>
            <p className="text-sm text-zinc-600">
              These are the unique package types shown on the design page. Drag them into the order you want customers
              to see.
            </p>
          </div>
          <form action={updatePackagingTypeOrder} className="shrink-0">
            <input type="hidden" name="ordered_types" value={JSON.stringify(orderedTypes)} readOnly />
            <button
              type="submit"
              disabled={!hasTypeOrderChanges}
              className={`inline-flex items-center rounded-md px-3 py-2 text-xs font-semibold ${
                hasTypeOrderChanges
                  ? "bg-zinc-900 text-white hover:bg-zinc-800"
                  : "bg-zinc-100 text-zinc-500"
              }`}
            >
              Save type order
            </button>
          </form>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {orderedTypes.map((type, index) => {
            const isDragged = draggedType === type;
            const isTarget = dragTargetType === type && draggedType !== type;
            return (
              <div
                key={type}
                draggable
                onDragStart={() => {
                  setDraggedType(type);
                  setDragTargetType(type);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (draggedType && draggedType !== type) {
                    setDragTargetType(type);
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (draggedType) {
                    moveType(draggedType, type);
                  }
                  setDraggedType(null);
                  setDragTargetType(null);
                }}
                onDragEnd={() => {
                  setDraggedType(null);
                  setDragTargetType(null);
                }}
                className={`rounded-xl border px-3 py-3 transition ${
                  isDragged
                    ? "border-zinc-900 bg-zinc-100 shadow-sm"
                    : isTarget
                      ? "border-zinc-500 bg-zinc-50"
                      : "border-zinc-200 bg-zinc-50/70"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Position {index + 1}</p>
                    <p className="text-sm font-semibold text-zinc-900">{type}</p>
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Drag</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-sm break-words">
            <thead>
              <tr className="text-left text-zinc-500">
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Candy weight (g)</th>
                <th className="px-2 py-2">Allowed categories</th>
                <th className="px-2 py-2">Labels</th>
                <th className="px-2 py-2">Jar lid colours</th>
                <th className="px-2 py-2">Unit price</th>
                <th className="px-2 py-2">Max packages</th>
                <th className="px-2 py-2 text-center">Weight check</th>
              </tr>
            </thead>
            <tbody>
              {sortedOptions.map((opt) => {
                const formId = `pack-${opt.id}`;
                const typeValue = typeValues[opt.id] ?? opt.type ?? "";
                const sizeValue = sizeValues[opt.id] ?? opt.size ?? "";
                const typeIsCustom = customTypeMode[opt.id] ?? !typeOptions.includes(typeValue);
                const sizeOptions = sizeOptionsByType.get(typeValue) ?? [];
                const sizeIsCustom =
                  customSizeMode[opt.id] ?? (sizeOptions.length === 0 || !sizeOptions.includes(sizeValue));
                const isJarType = typeValue.toLowerCase().includes("jar");
                const maxKg = Number(maxTotalKg);
                const weightLimitKg = (Number(opt.candy_weight_g) * Number(opt.max_packages)) / 1000;
                const isWithinLimit = Number.isFinite(maxKg) && maxKg > 0 ? weightLimitKg <= maxKg : true;
                const isLowUtilization =
                  Number.isFinite(maxKg) && maxKg > 0 ? weightLimitKg < maxKg * 0.9 : false;
                const maxPackagesInputId = `max-packages-${opt.id}`;
                const selectedLabelIds = editMode
                  ? labelSelections[opt.id] ?? []
                  : opt.label_type_ids ?? [];
                const selectedLabelLabels = selectedLabelIds
                  .map((labelId) => {
                    const labelType = labelTypeById.get(labelId);
                    return labelType ? formatLabelType(labelType) : labelId;
                  })
                  .filter(Boolean);
                const handleMaxPackagesEdit = () => {
                  if (!editMode) setEditMode(true);
                  setFocusMaxPackagesId(opt.id);
                };
                return (
                  <tr key={opt.id} className={`border-t border-zinc-100 ${editMode ? "relative" : ""}`}>
                    <td className="px-2 py-2 align-top whitespace-normal">
                      {editMode ? (
                        <div className="space-y-3">
                          <div className="space-y-1">
                            {!typeIsCustom ? (
                              <select
                                value={typeValue}
                                onChange={(event) => {
                                  const next = event.target.value;
                                  if (next === "__custom__") {
                                    setCustomTypeMode((prev) => ({ ...prev, [opt.id]: true }));
                                    setTypeValues((prev) => ({ ...prev, [opt.id]: "" }));
                                    return;
                                  }
                                  setCustomTypeMode((prev) => ({ ...prev, [opt.id]: false }));
                                  setTypeValues((prev) => ({ ...prev, [opt.id]: next }));
                                  const sizesForType = sizeOptionsByType.get(next) ?? [];
                                  if (sizesForType.length > 0 && !sizesForType.includes(sizeValue)) {
                                    setSizeValues((prev) => ({ ...prev, [opt.id]: sizesForType[0] }));
                                    setCustomSizeMode((prev) => ({ ...prev, [opt.id]: false }));
                                  }
                                  if (!next.toLowerCase().includes("jar")) {
                                    setLidSelections((prev) => ({ ...prev, [opt.id]: [] }));
                                  }
                                }}
                                className="w-full rounded border border-zinc-200 px-2 py-1"
                              >
                                {typeOptions.map((type) => (
                                  <option key={type} value={type}>
                                    {type}
                                  </option>
                                ))}
                                <option value="__custom__">Custom...</option>
                              </select>
                            ) : (
                              <div className="space-y-1">
                                <input
                                  type="text"
                                  value={typeValue}
                                  onChange={(event) => {
                                    const next = event.target.value;
                                    setTypeValues((prev) => ({ ...prev, [opt.id]: next }));
                                    if (!next.toLowerCase().includes("jar")) {
                                      setLidSelections((prev) => ({ ...prev, [opt.id]: [] }));
                                    }
                                  }}
                                  className="w-full rounded border border-zinc-200 px-2 py-1"
                                  placeholder="Type"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCustomTypeMode((prev) => ({ ...prev, [opt.id]: false }));
                                    const fallback = opt.type || typeOptions[0] || "";
                                    setTypeValues((prev) => ({ ...prev, [opt.id]: fallback }));
                                  }}
                                  className="text-[11px] font-semibold text-zinc-500 underline"
                                >
                                  Use dropdown
                                </button>
                              </div>
                            )}
                            <input form={formId} type="hidden" name="type" value={typeValue} readOnly />
                          </div>
                          <div className="space-y-1">
                            {!sizeIsCustom ? (
                              <select
                                value={sizeValue}
                                onChange={(event) => {
                                  const next = event.target.value;
                                  if (next === "__custom__") {
                                    setCustomSizeMode((prev) => ({ ...prev, [opt.id]: true }));
                                    setSizeValues((prev) => ({ ...prev, [opt.id]: "" }));
                                    return;
                                  }
                                  setCustomSizeMode((prev) => ({ ...prev, [opt.id]: false }));
                                  setSizeValues((prev) => ({ ...prev, [opt.id]: next }));
                                }}
                                className="w-full rounded border border-zinc-200 px-2 py-1"
                              >
                                {sizeOptions.map((size) => (
                                  <option key={size} value={size}>
                                    {formatSizeLabel(typeValue, size)}
                                  </option>
                                ))}
                                <option value="__custom__">Custom...</option>
                              </select>
                            ) : (
                              <div className="space-y-1">
                                <input
                                  type="text"
                                  value={sizeValue}
                                  onChange={(event) =>
                                    setSizeValues((prev) => ({ ...prev, [opt.id]: event.target.value }))
                                  }
                                  className="w-full rounded border border-zinc-200 px-2 py-1"
                                  placeholder="Size"
                                />
                                {sizeOptions.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCustomSizeMode((prev) => ({ ...prev, [opt.id]: false }));
                                      setSizeValues((prev) => ({ ...prev, [opt.id]: sizeOptions[0] ?? "" }));
                                    }}
                                    className="text-[11px] font-semibold text-zinc-500 underline"
                                  >
                                    Use dropdown
                                  </button>
                                )}
                              </div>
                            )}
                            <input form={formId} type="hidden" name="size" value={sizeValue} readOnly />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="font-semibold text-zinc-900">{typeValue || "-"}</div>
                          <div className="text-xs text-zinc-500">
                            {formatSizeLabel(typeValue, sizeValue) || "-"}
                          </div>
                        </div>
                      )}
                      {editMode && (
                        <>
                          <form
                            id={formId}
                            data-pack-form
                            data-id={opt.id}
                            data-new="false"
                            action={upsertPackaging}
                            className="hidden"
                          >
                            <input type="hidden" name="id" value={opt.id} />
                            <input
                              type="hidden"
                              name="type_sort_order"
                              value={typeSortOrderByType.get(typeValue) ?? getPackagingTypeSortOrder(typeValue, options) ?? 0}
                              readOnly
                            />
                          </form>
                          <form action={deletePackaging} className="absolute right-2 top-2">
                            <input type="hidden" name="id" value={opt.id} />
                            <button
                              type="submit"
                              aria-label="Delete"
                              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-red-500 hover:bg-red-50 hover:text-red-700"
                            >
                              ×
                            </button>
                          </form>
                        </>
                      )}
                    </td>
                    <td className="px-2 py-2 align-middle whitespace-normal">
                      {editMode ? (
                        <input
                          form={formId}
                          type="number"
                          step="0.1"
                          name="candy_weight_g"
                          defaultValue={opt.candy_weight_g}
                          className="w-full rounded border border-zinc-200 px-2 py-1"
                          onChange={() => recomputeDirty()}
                        />
                      ) : (
                        opt.candy_weight_g
                      )}
                    </td>
                    <td className="px-2 py-2 align-middle whitespace-normal">
                      {editMode ? (
                        <div className="space-y-1 rounded border border-zinc-200 p-2">
                          <input
                            form={formId}
                            type="hidden"
                            name="allowed_categories"
                          value={(allowedSelections[opt.id] ?? []).join(",")}
                          readOnly
                        />
                          <div className="flex flex-wrap gap-2 text-xs text-zinc-700">
                            {categories.map((cat) => {
                              const checked = (allowedSelections[opt.id] ?? []).includes(cat.id);
                              return (
                                <label key={cat.id} className="inline-flex items-center gap-1 rounded border border-zinc-200 px-2 py-1 hover:bg-zinc-50">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                  onChange={() => toggleAllowed(opt.id, cat.id)}
                                    className="rounded border-zinc-300"
                                  />
                                  {cat.name}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <span className="text-zinc-600">{toCategoryString(opt.allowed_categories)}</span>
                      )}
                    </td>
                    <td className="px-2 py-2 align-middle whitespace-normal">
                      {editMode ? (
                        <div className="space-y-1 rounded border border-zinc-200 p-2">
                          <input
                            form={formId}
                            type="hidden"
                            name="label_type_ids"
                            value={(labelSelections[opt.id] ?? []).join(",")}
                            readOnly
                          />
                          {labelTypes.length > 0 ? (
                            <div className="flex flex-wrap gap-2 text-xs text-zinc-700">
                              {labelTypes.map((labelType) => {
                                const checked = (labelSelections[opt.id] ?? []).includes(labelType.id);
                                return (
                                  <label
                                    key={labelType.id}
                                    className="inline-flex items-center gap-1 rounded border border-zinc-200 px-2 py-1 hover:bg-zinc-50"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleLabelType(opt.id, labelType.id)}
                                      className="rounded border-zinc-300"
                                    />
                                    {formatLabelType(labelType)}
                                  </label>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-zinc-400">Add label types in Packaging &gt; Labels</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-600">
                          {selectedLabelLabels.length > 0 ? selectedLabelLabels.join(", ") : "-"}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 align-middle whitespace-normal">
                      {editMode ? (
                        <div className="space-y-1 rounded border border-zinc-200 p-2">
                          <input
                            form={formId}
                            type="hidden"
                            name="lid_colors"
                            value={(isJarType ? lidSelections[opt.id] ?? [] : []).join(",")}
                            readOnly
                          />
                          {isJarType ? (
                            <div className="flex flex-wrap gap-2 text-xs text-zinc-700">
                              {LID_OPTIONS.map((color) => {
                                const checked = (lidSelections[opt.id] ?? []).includes(color);
                                return (
                                  <label
                                    key={color}
                                    className="inline-flex items-center gap-1 rounded border border-zinc-200 px-2 py-1 hover:bg-zinc-50"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleLidColor(opt.id, color)}
                                      className="rounded border-zinc-300"
                                    />
                                    {color}
                                  </label>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-zinc-400">Jar only</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-600">
                          {isJarType
                            ? (opt.lid_colors ?? []).length > 0
                              ? (opt.lid_colors ?? []).join(", ")
                              : "-"
                            : "-"}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 align-middle whitespace-normal">
                      {editMode ? (
                        <input
                          form={formId}
                          type="number"
                          step="0.01"
                          name="unit_price"
                          defaultValue={opt.unit_price}
                          className="w-full rounded border border-zinc-200 px-2 py-1"
                          onChange={() => recomputeDirty()}
                        />
                      ) : (
                        <>${opt.unit_price.toFixed(2)}</>
                      )}
                    </td>
                    <td className="px-2 py-2 align-middle whitespace-normal">
                      {editMode ? (
                        <input
                          form={formId}
                          type="number"
                          id={maxPackagesInputId}
                          name="max_packages"
                          defaultValue={opt.max_packages}
                          className="w-full rounded border border-zinc-200 px-2 py-1"
                          onChange={() => recomputeDirty()}
                        />
                      ) : (
                        opt.max_packages
                      )}
                    </td>
                    <td className="px-2 py-2 align-middle whitespace-normal text-xs text-center">
                      {Number.isFinite(maxKg) && maxKg > 0 ? (
                        <>
                          <span
                            className={
                              !isWithinLimit
                                ? "text-rose-600"
                                : isLowUtilization
                                  ? "text-amber-600"
                                  : "text-emerald-600"
                            }
                          >
                            {formatKg(weightLimitKg)} {isWithinLimit ? "<" : ">"} {formatKg(maxKg)}
                          </span>
                          {isWithinLimit && isLowUtilization && (
                            <div className="mt-1 text-[11px] text-amber-600">
                              Consider increasing{" "}
                              <button
                                type="button"
                                onClick={handleMaxPackagesEdit}
                                className="font-semibold underline underline-offset-2"
                              >
                                max packages
                              </button>
                              .
                            </div>
                          )}
                          {!isWithinLimit && (
                            <div className="mt-1 text-[11px] text-rose-600">
                              Decrease{" "}
                              <button
                                type="button"
                                onClick={handleMaxPackagesEdit}
                                className="font-semibold underline underline-offset-2"
                              >
                                max packages
                              </button>{" "}
                              OR increase{" "}
                              <Link
                                href="/admin/settings/production"
                                className="font-semibold underline underline-offset-2"
                              >
                                weight limit
                              </Link>
                              .
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-zinc-400">Set max total kg in settings</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {editMode && (
                <tr className="border-t border-zinc-100 bg-zinc-50/60">
                  <td className="px-2 py-2 align-top whitespace-normal">
                    <div className="space-y-3">
                      <div className="space-y-1">
                        {!newTypeCustom ? (
                          <select
                            value={newTypeValue || (typeOptions[0] ?? "")}
                            onChange={(event) => {
                              const next = event.target.value;
                              if (next === "__custom__") {
                                setNewTypeCustom(true);
                                setNewTypeValue("");
                                setNewLids([]);
                                return;
                              }
                              setNewTypeCustom(false);
                              setNewTypeValue(next);
                              if (!next.toLowerCase().includes("jar")) {
                                setNewLids([]);
                              }
                              const sizesForType = sizeOptionsByType.get(next) ?? [];
                              if (sizesForType.length > 0 && !sizesForType.includes(newSizeValue)) {
                                setNewSizeValue(sizesForType[0]);
                                setNewSizeCustom(false);
                              }
                              markDirty("new");
                              recomputeDirty();
                            }}
                            className="w-full rounded border border-zinc-200 px-2 py-1"
                          >
                            {typeOptions.map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                            <option value="__custom__">Custom...</option>
                          </select>
                        ) : (
                          <div className="space-y-1">
                            <input
                              type="text"
                              value={newTypeValue}
                              onChange={(event) => {
                                const next = event.target.value;
                                setNewTypeValue(next);
                                if (!next.toLowerCase().includes("jar")) {
                                  setNewLids([]);
                                }
                                markDirty("new");
                                recomputeDirty();
                              }}
                              className="w-full rounded border border-zinc-200 px-2 py-1"
                              placeholder="Type"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setNewTypeCustom(false);
                                setNewTypeValue(typeOptions[0] ?? "");
                              }}
                              className="text-[11px] font-semibold text-zinc-500 underline"
                            >
                              Use dropdown
                            </button>
                          </div>
                        )}
                        <input
                          form="pack-new"
                          type="hidden"
                          name="type"
                          value={newTypeValue || (typeOptions[0] ?? "")}
                          readOnly
                        />
                      </div>
                      <div className="space-y-1">
                        {!newSizeCustom ? (
                          <select
                            value={
                              newSizeValue || (sizeOptionsByType.get(newTypeValue || (typeOptions[0] ?? ""))?.[0] ?? "")
                            }
                            onChange={(event) => {
                              const next = event.target.value;
                              if (next === "__custom__") {
                                setNewSizeCustom(true);
                                setNewSizeValue("");
                                return;
                              }
                              setNewSizeCustom(false);
                              setNewSizeValue(next);
                              markDirty("new");
                              recomputeDirty();
                            }}
                            className="w-full rounded border border-zinc-200 px-2 py-1"
                          >
                            {(sizeOptionsByType.get(newTypeValue || (typeOptions[0] ?? "")) ?? []).map((size) => (
                              <option key={size} value={size}>
                                {formatSizeLabel(newTypeValue || (typeOptions[0] ?? ""), size)}
                              </option>
                            ))}
                            <option value="__custom__">Custom...</option>
                          </select>
                        ) : (
                          <div className="space-y-1">
                            <input
                              type="text"
                              value={newSizeValue}
                              onChange={(event) => {
                                setNewSizeValue(event.target.value);
                                markDirty("new");
                                recomputeDirty();
                              }}
                              className="w-full rounded border border-zinc-200 px-2 py-1"
                              placeholder="Size"
                            />
                            {(sizeOptionsByType.get(newTypeValue || (typeOptions[0] ?? "")) ?? []).length > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setNewSizeCustom(false);
                                  setNewSizeValue(sizeOptionsByType.get(newTypeValue || (typeOptions[0] ?? ""))?.[0] ?? "");
                                }}
                                className="text-[11px] font-semibold text-zinc-500 underline"
                              >
                                Use dropdown
                              </button>
                            )}
                          </div>
                        )}
                        <input
                          form="pack-new"
                          type="hidden"
                          name="size"
                          value={
                            newSizeValue || (sizeOptionsByType.get(newTypeValue || (typeOptions[0] ?? ""))?.[0] ?? "")
                          }
                          readOnly
                        />
                      </div>
                    </div>
                    <form
                      id="pack-new"
                      data-pack-form
                      data-id="new"
                      data-new="true"
                      action={upsertPackaging}
                      className="hidden"
                    >
                      <input
                        type="hidden"
                        name="type_sort_order"
                        value={
                          typeSortOrderByType.get(newTypeValue || (typeOptions[0] ?? "")) ??
                          getPackagingTypeSortOrder(newTypeValue || (typeOptions[0] ?? ""), options) ??
                          orderedTypes.length
                        }
                        readOnly
                      />
                    </form>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      form="pack-new"
                      type="number"
                      step="0.1"
                      name="candy_weight_g"
                      className="w-full rounded border border-zinc-200 px-2 py-1"
                      placeholder="e.g., 23"
                      required
                      onChange={() => {
                        markDirty("new");
                        recomputeDirty();
                      }}
                    />
                  </td>
                  <td className="px-2 py-2 align-middle whitespace-normal">
                    <input
                      form="pack-new"
                      type="text"
                      name="allowed_categories"
                      className="hidden"
                      value={newAllowed.join(",")}
                      readOnly
                    />
                    {editMode && (
                      <div className="space-y-1 rounded border border-zinc-200 p-2">
                        <div className="flex flex-wrap gap-2 text-xs text-zinc-700">
                          {categories.map((cat) => {
                            const checked = newAllowed.includes(cat.id);
                            return (
                              <label key={cat.id} className="inline-flex items-center gap-1 rounded border border-zinc-200 px-2 py-1 hover:bg-zinc-50">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    setNewAllowed((prev) => {
                                      const next = prev.includes(cat.id)
                                        ? prev.filter((c) => c !== cat.id)
                                        : [...prev, cat.id];
                                      markDirty("new");
                                      recomputeDirty();
                                      return next;
                                    })
                                  }
                                  className="rounded border-zinc-300"
                                />
                                {cat.name}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2 align-middle whitespace-normal">
                    <input
                      form="pack-new"
                      type="hidden"
                      name="label_type_ids"
                      value={newLabelSelections.join(",")}
                      readOnly
                    />
                    <div className="space-y-1 rounded border border-zinc-200 p-2">
                      {labelTypes.length > 0 ? (
                        <div className="flex flex-wrap gap-2 text-xs text-zinc-700">
                          {labelTypes.map((labelType) => {
                            const checked = newLabelSelections.includes(labelType.id);
                            return (
                              <label
                                key={labelType.id}
                                className="inline-flex items-center gap-1 rounded border border-zinc-200 px-2 py-1 hover:bg-zinc-50"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    setNewLabelSelections((prev) => {
                                      const next = prev.includes(labelType.id)
                                        ? prev.filter((id) => id !== labelType.id)
                                        : [...prev, labelType.id];
                                      markDirty("new");
                                      recomputeDirty();
                                      return next;
                                    })
                                  }
                                  className="rounded border-zinc-300"
                                />
                                {formatLabelType(labelType)}
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-400">Add label types in Packaging &gt; Labels</p>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2 align-middle whitespace-normal">
                    <input
                      form="pack-new"
                      type="hidden"
                      name="lid_colors"
                      className="hidden"
                      value={(
                        (newTypeValue || (typeOptions[0] ?? "")).toLowerCase().includes("jar") ? newLids : []
                      ).join(",")}
                      readOnly
                    />
                    <div className="space-y-1 rounded border border-zinc-200 p-2">
                      {(newTypeValue || (typeOptions[0] ?? "")).toLowerCase().includes("jar") ? (
                        <div className="flex flex-wrap gap-2 text-xs text-zinc-700">
                          {LID_OPTIONS.map((color) => {
                            const checked = newLids.includes(color);
                            return (
                              <label key={color} className="inline-flex items-center gap-1 rounded border border-zinc-200 px-2 py-1 hover:bg-zinc-50">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    setNewLids((prev) => {
                                      const next = prev.includes(color)
                                        ? prev.filter((c) => c !== color)
                                        : [...prev, color];
                                      markDirty("new");
                                      recomputeDirty();
                                      return next;
                                    })
                                  }
                                  className="rounded border-zinc-300"
                                />
                                {color}
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-400">Jar only</p>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2 align-middle whitespace-normal">
                    <input
                      form="pack-new"
                      type="number"
                      step="0.01"
                      name="unit_price"
                      className="w-full rounded border border-zinc-200 px-2 py-1"
                      placeholder="0.00"
                      required
                    />
                  </td>
                  <td className="px-2 py-2 align-middle whitespace-normal">
                    <input
                      form="pack-new"
                      type="number"
                      name="max_packages"
                      className="w-full rounded border border-zinc-200 px-2 py-1"
                      placeholder="Max per order"
                      required
                    />
                  </td>
                  <td className="px-2 py-2 align-middle whitespace-normal text-xs text-zinc-400">Save to check</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="space-y-2">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Image combinations</p>
            <p className="text-sm text-zinc-600">
              Generated from the saved packaging rows. Save above to refresh combinations. JPEG only.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500">
                  <th className="px-3 py-2" aria-sort={ariaSort("category")}>
                    <button
                      type="button"
                      onClick={() => handleComboSort("category")}
                      data-plain-button
                      className="inline-flex items-center gap-2 text-left"
                    >
                      Category
                      {sortLabel("category") && (
                        <span className="text-[10px] text-zinc-400">{sortLabel("category")}</span>
                      )}
                    </button>
                  </th>
                  <th className="px-3 py-2" aria-sort={ariaSort("type")}>
                    <button
                      type="button"
                      onClick={() => handleComboSort("type")}
                      data-plain-button
                      className="inline-flex items-center gap-2 text-left"
                    >
                      Type
                      {sortLabel("type") && <span className="text-[10px] text-zinc-400">{sortLabel("type")}</span>}
                    </button>
                  </th>
                  <th className="px-3 py-2" aria-sort={ariaSort("size")}>
                    <button
                      type="button"
                      onClick={() => handleComboSort("size")}
                      data-plain-button
                      className="inline-flex items-center gap-2 text-left"
                    >
                      Size
                      {sortLabel("size") && <span className="text-[10px] text-zinc-400">{sortLabel("size")}</span>}
                    </button>
                  </th>
                  <th className="px-3 py-2" aria-sort={ariaSort("lid")}>
                    <button
                      type="button"
                      onClick={() => handleComboSort("lid")}
                      data-plain-button
                      className="inline-flex items-center gap-2 text-left"
                    >
                      Lid
                      {sortLabel("lid") && <span className="text-[10px] text-zinc-400">{sortLabel("lid")}</span>}
                    </button>
                  </th>
                  <th className="px-3 py-2" aria-sort={ariaSort("image")}>
                    <button
                      type="button"
                      onClick={() => handleComboSort("image")}
                      data-plain-button
                      className="inline-flex items-center gap-2 text-left"
                    >
                      Image
                      {sortLabel("image") && <span className="text-[10px] text-zinc-400">{sortLabel("image")}</span>}
                    </button>
                  </th>
                  <th className="px-3 py-2">Upload</th>
                </tr>
              </thead>
              <tbody>
                {sortedComboRows.length === 0 && (
                  <tr className="border-t border-zinc-100">
                    <td className="px-3 py-4 text-sm text-zinc-500" colSpan={6}>
                      No combinations yet. Add packaging options above to generate rows.
                    </td>
                  </tr>
                )}
                {sortedComboRows.map((row) => {
                  const image = imageMap.get(row.key);
                  const imageUrl = buildPublicImageUrl(image?.image_path);
                  const fileInputId = `combo-upload-${toDomId(row.key)}`;
                  const isMissingImage = !image?.image_path;
                  const categoryName = categoryNameById.get(row.categoryId) ?? row.categoryId;
                  return (
                    <tr
                      key={row.key}
                      className={`border-t ${isMissingImage ? "border-red-200 bg-red-50/40" : "border-zinc-100"}`}
                    >
                      <td className="px-3 py-2 text-zinc-700">{categoryName}</td>
                      <td className="px-3 py-2 text-zinc-700">{row.packagingOption.type}</td>
                      <td className="px-3 py-2 text-zinc-700">
                        {formatSizeLabel(row.packagingOption.type, row.packagingOption.size)}
                      </td>
                      <td className="px-3 py-2 text-zinc-700">{row.lidColor || "-"}</td>
                      <td className="px-3 py-2 text-xs text-zinc-500">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={`Preview for ${row.comboKey}`}
                            className="h-12 w-12 rounded border border-zinc-200 object-cover"
                          />
                        ) : image?.image_path ? (
                          image.image_path
                        ) : (
                          "Not uploaded"
                        )}
                      </td>
                  <td className="px-3 py-2 min-w-[110px]">
                        <form action={uploadPackagingImage} className="flex flex-col gap-2">
                          <input type="hidden" name="packaging_option_id" value={row.packagingOption.id} />
                          <input type="hidden" name="category_id" value={row.categoryId} />
                          <input type="hidden" name="lid_color" value={row.lidColor} />
                          <input
                            id={fileInputId}
                            type="file"
                            name="image"
                            accept="image/jpeg,image/jpg"
                            required
                            className="sr-only"
                          />
                          <label
                            htmlFor={fileInputId}
                            className="inline-flex cursor-pointer items-center justify-center rounded border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm hover:border-zinc-400"
                          >
                            {imageUrl ? "Replace image" : "Choose image"}
                          </label>
                          <button
                            type="submit"
                            className="rounded border border-zinc-300 px-2 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-400"
                          >
                            Upload
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
