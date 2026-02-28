"use client";

import { useEffect, useMemo, useState, type ButtonHTMLAttributes, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_GOOGLE_PRODUCT_CATEGORY,
  DEFAULT_PREMADE_BRAND,
  DEFAULT_PRODUCT_CONDITION,
} from "@/lib/premadeDefaults";
import { supabaseClient } from "@/lib/supabase/client";
import { createPremadeUploadUrl, deletePremadeCandy, syncPremadeToWoo, updatePremadeCandy } from "./actions";

const MAX_IMAGE_SIZE_MB = 2;
const MAX_IMAGE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
const PREMADE_IMAGE_BUCKET = "premade-images";

function formatWooSyncTimestamp(value?: string | null) {
  if (!value) return "Never";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const day = String(parsed.getUTCDate()).padStart(2, "0");
  const hour = String(parsed.getUTCHours()).padStart(2, "0");
  const minute = String(parsed.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute} UTC`;
}

function resolveDefaultText(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

type PremadeItem = {
  id: string;
  name: string;
  description: string;
  weight_g: number;
  price: number;
  approx_pcs: number | null;
  image_path: string;
  flavors: string[] | null;
  great_value: boolean;
  is_active: boolean;
  sku: string | null;
  short_description: string | null;
  brand: string | null;
  google_product_category: string | null;
  product_condition: string | null;
  sale_price: number | null;
  availability: string | null;
  woo_product_id: string | null;
  woo_sync_status: string | null;
  woo_last_sync_at: string | null;
  woo_sync_error: string | null;
};

type Props = {
  item: PremadeItem;
  imageUrl: string;
  flavorOptions: string[];
  onToggleActive?: (id: string, nextActive: boolean) => void;
  onDelete?: (id: string) => void;
  dragHandleProps?: ButtonHTMLAttributes<HTMLButtonElement>;
};

export function EditPremadeItem({ item, imageUrl, flavorOptions, onToggleActive, onDelete, dragHandleProps }: Props) {
  const router = useRouter();
  const initialWeightUnit = useMemo(() => {
    const weight = Number(item.weight_g);
    return weight >= 1000 && weight % 1000 === 0 ? "kg" : "g";
  }, [item.weight_g]);
  const initialWeightValue = useMemo(() => {
    const weight = Number(item.weight_g);
    return initialWeightUnit === "kg" ? weight / 1000 : weight;
  }, [item.weight_g, initialWeightUnit]);
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description);
  const [weightValue, setWeightValue] = useState(String(initialWeightValue));
  const [weightUnit, setWeightUnit] = useState<"g" | "kg">(initialWeightUnit);
  const [price, setPrice] = useState(String(item.price));
  const [approxPcs, setApproxPcs] = useState(item.approx_pcs?.toString() ?? "");
  const [selectedFlavors, setSelectedFlavors] = useState<string[]>(item.flavors ?? []);
  const [greatValue, setGreatValue] = useState(item.great_value);
  const [sku, setSku] = useState(item.sku ?? "");
  const [shortDescription, setShortDescription] = useState(item.short_description ?? "");
  const [brand, setBrand] = useState(resolveDefaultText(item.brand, DEFAULT_PREMADE_BRAND));
  const [googleProductCategory, setGoogleProductCategory] = useState(
    resolveDefaultText(item.google_product_category, DEFAULT_GOOGLE_PRODUCT_CATEGORY)
  );
  const [productCondition, setProductCondition] = useState(
    resolveDefaultText(item.product_condition, DEFAULT_PRODUCT_CONDITION)
  );
  const [salePrice, setSalePrice] = useState(item.sale_price?.toString() ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [showProductFields, setShowProductFields] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (isEditing) return;
    setName(item.name);
    setDescription(item.description);
    setWeightUnit(initialWeightUnit);
    setWeightValue(String(initialWeightValue));
    setPrice(String(item.price));
    setApproxPcs(item.approx_pcs?.toString() ?? "");
    setSelectedFlavors(item.flavors ?? []);
    setGreatValue(item.great_value);
    setSku(item.sku ?? "");
    setShortDescription(item.short_description ?? "");
    setBrand(resolveDefaultText(item.brand, DEFAULT_PREMADE_BRAND));
    setGoogleProductCategory(
      resolveDefaultText(item.google_product_category, DEFAULT_GOOGLE_PRODUCT_CATEGORY)
    );
    setProductCondition(resolveDefaultText(item.product_condition, DEFAULT_PRODUCT_CONDITION));
    setSalePrice(item.sale_price?.toString() ?? "");
    setFile(null);
    setError(null);
    setSuccess(null);
    setSaving(false);
    setShowProductFields(false);
  }, [
    isEditing,
    item.name,
    item.description,
    item.weight_g,
    item.price,
    item.approx_pcs,
    item.flavors,
    item.great_value,
    item.sku,
    item.short_description,
    item.brand,
    item.google_product_category,
    item.product_condition,
    item.sale_price,
    initialWeightUnit,
    initialWeightValue,
  ]);

  const toggleFlavor = (flavorName: string) => {
    setSelectedFlavors((prev) => {
      if (flavorName === "Mixed") {
        return prev.includes("Mixed") ? [] : ["Mixed"];
      }
      const withoutMixed = prev.filter((item) => item !== "Mixed");
      if (withoutMixed.includes(flavorName)) {
        return withoutMixed.filter((item) => item !== flavorName);
      }
      return [...withoutMixed, flavorName];
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    if (!trimmedName) {
      setError("Name is required.");
      return;
    }
    if (selectedFlavors.length === 0) {
      setError("Select at least one flavor, or choose Mixed.");
      return;
    }
    const weightNumber = Number(weightValue);
    if (!Number.isFinite(weightNumber) || weightNumber <= 0) {
      setError("Weight must be greater than 0.");
      return;
    }
    const weight_g = weightUnit === "kg" ? weightNumber * 1000 : weightNumber;
    const priceNumber = Number(price);
    if (!Number.isFinite(priceNumber) || priceNumber <= 0) {
      setError("Price must be greater than 0.");
      return;
    }
    let salePriceNumber: number | null = null;
    if (salePrice !== "") {
      const parsedSale = Number(salePrice);
      if (!Number.isFinite(parsedSale) || parsedSale < 0) {
        setError("Sale price must be zero or greater.");
        return;
      }
      salePriceNumber = parsedSale;
    }
    let approx_pcs: number | null = null;
    if (approxPcs !== "") {
      const parsedApprox = Number(approxPcs);
      if (!Number.isFinite(parsedApprox) || parsedApprox <= 0) {
        setError("Approx pcs must be greater than 0.");
        return;
      }
      approx_pcs = parsedApprox;
    }

    let image_path: string | undefined;
    if (file) {
      if (file.size > MAX_IMAGE_BYTES) {
        setError(`File is too large. Max ${MAX_IMAGE_SIZE_MB}MB.`);
        return;
      }
      const fileName = file.name.toLowerCase();
      const extension = fileName.endsWith(".png")
        ? "png"
        : fileName.endsWith(".jpg")
          ? "jpg"
          : fileName.endsWith(".jpeg")
            ? "jpeg"
            : "";
      if (!extension) {
        setError("Only PNG or JPG images are supported.");
        return;
      }

      setSaving(true);
      try {
        const { data, error: urlError } = await createPremadeUploadUrl(trimmedName, extension);
        if (!data || urlError) {
          throw new Error(urlError || "Unable to prepare upload.");
        }

        const contentType = extension === "png" ? "image/png" : "image/jpeg";
        const { error: uploadError } = await supabaseClient.storage
          .from(PREMADE_IMAGE_BUCKET)
          .uploadToSignedUrl(data.path, data.token, file, { contentType });
        if (uploadError) {
          throw new Error(uploadError.message);
        }

        image_path = data.path;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to upload image.";
        setError(message);
        setSaving(false);
        return;
      }
    }

    const flavors = selectedFlavors.includes("Mixed") ? ["Mixed"] : selectedFlavors;
    setSaving(true);
    try {
      const resolvedBrand = brand.trim() || DEFAULT_PREMADE_BRAND;
      const resolvedCategory = googleProductCategory.trim() || DEFAULT_GOOGLE_PRODUCT_CATEGORY;
      const resolvedCondition = productCondition.trim() || DEFAULT_PRODUCT_CONDITION;
      const { error: updateError } = await updatePremadeCandy({
        id: item.id,
        name: trimmedName,
        description: trimmedDescription,
        weight_g,
        price: priceNumber,
        sale_price: salePriceNumber,
        approx_pcs: approxPcs === "" ? null : approx_pcs,
        image_path,
        flavors: flavors.length ? flavors : null,
        great_value: greatValue,
        sku: sku.trim() || null,
        short_description: shortDescription.trim() || null,
        brand: resolvedBrand,
        google_product_category: resolvedCategory,
        product_condition: resolvedCondition,
      });
      if (updateError) {
        throw new Error(updateError);
      }
      setSuccess("Saved.");
      setFile(null);
      setIsEditing(false);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to update item.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleWooSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const { error: syncError } = await syncPremadeToWoo(item.id);
      if (syncError) {
        setSyncMessage({ type: "error", text: syncError });
        return;
      }
      setSyncMessage({ type: "success", text: "Woo sync complete." });
      router.refresh();
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async () => {
    setDeleteError(null);
    setDeleting(true);
    try {
      const { error: deleteErrorMessage } = await deletePremadeCandy(item.id);
      if (deleteErrorMessage) {
        setDeleteError(deleteErrorMessage);
        return;
      }
      onDelete?.(item.id);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  };

  const flavorSummary = (item.flavors ?? []).length ? (item.flavors ?? []).join(", ") : "-";
  const weightLabel = initialWeightUnit === "kg" ? `${initialWeightValue}kg` : `${initialWeightValue}g`;
  const isActive = item.is_active;
  const syncStatus = item.woo_sync_status ?? (item.woo_product_id ? "synced" : "not_synced");
  const syncStatusLabel =
    syncStatus === "synced"
      ? "Woo synced"
      : syncStatus === "syncing"
        ? "Syncing"
        : syncStatus === "error"
          ? "Woo error"
          : "Not synced";
  const syncStatusClass =
    syncStatus === "synced"
      ? "bg-emerald-50 text-emerald-700"
      : syncStatus === "syncing"
        ? "bg-amber-50 text-amber-700"
        : syncStatus === "error"
          ? "bg-red-50 text-red-600"
          : "bg-zinc-100 text-zinc-600";
  const lastSyncLabel = formatWooSyncTimestamp(item.woo_last_sync_at);

  if (!isEditing) {
    return (
      <div className="rounded-xl border border-zinc-100 px-3 py-2">
        <div className="flex flex-col gap-3 md:flex-row md:items-start">
          <div className="w-full md:w-32">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={item.name}
                className="h-24 w-full rounded-lg border border-zinc-200 object-cover"
                loading="lazy"
              />
            ) : (
              <div className="h-24 w-full rounded-lg border border-zinc-200 bg-zinc-50" />
            )}
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <span className="text-sm font-semibold text-zinc-900">{item.name}</span>
                <span>{weightLabel}</span>
                <span className="font-semibold text-zinc-900">${Number(item.price).toFixed(2)}</span>
                {item.approx_pcs ? <span>Approx {item.approx_pcs} pcs</span> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {item.great_value ? (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                    Discounted
                  </span>
                ) : null}
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    isActive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                  }`}
                >
                  {isActive ? "Active" : "Inactive"}
                </span>
                <button
                  type="button"
                  data-neutral-button
                  onClick={() => onToggleActive?.(item.id, !isActive)}
                  className="rounded-md px-2 py-1 text-[11px] font-semibold"
                >
                  {isActive ? "Deactivate" : "Activate"}
                </button>
                <button
                  type="button"
                  data-neutral-button
                  onClick={() => setIsEditing(true)}
                  className="rounded-md px-2 py-1 text-[11px] font-semibold"
                >
                  Edit
                </button>
                <button
                  type="button"
                  data-neutral-button
                  onClick={() => {
                    setIsEditing(true);
                    setShowProductFields(true);
                  }}
                  className="rounded-md px-2 py-1 text-[11px] font-semibold"
                >
                  Product fields
                </button>
                <button
                  type="button"
                  data-neutral-button
                  className="inline-flex items-center justify-center rounded-md px-2 py-1 text-[11px] font-semibold text-zinc-500 cursor-grab"
                  aria-label="Drag to reorder"
                  {...dragHandleProps}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M4 6.5h16a1 1 0 0 0 0-2H4a1 1 0 0 0 0 2Zm0 6h16a1 1 0 1 0 0-2H4a1 1 0 1 0 0 2Zm0 6h16a1 1 0 1 0 0-2H4a1 1 0 1 0 0 2Z"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDelete((prev) => !prev);
                    setDeleteError(null);
                  }}
                  className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100"
                >
                  Delete
                </button>
              </div>
            </div>
            <div className="text-xs text-zinc-600">
              <span className="font-semibold text-zinc-500">Flavors:</span> {flavorSummary}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              <span className="font-semibold">Woo:</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${syncStatusClass}`}>
                {syncStatusLabel}
              </span>
              <span>Last sync {lastSyncLabel}</span>
              {item.woo_sync_error ? (
                <span
                  className="text-red-600"
                  title={item.woo_sync_error}
                >
                  {item.woo_sync_error.length > 120
                    ? `${item.woo_sync_error.slice(0, 120)}…`
                    : item.woo_sync_error}
                </span>
              ) : null}
              <button
                type="button"
                data-neutral-button
                onClick={handleWooSync}
                disabled={syncing}
                className="rounded-md px-2 py-1 text-[11px] font-semibold"
              >
                {syncing ? "Syncing..." : "Sync to Woo"}
              </button>
              {syncMessage ? (
                <span className={syncMessage.type === "error" ? "text-red-600" : "text-emerald-600"}>
                  {syncMessage.text}
                </span>
              ) : null}
            </div>
            <div className="text-xs text-zinc-500">{item.description ? item.description : "No description."}</div>
            {confirmDelete ? (
              <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-2 py-2 text-xs text-red-800">
                <p className="font-semibold">Delete this item permanently?</p>
                <p className="mt-1 text-[11px] text-red-700">
                  This removes it from admin, the storefront, and Woo product sync.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="rounded-md border border-red-300 bg-red-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {deleting ? "Deleting..." : "Confirm delete"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmDelete(false);
                      setDeleteError(null);
                    }}
                    disabled={deleting}
                    className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-700 hover:border-zinc-300 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    Cancel
                  </button>
                  {deleteError ? <span className="text-[11px] text-red-700">{deleteError}</span> : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-zinc-100 p-3">
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="w-full md:w-40">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={item.name}
              className="h-32 w-full rounded-lg border border-zinc-200 object-cover"
              loading="lazy"
            />
          ) : (
            <div className="h-32 w-full rounded-lg border border-zinc-200 bg-zinc-50" />
          )}
          <label className="mt-2 block text-xs uppercase tracking-[0.2em] text-zinc-500">
            Replace image
            <input
              type="file"
              accept="image/png,image/jpeg"
              className="mt-1 w-full rounded border border-zinc-200 px-3 py-2 text-sm"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <span className="mt-1 block text-[11px] text-zinc-500">
              PNG or JPG, max {MAX_IMAGE_SIZE_MB}MB.
            </span>
          </label>
        </div>
        <div className="flex-1 space-y-3">
          <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Name*
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-full rounded border border-zinc-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              className="mt-1 w-full rounded border border-zinc-200 px-3 py-2 text-sm"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-[2fr,1fr]">
            <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              Weight*
              <input
                type="number"
                min="0"
                step="0.1"
                value={weightValue}
                onChange={(event) => setWeightValue(event.target.value)}
                className="mt-1 w-full rounded border border-zinc-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              Unit
              <select
                value={weightUnit}
                onChange={(event) => setWeightUnit(event.target.value as "g" | "kg")}
                className="mt-1 w-full rounded border border-zinc-200 px-3 py-2 text-sm"
              >
                <option value="g">g</option>
                <option value="kg">kg</option>
              </select>
            </label>
          </div>
          <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Price (AUD)*
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              className="mt-1 w-full rounded border border-zinc-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Approx pcs
            <input
              type="number"
              min="0"
              step="1"
              value={approxPcs}
              onChange={(event) => setApproxPcs(event.target.value)}
              className="mt-1 w-full rounded border border-zinc-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="mt-2 flex w-full items-center gap-2 rounded border border-zinc-200 px-3 py-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
            <input
              type="checkbox"
              checked={greatValue}
              onChange={(event) => setGreatValue(event.target.checked)}
              className="h-4 w-4 rounded border-zinc-300"
            />
            Mark as discounted
          </label>
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Flavors*</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {["Mixed", ...flavorOptions.filter((flavor) => flavor !== "Mixed")].map((flavor) => {
                const checked = selectedFlavors.includes(flavor);
                const disabled =
                  flavor !== "Mixed" && selectedFlavors.includes("Mixed") && !checked;
                return (
                  <label
                    key={flavor}
                    className={`flex items-center gap-2 rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-700 ${
                      disabled ? "opacity-50" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggleFlavor(flavor)}
                    />
                    {flavor}
                  </label>
                );
              })}
            </div>
            <p className="text-[11px] text-zinc-500">Choose Mixed if the pack contains multiple flavors.</p>
          </div>
          <div className="space-y-2">
            <button
              type="button"
              data-neutral-button
              onClick={() => setShowProductFields((prev) => !prev)}
              className="rounded-md px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em]"
            >
              {showProductFields ? "Hide product fields" : "Product fields"}
            </button>
            {showProductFields && (
              <div className="grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 sm:grid-cols-2">
                <label className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                  SKU
                  <input
                    type="text"
                    value={sku}
                    onChange={(event) => setSku(event.target.value)}
                    className="mt-1 w-full rounded border border-zinc-200 px-3 py-2 text-sm"
                    placeholder="Optional"
                  />
                </label>
                <label className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                  Brand
                  <input
                    type="text"
                    value={brand}
                    onChange={(event) => setBrand(event.target.value)}
                    className="mt-1 w-full rounded border border-zinc-200 px-3 py-2 text-sm"
                    placeholder="Default: Roc Candy"
                  />
                </label>
                <label className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 sm:col-span-2">
                  Short description
                  <textarea
                    value={shortDescription}
                    onChange={(event) => setShortDescription(event.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded border border-zinc-200 px-3 py-2 text-sm"
                    placeholder="Optional summary for Google/feeds."
                  />
                </label>
                <label className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 sm:col-span-2">
                  Google product category
                  <input
                    type="text"
                    value={googleProductCategory}
                    onChange={(event) => setGoogleProductCategory(event.target.value)}
                    className="mt-1 w-full rounded border border-zinc-200 px-3 py-2 text-sm"
                    placeholder="Default: Food, Beverages & Tobacco > Food Items > Candy"
                  />
                </label>
                <label className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                  Condition
                  <select
                    value={productCondition}
                    onChange={(event) => setProductCondition(event.target.value)}
                    className="mt-1 w-full rounded border border-zinc-200 px-3 py-2 text-sm"
                  >
                    <option value="new">New</option>
                    <option value="used">Used</option>
                    <option value="refurbished">Refurbished</option>
                  </select>
                </label>
                <label className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                  Sale price (AUD)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={salePrice}
                    onChange={(event) => setSalePrice(event.target.value)}
                    className="mt-1 w-full rounded border border-zinc-200 px-3 py-2 text-sm"
                    placeholder="Optional"
                  />
                </label>
                <div className="sm:col-span-2 text-[11px] text-zinc-500">
                  Availability is tied to the Active/Inactive toggle.
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className={`rounded-md px-3 py-2 text-xs font-semibold ${
                saving ? "bg-zinc-100 text-zinc-500" : "bg-zinc-900 text-white hover:bg-zinc-800"
              }`}
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
            <button
              type="button"
              data-neutral-button
              onClick={() => {
                setIsEditing(false);
                setFile(null);
                setError(null);
                setSuccess(null);
              }}
              className="rounded-md px-3 py-2 text-xs font-semibold"
            >
              Cancel
            </button>
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
            {success ? <p className="text-xs text-emerald-600">{success}</p> : null}
          </div>
        </div>
      </div>
    </form>
  );
}
