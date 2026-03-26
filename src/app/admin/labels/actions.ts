"use server";

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
    const { error } = await client
      .from("label_ranges")
      .update({ upper_bound, range_cost: nextRangeCost })
      .eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await client.from("label_ranges").insert({
      upper_bound,
      range_cost: Number.isFinite(range_cost) ? range_cost : 0,
    });
    if (error) throw new Error(error.message);
  }

  redirect("/admin/labels");
}

export async function deleteLabelRange(formData: FormData) {
  await requireAdminWriteAccess({ onDenied: "redirect", redirectTo: "/admin/labels" });
  const id = formData.get("id")?.toString();
  if (!id) throw new Error("Missing id");
  const client = supabaseAdminClient;
  const { error } = await client.from("label_ranges").delete().eq("id", id);
  if (error) throw new Error(error.message);
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
  redirect("/admin/labels");
}
