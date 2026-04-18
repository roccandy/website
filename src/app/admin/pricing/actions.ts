"use server";

import { getChangedFieldLabels, logAdminActivity } from "@/lib/adminActivity";
import { requireAdminWriteAccess } from "@/lib/adminAuth";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getSettings } from "@/lib/data";

export async function upsertTier(formData: FormData) {
  await requireAdminWriteAccess({ onDenied: "redirect", redirectTo: "/admin/pricing?edit=1" });
  const id = formData.get("id")?.toString() || undefined;
  const category_id = formData.get("category_id")?.toString();
  const min_kg = Number(formData.get("min_kg"));
  const max_kg = Number(formData.get("max_kg"));
  const price = Number(formData.get("price"));
  const per_kg = formData.get("per_kg") === "on";
  const notes = formData.get("notes")?.toString() || null;

  if (!category_id) throw new Error("Missing category");
  const { max_total_kg } = await getSettings();
  if (min_kg > max_total_kg || max_kg > max_total_kg) {
    throw new Error(`Max weight per settings is ${max_total_kg} kg.`);
  }

  const client = supabaseAdminClient;
  const existingTier = id
    ? (await client.from("weight_tiers").select("id,category_id,min_kg,max_kg,price,per_kg,notes").eq("id", id).maybeSingle()).data
    : null;
  if (id) {
    const { data, error } = await client
      .from("weight_tiers")
      .update({ category_id, min_kg, max_kg, price, per_kg, notes })
      .eq("id", id)
      .select("id,category_id,min_kg,max_kg,price,per_kg,notes")
      .single();
    if (error) throw new Error(error.message);
    await logAdminActivity({
      area: "commercial",
      action: "updated",
      entityType: "weight-tier",
      entityId: data?.id ?? id,
      entityLabel: data?.category_id ?? category_id,
      summary: `Updated pricing tier for ${data?.category_id ?? category_id}.`,
      path: "/admin/pricing?edit=1",
      changedFields: getChangedFieldLabels(
        {
          category_id: existingTier?.category_id ?? null,
          min_kg: existingTier?.min_kg ?? null,
          max_kg: existingTier?.max_kg ?? null,
          price: existingTier?.price ?? null,
          per_kg: existingTier?.per_kg ?? null,
          notes: existingTier?.notes ?? null,
        },
        {
          category_id: data?.category_id ?? category_id,
          min_kg: data?.min_kg ?? min_kg,
          max_kg: data?.max_kg ?? max_kg,
          price: data?.price ?? price,
          per_kg: data?.per_kg ?? per_kg,
          notes: data?.notes ?? notes,
        },
        {
          category_id: "Category",
          min_kg: "Min kg",
          max_kg: "Max kg",
          price: "Price",
          per_kg: "Per kg pricing",
          notes: "Notes",
        },
      ),
    });
  } else {
    const { data, error } = await client
      .from("weight_tiers")
      .insert({ category_id, min_kg, max_kg, price, per_kg, notes })
      .select("id,category_id")
      .single();
    if (error) throw new Error(error.message);
    await logAdminActivity({
      area: "commercial",
      action: "created",
      entityType: "weight-tier",
      entityId: data?.id ?? null,
      entityLabel: data?.category_id ?? category_id,
      summary: `Added pricing tier for ${category_id}.`,
      path: "/admin/pricing?edit=1",
      changedFields: ["Category", "Min kg", "Max kg", "Price"],
    });
  }
  redirect("/admin/pricing?edit=1");
}

export async function deleteTier(formData: FormData) {
  await requireAdminWriteAccess({ onDenied: "redirect", redirectTo: "/admin/pricing?edit=1" });
  const id = formData.get("id")?.toString();
  if (!id) throw new Error("Missing id");
  const client = supabaseAdminClient;
  const { data: existing } = await client.from("weight_tiers").select("id,category_id").eq("id", id).maybeSingle();
  const { error } = await client.from("weight_tiers").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await logAdminActivity({
    area: "commercial",
    action: "deleted",
    entityType: "weight-tier",
    entityId: existing?.id ?? id,
    entityLabel: existing?.category_id ?? "Pricing tier",
    summary: `Deleted pricing tier${existing?.category_id ? ` for ${existing.category_id}` : ""}.`,
    path: "/admin/pricing?edit=1",
    changedFields: ["Pricing tier"],
  });
  redirect("/admin/pricing?edit=1");
}
