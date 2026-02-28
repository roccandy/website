"use server";

import type { PremadeCandy } from "@/lib/data";
import {
  DEFAULT_GOOGLE_PRODUCT_CATEGORY,
  DEFAULT_PREMADE_BRAND,
  DEFAULT_PRODUCT_CONDITION,
  DEFAULT_WOO_CATEGORY,
} from "@/lib/premadeDefaults";
import { supabaseServerClient } from "@/lib/supabase/server";
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

function normalizeExtension(extension: string) {
  const cleaned = extension.replace(".", "").toLowerCase();
  if (cleaned === "png" || cleaned === "jpg" || cleaned === "jpeg") return cleaned;
  return "";
}

function buildPremadeImageUrl(path?: string | null) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base || !path) return "";
  const encoded = encodeURIComponent(path);
  return `${base}/storage/v1/object/public/${PREMADE_IMAGE_BUCKET}/${encoded}`;
}

async function updateWooSyncStatus(
  client: typeof supabaseServerClient,
  id: string,
  patch: Partial<Pick<PremadeCandy, "woo_product_id" | "woo_sync_status" | "woo_last_sync_at" | "woo_sync_error">>
) {
  await client.from("premade_candies").update(patch).eq("id", id);
}

async function syncPremadeCandyToWoo(client: typeof supabaseServerClient, premade: PremadeCandy) {
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

export type PremadeUploadUrlResponse = {
  data: { path: string; token: string } | null;
  error: string | null;
};

export async function createPremadeUploadUrl(name: string, extension: string): Promise<PremadeUploadUrlResponse> {
  const trimmed = name?.toString().trim();
  const normalizedExt = normalizeExtension(extension);
  if (!trimmed) {
    return { data: null, error: "Name is required." };
  }
  if (!normalizedExt) {
    return { data: null, error: "Only PNG or JPG images are supported." };
  }

  const slug = normalizePremadeFileName(trimmed);
  const fileName = normalizeFileName(`${slug}-${Date.now()}.${normalizedExt}`);
  const client = supabaseServerClient;
  const { data, error } = await client.storage
    .from(PREMADE_IMAGE_BUCKET)
    .createSignedUploadUrl(fileName, { upsert: true });

  if (error || !data) {
    return { data: null, error: error?.message ?? "Unable to prepare upload." };
  }

  return { data: { path: data.path, token: data.token }, error: null };
}

export async function insertPremadeCandy(payload: {
  name: string;
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

  const client = supabaseServerClient;
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
  }
  return { error: null };
}

export async function updatePremadeCandy(payload: {
  id: string;
  name: string;
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

  const client = supabaseServerClient;
  const { data, error } = await client
    .from("premade_candies")
    .update(update)
    .eq("id", payload.id)
    .select("*")
    .single();
  if (error) return { error: error.message };
  if (data) {
    await syncPremadeCandyToWoo(client, data as PremadeCandy);
  }
  return { error: null };
}

export async function setPremadeActive(id: string, is_active: boolean): Promise<{ error: string | null }> {
  if (!id) return { error: "Missing item id." };
  const client = supabaseServerClient;
  const { data, error } = await client
    .from("premade_candies")
    .update({ is_active, availability: is_active ? "in_stock" : "out_of_stock" })
    .eq("id", id)
    .select("*")
    .single();
  if (error) return { error: error.message };
  if (data) {
    await syncPremadeCandyToWoo(client, data as PremadeCandy);
  }
  return { error: null };
}

export async function updatePremadeOrder(
  updates: { id: string; sort_order: number }[]
): Promise<{ error: string | null }> {
  if (!updates.length) return { error: null };
  const client = supabaseServerClient;
  for (const update of updates) {
    const { error } = await client
      .from("premade_candies")
      .update({ sort_order: update.sort_order })
      .eq("id", update.id);
    if (error) return { error: error.message };
  }
  return { error: null };
}

export async function syncPremadeToWoo(id: string): Promise<{ error: string | null }> {
  if (!id) return { error: "Missing item id." };
  const client = supabaseServerClient;
  const { data, error } = await client.from("premade_candies").select("*").eq("id", id).single();
  if (error || !data) return { error: error?.message ?? "Premade item not found." };
  const syncResult = await syncPremadeCandyToWoo(client, data as PremadeCandy);
  return { error: syncResult.error };
}

export async function syncAllPremadeToWoo(): Promise<{
  error: string | null;
  synced: number;
  failed: number;
  total: number;
}> {
  const client = supabaseServerClient;
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
  return { error: errorMessage, synced, failed, total: items.length };
}

export async function deletePremadeCandy(id: string): Promise<{ error: string | null }> {
  if (!id) return { error: "Missing item id." };
  const client = supabaseServerClient;
  const { data: existing, error: readError } = await client
    .from("premade_candies")
    .select("id,image_path,woo_product_id")
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

  return { error: null };
}
