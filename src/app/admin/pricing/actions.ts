"use server";

import { requireAdminWriteAccess } from "@/lib/adminAuth";
import { supabaseServerClient } from "@/lib/supabase/server";
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

  const client = supabaseServerClient;
  if (id) {
    const { error } = await client
      .from("weight_tiers")
      .update({ category_id, min_kg, max_kg, price, per_kg, notes })
      .eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await client
      .from("weight_tiers")
      .insert({ category_id, min_kg, max_kg, price, per_kg, notes });
    if (error) throw new Error(error.message);
  }
  redirect("/admin/pricing?edit=1");
}

export async function deleteTier(formData: FormData) {
  await requireAdminWriteAccess({ onDenied: "redirect", redirectTo: "/admin/pricing?edit=1" });
  const id = formData.get("id")?.toString();
  if (!id) throw new Error("Missing id");
  const client = supabaseServerClient;
  const { error } = await client.from("weight_tiers").delete().eq("id", id);
  if (error) throw new Error(error.message);
  redirect("/admin/pricing?edit=1");
}
