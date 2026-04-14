"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ImageOptimizationStatus } from "@/components/ImageOptimizationStatus";
import { analyzeImageOptimization, type ImageOptimizationSummary } from "@/lib/clientImageOptimization";
import {
  DEFAULT_GOOGLE_PRODUCT_CATEGORY,
  DEFAULT_PREMADE_BRAND,
  DEFAULT_PRODUCT_CONDITION,
} from "@/lib/premadeDefaults";
import { insertPremadeCandy, uploadPremadeImageAction } from "./actions";

const MAX_IMAGE_SIZE_MB = 2;
const MAX_IMAGE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

type ErrorInfo = { message: string };

type Props = {
  flavorOptions: string[];
};

export function AddPremadeForm({ flavorOptions }: Props) {
  const router = useRouter();
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFlavors, setSelectedFlavors] = useState<string[]>([]);
  const [showProductFields, setShowProductFields] = useState(false);
  const [imageSummary, setImageSummary] = useState<ImageOptimizationSummary | null>(null);
  const [isAnalysingImage, setIsAnalysingImage] = useState(false);

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

    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get("name") || "").trim();
    const slug = String(formData.get("slug") || "").trim();
    const shortName = String(formData.get("short_name") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const weightValueRaw = String(formData.get("weight_value") || "").trim();
    const weightUnit = String(formData.get("weight_unit") || "g");
    const priceRaw = String(formData.get("price") || "").trim();
    const approxPcsRaw = String(formData.get("approx_pcs") || "").trim();
    const file = formData.get("image");
    const greatValue = formData.get("great_value") === "on";
    const flavors = selectedFlavors.includes("Mixed") ? ["Mixed"] : selectedFlavors;
    const sku = String(formData.get("sku") || "").trim();
    const shortDescription = String(formData.get("short_description") || "").trim();
    const brand = String(formData.get("brand") || "").trim();
    const googleProductCategory = String(formData.get("google_product_category") || "").trim();
    const productCondition = String(formData.get("product_condition") || "").trim();
    const salePriceRaw = String(formData.get("sale_price") || "").trim();

    if (!name) {
      setError({ message: "Name is required." });
      return;
    }
    if (selectedFlavors.length === 0) {
      setError({ message: "Select at least one flavor, or choose Mixed." });
      return;
    }
    const weightValue = Number(weightValueRaw);
    if (!Number.isFinite(weightValue) || weightValue <= 0) {
      setError({ message: "Weight must be greater than 0." });
      return;
    }
    const weight_g = weightUnit === "kg" ? weightValue * 1000 : weightValue;
    const price = Number(priceRaw);
    if (!Number.isFinite(price) || price <= 0) {
      setError({ message: "Price must be greater than 0." });
      return;
    }
    let approx_pcs: number | null = null;
    if (approxPcsRaw) {
      const parsedApprox = Number(approxPcsRaw);
      if (!Number.isFinite(parsedApprox) || parsedApprox <= 0) {
        setError({ message: "Approx pcs must be greater than 0." });
        return;
      }
      approx_pcs = parsedApprox;
    }
    let sale_price: number | null = null;
    if (salePriceRaw) {
      const parsedSale = Number(salePriceRaw);
      if (!Number.isFinite(parsedSale) || parsedSale < 0) {
        setError({ message: "Sale price must be zero or greater." });
        return;
      }
      sale_price = parsedSale;
    }
    const resolvedBrand = brand || DEFAULT_PREMADE_BRAND;
    const resolvedCategory = googleProductCategory || DEFAULT_GOOGLE_PRODUCT_CATEGORY;
    const resolvedCondition = productCondition || DEFAULT_PRODUCT_CONDITION;
    if (!(file instanceof File) || file.size === 0) {
      setError({ message: "Image is required." });
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError({ message: `File is too large. Max ${MAX_IMAGE_SIZE_MB}MB.` });
      return;
    }
    const fileName = file.name.toLowerCase();
    const extension = fileName.endsWith(".png")
      ? "png"
      : fileName.endsWith(".jpg")
        ? "jpg"
        : fileName.endsWith(".jpeg")
          ? "jpeg"
          : fileName.endsWith(".webp")
            ? "webp"
            : "";
    if (!extension) {
      setError({ message: "Only PNG, JPG, or WEBP images are supported." });
      return;
    }

    setIsSubmitting(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.set("name", name);
      uploadFormData.set("file", file);
      const { data, error: uploadError } = await uploadPremadeImageAction(uploadFormData);
      if (!data || uploadError) {
        throw new Error(uploadError || "Unable to upload image.");
      }

      const { error: insertError } = await insertPremadeCandy({
        name,
        slug: slug || null,
        short_name: shortName || null,
        description,
        weight_g,
        price,
        sale_price,
        approx_pcs,
        image_path: data.path,
        flavors: flavors.length ? flavors : null,
        great_value: greatValue,
        sku: sku || null,
        short_description: shortDescription || null,
        brand: resolvedBrand,
        google_product_category: resolvedCategory,
        product_condition: resolvedCondition,
      });
      if (insertError) {
        throw new Error(insertError);
      }

      form.reset();
      setSelectedFlavors([]);
      setShowProductFields(false);
      setSuccess("Pre-made candy added.");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to add pre-made candy.";
      setError({ message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3">
      <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
        Name*
        <input
          type="text"
          name="name"
          required
          className="mt-1 w-full rounded border border-zinc-200 px-3 py-2 text-sm"
          placeholder="e.g., Strawberry Hearts"
        />
      </label>
      <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
        Product URL
        <input
          type="text"
          name="slug"
          className="mt-1 w-full rounded border border-zinc-200 px-3 py-2 text-sm"
          placeholder="e.g., oh-boy-baby-boy-rock-candy"
        />
        <span className="mt-1 block text-[11px] normal-case tracking-normal text-zinc-500">
          Optional. Leave blank to generate from the product name.
        </span>
      </label>
      <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
        Short link label
        <input
          type="text"
          name="short_name"
          className="mt-1 w-full rounded border border-zinc-200 px-3 py-2 text-sm"
          placeholder="e.g., Baby Boy Candy"
        />
        <span className="mt-1 block text-[11px] normal-case tracking-normal text-zinc-500">
          Optional. Used for short shop-link text like “View Baby Boy Candy”.
        </span>
      </label>
      <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
        Description
        <textarea
          name="description"
          rows={3}
          className="mt-1 w-full rounded border border-zinc-200 px-3 py-2 text-sm"
          placeholder="Short description for the shop page."
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-[2fr,1fr]">
        <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
          Weight*
          <input
            type="number"
            name="weight_value"
            required
            min="0"
            step="0.1"
            className="mt-1 w-full rounded border border-zinc-200 px-3 py-2 text-sm"
            placeholder="e.g., 250"
          />
        </label>
        <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
          Unit
          <select
            name="weight_unit"
            className="mt-1 w-full rounded border border-zinc-200 px-3 py-2 text-sm"
            defaultValue="g"
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
          name="price"
          required
          min="0"
          step="0.01"
          className="mt-1 w-full rounded border border-zinc-200 px-3 py-2 text-sm"
          placeholder="e.g., 24.95"
        />
      </label>
      <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
        Approx pcs
        <input
          type="number"
          name="approx_pcs"
          min="0"
          step="1"
          className="mt-1 w-full rounded border border-zinc-200 px-3 py-2 text-sm"
          placeholder="Optional"
        />
      </label>
      <label className="mt-2 flex w-full items-center gap-2 rounded border border-zinc-200 px-3 py-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
        <input type="checkbox" name="great_value" className="h-4 w-4 rounded border-zinc-300" />
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
      <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
        Image*
        <input
          type="file"
          name="image"
          accept="image/png,image/jpeg,image/webp"
          required
          className="mt-1 w-full rounded border border-zinc-200 px-3 py-2 text-sm"
          onChange={async (event) => {
            const file = event.currentTarget.files?.[0];
            setImageSummary(null);
            if (!file) return;
            setIsAnalysingImage(true);
            try {
              const summary = await analyzeImageOptimization(file, {
                maxWidth: 1800,
                maxHeight: 1800,
                quality: 0.82,
              });
              setImageSummary(summary);
            } finally {
              setIsAnalysingImage(false);
            }
          }}
        />
        <span className="mt-1 block text-[11px] text-zinc-500">PNG, JPG, or WEBP. Stored as the smallest suitable optimised web image. Max {MAX_IMAGE_SIZE_MB}MB.</span>
        {isAnalysingImage ? (
          <div className="mt-2">
            <ImageOptimizationStatus
              summary={null}
              pendingLabel="Calculating optimised image details..."
              helperText="This upload will be stored in the smallest suitable web format."
            />
          </div>
        ) : imageSummary ? (
          <div className="mt-2">
            <ImageOptimizationStatus
              summary={imageSummary}
              pendingLabel={isSubmitting ? "Optimising and uploading image..." : null}
              helperText="This upload will be stored in the smallest suitable web format."
            />
          </div>
        ) : null}
      </label>
      <div className="space-y-2">
        <button
          type="button"
          data-neutral-button
          onClick={() => setShowProductFields((prev) => !prev)}
          className="rounded-md px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em]"
        >
          {showProductFields ? "Hide product fields" : "Add product fields"}
        </button>
        {showProductFields && (
          <div className="grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 sm:grid-cols-2">
            <label className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
              SKU
              <input
                type="text"
                name="sku"
                className="mt-1 w-full rounded border border-zinc-200 px-3 py-2 text-sm"
                placeholder="Optional"
              />
            </label>
            <label className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
              Brand
              <input
                type="text"
                name="brand"
                className="mt-1 w-full rounded border border-zinc-200 px-3 py-2 text-sm"
                defaultValue={DEFAULT_PREMADE_BRAND}
              />
            </label>
            <label className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 sm:col-span-2">
              Short description
              <textarea
                name="short_description"
                rows={2}
                className="mt-1 w-full rounded border border-zinc-200 px-3 py-2 text-sm"
                placeholder="Optional summary for Google/feeds."
              />
            </label>
            <label className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 sm:col-span-2">
              Google product category
              <input
                type="text"
                name="google_product_category"
                className="mt-1 w-full rounded border border-zinc-200 px-3 py-2 text-sm"
                defaultValue={DEFAULT_GOOGLE_PRODUCT_CATEGORY}
              />
            </label>
            <label className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
              Condition
              <select
                name="product_condition"
                defaultValue={DEFAULT_PRODUCT_CONDITION}
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
                name="sale_price"
                min="0"
                step="0.01"
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
      <button
        type="submit"
        disabled={isSubmitting}
        className={`inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold ${
          isSubmitting ? "bg-zinc-100 text-zinc-500" : "bg-zinc-900 text-white hover:bg-zinc-800"
        }`}
      >
        {isSubmitting ? "Saving..." : "Add pre-made candy"}
      </button>
      {error && <p className="text-xs text-red-600">{error.message}</p>}
      {success && <p className="text-xs text-emerald-600">{success}</p>}
    </form>
  );
}
