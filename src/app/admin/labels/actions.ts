"use server";

import { getChangedFieldLabels, logAdminActivity } from "@/lib/adminActivity";
import { requireAdminWriteAccess } from "@/lib/adminAuth";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export async function upsertLabelRange(formData: FormData) {
  await requireAdminWriteAccess({ onDenied: "redirect", redirectTo: "/admin/labels" });
  const id = formData.get("id")?.toString() || undefined;
  const upper_bound = Number(formData.get("upper_bound"));
  const range_cost_raw = formData.get("range_cost");
  const range_cost = range_cost_raw === null ? Number.NaN : Number(range_cost_raw);

  const client = supabaseAdminClient;
  const existingRange = id
    ? (await client.from("label_ranges").select("id,upper_bound,range_cost").eq("id", id).maybeSingle()).data
    : null;
  if (id) {
    let nextRangeCost = range_cost;
    if (!Number.isFinite(nextRangeCost)) {
      const { data: existing, error: existingError } = await client
        .from("label_ranges")
        .select("range_cost")
        .eq("id", id)
        .single();
      if (existingError) throw new Error(existingError.message);
      nextRangeCost = Number(existing?.range_cost ?? 0);
    }
    const { data, error } = await client
      .from("label_ranges")
      .update({ upper_bound, range_cost: nextRangeCost })
      .eq("id", id)
      .select("id,upper_bound,range_cost")
      .single();
    if (error) throw new Error(error.message);
    await logAdminActivity({
      area: "commercial",
      action: "updated",
      entityType: "label-range",
      entityId: data?.id ?? id,
      entityLabel: `Up to ${data?.upper_bound ?? upper_bound} labels`,
      summary: `Updated label pricing range up to ${data?.upper_bound ?? upper_bound} labels.`,
      path: "/admin/labels",
      changedFields: getChangedFieldLabels(
        {
          upper_bound: existingRange?.upper_bound ?? null,
          range_cost: existingRange?.range_cost ?? null,
        },
        {
          upper_bound: data?.upper_bound ?? upper_bound,
          range_cost: data?.range_cost ?? nextRangeCost,
        },
        {
          upper_bound: "Upper bound",
          range_cost: "Range cost",
        },
      ),
    });
  } else {
    const insertedCost = Number.isFinite(range_cost) ? range_cost : 0;
    const { data, error } = await client.from("label_ranges").insert({
      upper_bound,
      range_cost: insertedCost,
    }).select("id,upper_bound,range_cost").single();
    if (error) throw new Error(error.message);
    await logAdminActivity({
      area: "commercial",
      action: "created",
      entityType: "label-range",
      entityId: data?.id ?? null,
      entityLabel: `Up to ${data?.upper_bound ?? upper_bound} labels`,
      summary: `Added label pricing range up to ${data?.upper_bound ?? upper_bound} labels.`,
      path: "/admin/labels",
      changedFields: ["Upper bound", "Range cost"],
    });
  }

  redirect("/admin/labels");
}

export async function deleteLabelRange(formData: FormData) {
  await requireAdminWriteAccess({ onDenied: "redirect", redirectTo: "/admin/labels" });
  const id = formData.get("id")?.toString();
  if (!id) throw new Error("Missing id");
  const client = supabaseAdminClient;
  const { data: existing } = await client.from("label_ranges").select("id,upper_bound").eq("id", id).maybeSingle();
  const { error } = await client.from("label_ranges").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await logAdminActivity({
    area: "commercial",
    action: "deleted",
    entityType: "label-range",
    entityId: existing?.id ?? id,
    entityLabel: existing?.upper_bound ? `Up to ${existing.upper_bound} labels` : "Label range",
    summary: `Deleted label pricing range${existing?.upper_bound ? ` up to ${existing.upper_bound} labels` : ""}.`,
    path: "/admin/labels",
    changedFields: ["Label range"],
  });
  redirect("/admin/labels");
}

export async function updateLabelSettings(formData: FormData) {
  await requireAdminWriteAccess({ onDenied: "redirect", redirectTo: "/admin/labels" });
  const labels_supplier_shipping = Number(formData.get("labels_supplier_shipping"));
  const labels_markup_multiplier = Number(formData.get("labels_markup_multiplier"));
  const labels_max_bulk = Number(formData.get("labels_max_bulk"));
  const client = supabaseAdminClient;
  const { error } = await client
    .from("settings")
    .update({ labels_supplier_shipping, labels_markup_multiplier, labels_max_bulk })
    .eq("id", 1);
  if (error) throw new Error(error.message);
  await logAdminActivity({
    area: "commercial",
    action: "updated",
    entityType: "label-settings",
    entityLabel: "Label settings",
    summary: "Updated label pricing settings.",
    path: "/admin/labels",
    changedFields: ["Supplier shipping", "Markup multiplier", "Bulk limit"],
  });
  redirect("/admin/labels");
}

export async function updateIngredientLabelSettings(formData: FormData) {
  await requireAdminWriteAccess({ onDenied: "redirect", redirectTo: "/admin/labels" });
  const ingredientLabelPrice = Number(formData.get("ingredient_label_price"));
  const ingredientLabelTypeIdRaw = formData.get("ingredient_label_type_id")?.toString().trim() ?? "";
  const client = supabaseAdminClient;
  const { error } = await client
    .from("settings")
    .update({
      ingredient_label_price: Number.isFinite(ingredientLabelPrice) ? ingredientLabelPrice : 0,
      ingredient_label_type_id: ingredientLabelTypeIdRaw || null,
    })
    .eq("id", 1);
  if (error) throw new Error(error.message);
  await logAdminActivity({
    area: "commercial",
    action: "updated",
    entityType: "ingredient-label-settings",
    entityLabel: "Ingredient label settings",
    summary: "Updated ingredient label settings.",
    path: "/admin/labels",
    changedFields: ["Ingredient label price", "Ingredient label type"],
  });
  redirect("/admin/labels");
}
