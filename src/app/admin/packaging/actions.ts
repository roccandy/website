"use server";

import { appendAdminToast, requireAdminWriteAccess } from "@/lib/adminAuth";
import {
  isOptimizableWebImageMimeType,
  optimizeServerImageToWebp,
} from "@/lib/serverImageOptimization";
import { supabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const PACKAGING_IMAGE_BUCKET = "packaging-images";
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

function parseList(input: string | null) {
  if (!input) return [];
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeFileName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-");
}

function normalizeToken(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
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

function buildComboKey(type: string, size: string, categoryId: string, lidColor: string) {
  const orderPrefix = resolveOrderPrefix(categoryId);
  const typeSlug = resolvePackagingTypeSlug(type);
  const sizeSlug = resolvePackagingSizeSlug(typeSlug, size);
  const lidSlug = lidColor ? normalizeToken(lidColor) : "";
  const parts = [orderPrefix, typeSlug, sizeSlug, lidSlug].filter(Boolean);
  return parts.join("_");
}

function isMissingDimensionsColumnError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("dimensions") && (normalized.includes("column") || normalized.includes("schema cache"));
}

function isMissingTypeSortOrderColumnError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("type_sort_order") && (normalized.includes("column") || normalized.includes("schema cache"));
}

function stripUnsupportedPackagingColumns<T extends Record<string, unknown>>(payload: T, message: string) {
  const next = { ...payload } as Record<string, unknown>;
  if (isMissingDimensionsColumnError(message)) {
    delete next.dimensions;
  }
  if (isMissingTypeSortOrderColumnError(message)) {
    delete next.type_sort_order;
  }
  return next as Partial<T>;
}

export async function upsertPackaging(formData: FormData) {
  await requireAdminWriteAccess({ onDenied: "redirect", redirectTo: "/admin/packaging" });
  try {
    const id = formData.get("id")?.toString() || undefined;
    const type = formData.get("type")?.toString();
    const size = formData.get("size")?.toString();
    const dimensions = formData.get("dimensions")?.toString().trim() || null;
    const candy_weight_g = Number(formData.get("candy_weight_g"));
    const allowed_categories = parseList(formData.get("allowed_categories")?.toString() ?? "");
    const lid_colors = parseList(formData.get("lid_colors")?.toString() ?? "");
    const label_type_ids = parseList(formData.get("label_type_ids")?.toString() ?? "");
    const unit_price = Number(formData.get("unit_price"));
    const max_packages = Number(formData.get("max_packages"));
    const type_sort_order = Number(formData.get("type_sort_order"));

    if (!type || !size) throw new Error("Missing type or size");
    const isJar = type.toLowerCase().includes("jar");
    const normalizedLids = isJar ? lid_colors : [];

    const client = supabaseServerClient;
    const payload = {
      type,
      size,
      dimensions,
      candy_weight_g,
      allowed_categories,
      lid_colors: normalizedLids,
      label_type_ids,
      unit_price,
      max_packages,
      type_sort_order: Number.isFinite(type_sort_order) ? type_sort_order : 0,
    };
    if (id) {
      const result = await client.from("packaging_options").update(payload).eq("id", id);
      if (result.error) {
        if (
          !isMissingDimensionsColumnError(result.error.message) &&
          !isMissingTypeSortOrderColumnError(result.error.message)
        ) {
          throw new Error(result.error.message);
        }
        const fallbackPayload = stripUnsupportedPackagingColumns(payload, result.error.message);
        const legacyResult = await client.from("packaging_options").update(fallbackPayload).eq("id", id);
        if (legacyResult.error) throw new Error(legacyResult.error.message);
      }
    } else {
      const result = await client.from("packaging_options").insert(payload);
      if (result.error) {
        if (
          !isMissingDimensionsColumnError(result.error.message) &&
          !isMissingTypeSortOrderColumnError(result.error.message)
        ) {
          throw new Error(result.error.message);
        }
        const fallbackPayload = stripUnsupportedPackagingColumns(payload, result.error.message);
        const legacyResult = await client.from("packaging_options").insert(fallbackPayload);
        if (legacyResult.error) throw new Error(legacyResult.error.message);
      }
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save packaging.";
    redirect(appendAdminToast("/admin/packaging", "error", message));
  }
  redirect(appendAdminToast("/admin/packaging", "success", "Packaging saved."));
}

export async function updatePackagingTypeOrder(formData: FormData) {
  await requireAdminWriteAccess({ onDenied: "redirect", redirectTo: "/admin/packaging" });

  const orderedTypesRaw = formData.get("ordered_types")?.toString() ?? "[]";
  let orderedTypes: string[] = [];

  try {
    const parsed = JSON.parse(orderedTypesRaw);
    if (Array.isArray(parsed)) {
      orderedTypes = parsed.map((value) => String(value).trim()).filter(Boolean);
    }
  } catch {
    throw new Error("Invalid packaging type order payload");
  }

  if (orderedTypes.length === 0) {
    redirect("/admin/packaging");
  }

  const client = supabaseServerClient;
  const { data: existing, error: existingError } = await client.from("packaging_options").select("type");
  if (existingError) throw new Error(existingError.message);

  const remainingTypes = Array.from(
    new Set((existing ?? []).map((row) => row.type).filter((value): value is string => Boolean(value)))
  ).filter((type) => !orderedTypes.includes(type));

  const finalOrder = [...orderedTypes, ...remainingTypes];

  for (const [index, type] of finalOrder.entries()) {
    const { error } = await client
      .from("packaging_options")
      .update({ type_sort_order: index })
      .eq("type", type);
    if (error) {
      if (isMissingTypeSortOrderColumnError(error.message)) {
        redirect(
          appendAdminToast(
            "/admin/packaging",
            "error",
            "Packaging type ordering needs the 2026-03-11 type_sort_order SQL migration run in Supabase."
          )
        );
      }
      throw new Error(error.message);
    }
  }

  revalidatePath("/admin/packaging");
  redirect("/admin/packaging");
}

export async function deletePackaging(formData: FormData) {
  await requireAdminWriteAccess({ onDenied: "redirect", redirectTo: "/admin/packaging" });
  try {
    const id = formData.get("id")?.toString();
    if (!id) throw new Error("Missing id");
    const client = supabaseServerClient;
    const { error } = await client.from("packaging_options").delete().eq("id", id);
    if (error) throw new Error(error.message);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete packaging.";
    redirect(appendAdminToast("/admin/packaging", "error", message));
  }
  redirect(appendAdminToast("/admin/packaging", "success", "Packaging deleted."));
}

export async function uploadPackagingImage(formData: FormData) {
  await requireAdminWriteAccess({ onDenied: "redirect", redirectTo: "/admin/packaging" });
  const file = formData.get("image") as File | null;
  if (file?.size === 0) {
    redirect("/admin/packaging");
  }
  try {
    const packagingOptionId = formData.get("packaging_option_id")?.toString();
    const categoryId = formData.get("category_id")?.toString();
    const lidColor = formData.get("lid_color")?.toString() ?? "";

    if (!packagingOptionId || !categoryId || !file) {
      throw new Error("Missing image upload data");
    }
    if (file.type && !isOptimizableWebImageMimeType(file.type)) {
      throw new Error("Only PNG, JPG, and WEBP images are supported.");
    }

    const client = supabaseServerClient;
    const { data: option, error: optionError } = await client
      .from("packaging_options")
      .select("type,size")
      .eq("id", packagingOptionId)
      .single();
    if (optionError || !option) throw new Error(optionError?.message ?? "Packaging option not found");

    const comboKey = buildComboKey(option.type, option.size, categoryId, lidColor);
    const fileName = normalizeFileName(`${comboKey}.webp`);
    const optimized = await optimizeServerImageToWebp(file, {
      maxWidth: 1800,
      maxHeight: 1800,
      quality: 82,
    });

    const { error: uploadError } = await client.storage
      .from(PACKAGING_IMAGE_BUCKET)
      .upload(fileName, optimized.buffer, { contentType: optimized.contentType, upsert: true });
    if (uploadError) throw new Error(uploadError.message);

    const { error: upsertError } = await client.from("packaging_option_images").upsert(
      {
        packaging_option_id: packagingOptionId,
        category_id: categoryId,
        lid_color: lidColor,
        image_path: fileName,
      },
      { onConflict: "packaging_option_id,category_id,lid_color" }
    );
    if (upsertError) throw new Error(upsertError.message);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload packaging image.";
    redirect(appendAdminToast("/admin/packaging", "error", message));
  }
  redirect(appendAdminToast("/admin/packaging", "success", "Packaging image saved."));
}
