"use server";

import { requireAdminWriteAccess } from "@/lib/adminAuth";
import { supabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const PATH = "/admin/flavors";

export async function insertFlavor(name: string): Promise<{ error: string | null }> {
  try {
    await requireAdminWriteAccess();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to add flavor." };
  }
  const trimmed = name?.toString().trim();
  if (!trimmed) return { error: "Flavor name required." };

  const client = supabaseServerClient;
  const latest = await client
    .from("flavors")
    .select("sort_order")
    .order("sort_order", { ascending: false, nullsFirst: false })
    .limit(1);
  const latestSort = !latest.error ? Number(latest.data?.[0]?.sort_order ?? -1) : -1;
  const payload =
    Number.isFinite(latestSort) && latestSort >= -1
      ? { name: trimmed, sort_order: latestSort + 1 }
      : { name: trimmed };
  const { error } = await client.from("flavors").insert(payload);
  if (error) return { error: error.message };
  return { error: null };
}

export async function deleteFlavor(formData: FormData) {
  await requireAdminWriteAccess({ onDenied: "redirect", redirectTo: PATH });
  const id = formData.get("id")?.toString();
  if (!id) throw new Error("Missing id");
  const client = supabaseServerClient;
  const { error } = await client.from("flavors").delete().eq("id", id);
  if (error) throw new Error(error.message);
  redirect(PATH);
}

export async function toggleFlavorActive(formData: FormData) {
  await requireAdminWriteAccess({ onDenied: "redirect", redirectTo: PATH });
  const id = formData.get("id")?.toString();
  if (!id) throw new Error("Missing id");
  const nextActiveRaw = formData.get("next_active")?.toString().trim().toLowerCase();
  const nextActive = nextActiveRaw === "true";

  const client = supabaseServerClient;
  const { error } = await client.from("flavors").update({ is_active: nextActive }).eq("id", id);
  if (error) throw new Error(error.message);
  redirect(PATH);
}

export async function updateFlavorOrder(
  updates: { id: string; sortOrder: number }[]
): Promise<{ error: string | null }> {
  try {
    await requireAdminWriteAccess();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to save flavor order." };
  }
  if (!Array.isArray(updates) || updates.length === 0) return { error: null };

  const client = supabaseServerClient;
  try {
    for (const update of updates) {
      const id = update.id?.toString().trim();
      if (!id) continue;
      const sortOrder = Number.isFinite(update.sortOrder) ? Math.max(0, Math.floor(update.sortOrder)) : 0;
      const { error } = await client.from("flavors").update({ sort_order: sortOrder }).eq("id", id);
      if (error) throw error;
    }
    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to save flavor order." };
  }
}
