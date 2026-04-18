"use server";

import { revalidatePath } from "next/cache";
import type { PremadeCandy } from "@/lib/data";
import { getChangedFieldLabels, logAdminActivity } from "@/lib/adminActivity";
import { requireAdminWriteAccess } from "@/lib/adminAuth";
import {
  buildPremadeItemPath,
  buildPremadeLegacyItemPath,
} from "@/lib/premadeCatalog";
import { resolveUniquePremadeSlug } from "@/lib/premadeSlugs";
import {
  DEFAULT_GOOGLE_PRODUCT_CATEGORY,
  DEFAULT_PREMADE_BRAND,
  DEFAULT_PRODUCT_CONDITION,
  DEFAULT_WOO_CATEGORY,
} from "@/lib/premadeDefaults";
import {
  isOptimizableWebImageMimeType,
  optimizeServerImageForWeb,
} from "@/lib/serverImageOptimization";
import { saveSiteRedirect } from "@/lib/siteRedirects";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { deleteWooProduct, upsertWooProduct } from "@/lib/woo";

const PREMADE_IMAGE_BUCKET = "premade-images";
const WOO_STATUS_SYNCING = "syncing";
const WOO_STATUS_SYNCED = "synced";
const WOO_STATUS_ERROR = "error";

function normalizePremadeFileName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeFileName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-");
}

function buildPremadeImageUrl(path?: string | null) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base || !path) return "";
  const encoded = encodeURIComponent(path);
  return `${base}/storage/v1/object/public/${PREMADE_IMAGE_BUCKET}/${encoded}`;
}

function revalidatePremadePaths(paths: string[]) {
  for (const path of Array.from(new Set(paths.filter(Boolean)))) {
    revalidatePath(path);
  }
  revalidatePath("/pre-made-candy");
  revalidatePath("/sitemap.xml");
  revalidatePath("/admin/premade");
  revalidatePath("/admin/settings/pages");
}

async function updateWooSyncStatus(
  client: typeof supabaseAdminClient,
  id: string,
  patch: Partial<Pick<PremadeCandy, "woo_product_id" | "woo_sync_status" | "woo_last_sync_at" | "woo_sync_error">>
) {
  await client.from("premade_candies").update(patch).eq("id", id);
}

async function syncPremadeCandyToWoo(client: typeof supabaseAdminClient, premade: PremadeCandy) {
  const startedAt = new Date().toISOString();
  await updateWooSyncStatus(client, premade.id, {
    woo_sync_status: WOO_STATUS_SYNCING,
    woo_sync_error: null,
  });
  try {
    const imageUrl = buildPremadeImageUrl(premade.image_path);
    const availability = premade.is_active ? "in_stock" : "out_of_stock";
    const resolvedBrand = premade.brand?.trim() || DEFAULT_PREMADE_BRAND;
    const resolvedCategory =
      premade.google_product_category?.trim() || DEFAULT_GOOGLE_PRODUCT_CATEGORY;
    const resolvedCondition = premade.product_condition?.trim() || DEFAULT_PRODUCT_CONDITION;
    const { id: wooId } = await upsertWooProduct({
      id: premade.woo_product_id ?? undefined,
      name: premade.name,
      description: premade.description,
      shortDescription: premade.short_description ?? undefined,
      price: Number(premade.price),
      salePrice: premade.sale_price ?? undefined,
      imageUrl: imageUrl || undefined,
      isActive: premade.is_active,
      sku: premade.sku?.trim() ? premade.sku : `premade-${premade.id}`,
      weightG: premade.weight_g ? Number(premade.weight_g) : undefined,
      availability,
      brand: resolvedBrand,
      googleProductCategory: resolvedCategory,
      productCondition: resolvedCondition,
      categoryName: DEFAULT_WOO_CATEGORY,
    });
    await updateWooSyncStatus(client, premade.id, {
      woo_product_id: wooId,
      woo_sync_status: WOO_STATUS_SYNCED,
      woo_last_sync_at: startedAt,
      woo_sync_error: null,
    });
    return { error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to sync with Woo.";
    await updateWooSyncStatus(client, premade.id, {
      woo_sync_status: WOO_STATUS_ERROR,
      woo_last_sync_at: startedAt,
      woo_sync_error: message,
    });
    return { error: message };
  }
}

export type PremadeImageUploadResponse = {
  data: { path: string } | null;
  error: string | null;
};

export async function uploadPremadeImageAction(formData: FormData): Promise<PremadeImageUploadResponse> {
  try {
    await requireAdminWriteAccess();
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : "Unable to upload image." };
  }
  const trimmed = formData.get("name")?.toString().trim();
  const file = formData.get("file");
  if (!trimmed) {
    return { data: null, error: "Name is required." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { data: null, error: "Image is required." };
  }
  if (file.type && !isOptimizableWebImageMimeType(file.type)) {
    return { data: null, error: "Only PNG, JPG, and WEBP images are supported." };
  }

  const slug = normalizePremadeFileName(trimmed);
  const client = supabaseAdminClient;
  const optimized = await optimizeServerImageForWeb(file, {
    maxWidth: 1800,
    maxHeight: 1800,
    quality: 82,
  });
  const fileName = normalizeFileName(`${slug}-${Date.now()}.${optimized.extension}`);
  const { error } = await client.storage
    .from(PREMADE_IMAGE_BUCKET)
    .upload(fileName, optimized.buffer, { contentType: optimized.contentType, upsert: true });

  if (error) {
    return { data: null, error: error.message ?? "Unable to upload image." };
  }

  await logAdminActivity({
    area: "products",
    action: "uploaded",
    entityType: "premade-image",
    entityLabel: trimmed,
    summary: `Uploaded pre-made product image for "${trimmed}".`,
    path: "/admin/premade",
    changedFields: ["Image"],
    metadata: {
      fileName,
    },
  });

  return { data: { path: fileName }, error: null };
}

export async function insertPremadeCandy(payload: {
  name: string;
  slug?: string | null;
  short_name?: string | null;
  description: string;
  weight_g: number;
  price: number;
  approx_pcs?: number | null;
  image_path: string;
  flavors?: string[] | null;
  great_value?: boolean;
  is_active?: boolean;
  sku?: string | null;
  short_description?: string | null;
  brand?: string | null;
  google_product_category?: string | null;
  product_condition?: string | null;
  sale_price?: number | null;
}): Promise<{ error: string | null }> {
  try {
    await requireAdminWriteAccess();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to create pre-made item." };
  }
  const name = payload.name?.toString().trim();
  const description = payload.description?.toString().trim() ?? "";
  if (!name) return { error: "Name is required." };
  if (!payload.flavors || payload.flavors.length === 0) {
    return { error: "Select at least one flavor." };
  }
  if (!Number.isFinite(payload.weight_g) || payload.weight_g <= 0) {
    return { error: "Weight must be greater than 0." };
  }
  if (!Number.isFinite(payload.price) || payload.price <= 0) {
    return { error: "Price must be greater than 0." };
  }
  if (!payload.image_path) {
    return { error: "Image is required." };
  }
  if (payload.sale_price != null && (!Number.isFinite(payload.sale_price) || payload.sale_price < 0)) {
    return { error: "Sale price must be zero or greater." };
  }

  const client = supabaseAdminClient;
  const resolvedSlug = await resolveUniquePremadeSlug(
    payload.slug?.trim() || name,
    null,
    !payload.slug?.trim(),
  );
  const { data: sortRows, error: sortError } = await client
    .from("premade_candies")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1);
  if (sortError) return { error: sortError.message };

  const nextSort = Number(sortRows?.[0]?.sort_order ?? -1) + 1;
  const isActive = payload.is_active ?? true;
  const resolvedBrand = payload.brand?.trim() || DEFAULT_PREMADE_BRAND;
  const resolvedCategory =
    payload.google_product_category?.trim() || DEFAULT_GOOGLE_PRODUCT_CATEGORY;
  const resolvedCondition = payload.product_condition?.trim() || DEFAULT_PRODUCT_CONDITION;
  const { data, error } = await client
    .from("premade_candies")
    .insert({
      name,
      slug: resolvedSlug,
      short_name: payload.short_name?.trim() || null,
      description,
      weight_g: payload.weight_g,
      price: payload.price,
      sale_price: payload.sale_price ?? null,
      approx_pcs: payload.approx_pcs ?? null,
      image_path: payload.image_path,
      flavors: payload.flavors ?? null,
      great_value: payload.great_value ?? false,
      is_active: isActive,
      sort_order: nextSort,
      sku: payload.sku?.trim() || null,
      short_description: payload.short_description?.trim() || null,
      brand: resolvedBrand,
      google_product_category: resolvedCategory,
      product_condition: resolvedCondition,
      availability: isActive ? "in_stock" : "out_of_stock",
    })
    .select("*")
    .single();
  if (error) return { error: error.message };
  if (data) {
    await syncPremadeCandyToWoo(client, data as PremadeCandy);
    revalidatePremadePaths([
      buildPremadeItemPath(data as PremadeCandy),
      buildPremadeLegacyItemPath(data as PremadeCandy),
    ]);
    await logAdminActivity({
      area: "products",
      action: "created",
      entityType: "premade-product",
      entityId: data.id,
      entityLabel: data.name,
      summary: `Created pre-made product "${data.name}".`,
      path: "/admin/premade",
      changedFields: ["Name", "Price", "Weight", "Flavors", "Active state"],
    });
  }
  return { error: null };
}

export async function updatePremadeCandy(payload: {
  id: string;
  name: string;
  slug?: string | null;
  short_name?: string | null;
  description: string;
  weight_g: number;
  price: number;
  approx_pcs?: number | null;
  image_path?: string;
  flavors?: string[] | null;
  great_value?: boolean;
  sku?: string | null;
  short_description?: string | null;
  brand?: string | null;
  google_product_category?: string | null;
  product_condition?: string | null;
  sale_price?: number | null;
}): Promise<{ error: string | null }> {
  try {
    await requireAdminWriteAccess();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to update pre-made item." };
  }
  if (!payload.id) return { error: "Missing item id." };
  const name = payload.name?.toString().trim();
  const description = payload.description?.toString().trim() ?? "";
  if (!name) return { error: "Name is required." };
  if (!payload.flavors || payload.flavors.length === 0) {
    return { error: "Select at least one flavor." };
  }
  if (!Number.isFinite(payload.weight_g) || payload.weight_g <= 0) {
    return { error: "Weight must be greater than 0." };
  }
  if (!Number.isFinite(payload.price) || payload.price <= 0) {
    return { error: "Price must be greater than 0." };
  }
  if (payload.sale_price != null && (!Number.isFinite(payload.sale_price) || payload.sale_price < 0)) {
    return { error: "Sale price must be zero or greater." };
  }

  const update: {
    name: string;
    slug: string;
    short_name: string | null;
    description: string;
    weight_g: number;
    price: number;
    sale_price: number | null;
    approx_pcs: number | null;
    flavors: string[] | null;
    great_value: boolean;
    image_path?: string;
    sku: string | null;
    short_description: string | null;
    brand: string | null;
    google_product_category: string | null;
    product_condition: string | null;
  } = {
    name,
    slug: "",
    short_name: payload.short_name?.trim() || null,
    description,
    weight_g: payload.weight_g,
    price: payload.price,
    sale_price: payload.sale_price ?? null,
    approx_pcs: payload.approx_pcs ?? null,
    flavors: payload.flavors ?? null,
    great_value: payload.great_value ?? false,
    sku: payload.sku?.trim() || null,
    short_description: payload.short_description?.trim() || null,
    brand: payload.brand?.trim() || DEFAULT_PREMADE_BRAND,
    google_product_category:
      payload.google_product_category?.trim() || DEFAULT_GOOGLE_PRODUCT_CATEGORY,
    product_condition: payload.product_condition?.trim() || DEFAULT_PRODUCT_CONDITION,
  };

  if (payload.image_path) {
    update.image_path = payload.image_path;
  }

  const client = supabaseAdminClient;
  const { data: existing, error: existingError } = await client
    .from("premade_candies")
    .select("*")
    .eq("id", payload.id)
    .maybeSingle();
  if (existingError) return { error: existingError.message };
  const existingItem = (existing as PremadeCandy | null) ?? null;
  if (!existingItem) return { error: "Pre-made item not found." };

  update.slug = await resolveUniquePremadeSlug(
    payload.slug?.trim() || name,
    payload.id,
    !payload.slug?.trim(),
  );

  const { data, error } = await client
    .from("premade_candies")
    .update(update)
    .eq("id", payload.id)
    .select("*")
    .single();
  if (error) return { error: error.message };
  if (data) {
    await syncPremadeCandyToWoo(client, data as PremadeCandy);
    const oldPath = buildPremadeItemPath(existingItem);
    const nextPath = buildPremadeItemPath(data as PremadeCandy);
    if (oldPath !== nextPath) {
      await saveSiteRedirect({
        sourcePath: oldPath,
        destinationPath: nextPath,
        statusCode: 301,
        isActive: true,
      });
    }
    revalidatePremadePaths([
      oldPath,
      buildPremadeLegacyItemPath(existingItem),
      nextPath,
      buildPremadeLegacyItemPath(data as PremadeCandy),
    ]);
    await logAdminActivity({
      area: "products",
      action: "updated",
      entityType: "premade-product",
      entityId: data.id,
      entityLabel: data.name,
      summary: `Updated pre-made product "${data.name}".`,
      path: "/admin/premade",
      changedFields: getChangedFieldLabels(
        {
          name: existingItem.name,
          slug: existingItem.slug,
          short_name: existingItem.short_name,
          description: existingItem.description,
          weight_g: existingItem.weight_g,
          price: existingItem.price,
          sale_price: existingItem.sale_price,
          approx_pcs: existingItem.approx_pcs,
          image_path: existingItem.image_path,
          flavors: existingItem.flavors,
          great_value: existingItem.great_value,
          sku: existingItem.sku,
          short_description: existingItem.short_description,
          brand: existingItem.brand,
          google_product_category: existingItem.google_product_category,
          product_condition: existingItem.product_condition,
        },
        {
          name: data.name,
          slug: data.slug,
          short_name: data.short_name,
          description: data.description,
          weight_g: data.weight_g,
          price: data.price,
          sale_price: data.sale_price,
          approx_pcs: data.approx_pcs,
          image_path: data.image_path,
          flavors: data.flavors,
          great_value: data.great_value,
          sku: data.sku,
          short_description: data.short_description,
          brand: data.brand,
          google_product_category: data.google_product_category,
          product_condition: data.product_condition,
        },
        {
          name: "Name",
          slug: "URL slug",
          short_name: "Short name",
          description: "Description",
          weight_g: "Weight",
          price: "Price",
          sale_price: "Sale price",
          approx_pcs: "Approx pieces",
          image_path: "Image",
          flavors: "Flavors",
          great_value: "Great value",
          sku: "SKU",
          short_description: "Short description",
          brand: "Brand",
          google_product_category: "Google category",
          product_condition: "Condition",
        },
      ),
    });
  }
  return { error: null };
}

export async function setPremadeActive(id: string, is_active: boolean): Promise<{ error: string | null }> {
  try {
    await requireAdminWriteAccess();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to update pre-made item." };
  }
  if (!id) return { error: "Missing item id." };
  const client = supabaseAdminClient;
  const { data, error } = await client
    .from("premade_candies")
    .update({ is_active, availability: is_active ? "in_stock" : "out_of_stock" })
    .eq("id", id)
    .select("*")
    .single();
  if (error) return { error: error.message };
  if (data) {
    await syncPremadeCandyToWoo(client, data as PremadeCandy);
    revalidatePremadePaths([
      buildPremadeItemPath(data as PremadeCandy),
      buildPremadeLegacyItemPath(data as PremadeCandy),
    ]);
    await logAdminActivity({
      area: "products",
      action: "updated",
      entityType: "premade-product",
      entityId: data.id,
      entityLabel: data.name,
      summary: `${is_active ? "Activated" : "Deactivated"} pre-made product "${data.name}".`,
      path: "/admin/premade",
      changedFields: ["Active state"],
    });
  }
  return { error: null };
}

export async function updatePremadeOrder(
  updates: { id: string; sort_order: number }[]
): Promise<{ error: string | null }> {
  try {
    await requireAdminWriteAccess();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to save pre-made order." };
  }
  if (!updates.length) return { error: null };
  const client = supabaseAdminClient;
  for (const update of updates) {
    const { error } = await client
      .from("premade_candies")
      .update({ sort_order: update.sort_order })
      .eq("id", update.id);
    if (error) return { error: error.message };
  }
  await logAdminActivity({
    area: "products",
    action: "reordered",
    entityType: "premade-products",
    entityLabel: "Pre-made products",
    summary: "Saved pre-made product order.",
    path: "/admin/premade",
    changedFields: ["Sort order"],
    metadata: {
      itemCount: updates.length,
    },
  });
  return { error: null };
}

export async function syncPremadeToWoo(id: string): Promise<{ error: string | null }> {
  try {
    await requireAdminWriteAccess();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to sync pre-made item." };
  }
  if (!id) return { error: "Missing item id." };
  const client = supabaseAdminClient;
  const { data, error } = await client.from("premade_candies").select("*").eq("id", id).single();
  if (error || !data) return { error: error?.message ?? "Premade item not found." };
  const syncResult = await syncPremadeCandyToWoo(client, data as PremadeCandy);
  if (!syncResult.error) {
    await logAdminActivity({
      area: "products",
      action: "synced",
      entityType: "premade-product",
      entityId: data.id,
      entityLabel: data.name,
      summary: `Synced pre-made product "${data.name}" to Woo.`,
      path: "/admin/premade",
      changedFields: ["Woo sync"],
    });
  }
  return { error: syncResult.error };
}

export async function syncAllPremadeToWoo(): Promise<{
  error: string | null;
  synced: number;
  failed: number;
  total: number;
}> {
  try {
    await requireAdminWriteAccess();
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to sync pre-made items.",
      synced: 0,
      failed: 0,
      total: 0,
    };
  }
  const client = supabaseAdminClient;
  const { data, error } = await client.from("premade_candies").select("*");
  if (error) {
    return { error: error.message, synced: 0, failed: 0, total: 0 };
  }
  const items = (data ?? []) as PremadeCandy[];
  if (items.length === 0) return { error: null, synced: 0, failed: 0, total: 0 };
  let synced = 0;
  let failed = 0;
  for (const item of items) {
    const result = await syncPremadeCandyToWoo(client, item);
    if (result.error) {
      failed += 1;
    } else {
      synced += 1;
    }
  }
  const errorMessage = failed > 0 ? `${failed} item${failed === 1 ? "" : "s"} failed to sync.` : null;
  await logAdminActivity({
    area: "products",
    action: "synced",
    entityType: "premade-products",
    entityLabel: "Pre-made products",
    summary:
      failed > 0
        ? `Synced ${synced} pre-made products to Woo, with ${failed} failures.`
        : `Synced ${synced} pre-made products to Woo.`,
    path: "/admin/premade",
    changedFields: ["Woo sync"],
    metadata: {
      synced,
      failed,
      total: items.length,
    },
  });
  return { error: errorMessage, synced, failed, total: items.length };
}

export async function deletePremadeCandy(id: string): Promise<{ error: string | null }> {
  try {
    await requireAdminWriteAccess();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to delete pre-made item." };
  }
  if (!id) return { error: "Missing item id." };
  const client = supabaseAdminClient;
  const { data: existing, error: readError } = await client
    .from("premade_candies")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (readError) return { error: readError.message };
  if (!existing) return { error: "Pre-made item not found." };

  if (existing.woo_product_id) {
    try {
      await deleteWooProduct(String(existing.woo_product_id), true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to delete Woo product.";
      return { error: message };
    }
  }

  const { error: deleteError } = await client.from("premade_candies").delete().eq("id", id);
  if (deleteError) return { error: deleteError.message };

  if (existing.image_path) {
    const { error: storageError } = await client.storage.from(PREMADE_IMAGE_BUCKET).remove([existing.image_path]);
    if (storageError) return { error: storageError.message };
  }

  revalidatePremadePaths([
    buildPremadeItemPath(existing as PremadeCandy),
    buildPremadeLegacyItemPath(existing as PremadeCandy),
  ]);
  await logAdminActivity({
    area: "products",
    action: "deleted",
    entityType: "premade-product",
    entityId: existing.id,
    entityLabel: existing.name,
    summary: `Deleted pre-made product "${existing.name}".`,
    path: "/admin/premade",
    changedFields: ["Pre-made product"],
  });

  return { error: null };
}
