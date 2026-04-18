"use server";

import { logAdminActivity } from "@/lib/adminActivity";
import { requireAdminWriteAccess } from "@/lib/adminAuth";
import { supabaseAdminClient } from "@/lib/supabase/admin";
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

  const client = supabaseAdminClient;
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
  const { data, error } = await client.from("flavors").insert(payload).select("id,name").single();
  if (error) return { error: error.message };
  await logAdminActivity({
    area: "products",
    action: "created",
    entityType: "flavor",
    entityId: data?.id ?? null,
    entityLabel: data?.name ?? trimmed,
    summary: `Added flavor "${data?.name ?? trimmed}".`,
    path: PATH,
    changedFields: ["Flavor name"],
  });
  return { error: null };
}

export async function deleteFlavor(formData: FormData) {
  await requireAdminWriteAccess({ onDenied: "redirect", redirectTo: PATH });
  const id = formData.get("id")?.toString();
  if (!id) throw new Error("Missing id");
  const client = supabaseAdminClient;
  const { data: existing } = await client.from("flavors").select("id,name").eq("id", id).maybeSingle();
  const { error } = await client.from("flavors").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await logAdminActivity({
    area: "products",
    action: "deleted",
    entityType: "flavor",
    entityId: existing?.id ?? id,
    entityLabel: existing?.name ?? "Flavor",
    summary: `Deleted flavor "${existing?.name ?? "Flavor"}".`,
    path: PATH,
    changedFields: ["Flavor"],
  });
  redirect(PATH);
}

export async function toggleFlavorActive(formData: FormData) {
  await requireAdminWriteAccess({ onDenied: "redirect", redirectTo: PATH });
  const id = formData.get("id")?.toString();
  if (!id) throw new Error("Missing id");
  const nextActiveRaw = formData.get("next_active")?.toString().trim().toLowerCase();
  const nextActive = nextActiveRaw === "true";

  const client = supabaseAdminClient;
  const { data: existing } = await client.from("flavors").select("id,name,is_active").eq("id", id).maybeSingle();
  const { error } = await client.from("flavors").update({ is_active: nextActive }).eq("id", id);
  if (error) throw new Error(error.message);
  await logAdminActivity({
    area: "products",
    action: "updated",
    entityType: "flavor",
    entityId: existing?.id ?? id,
    entityLabel: existing?.name ?? "Flavor",
    summary: `${nextActive ? "Activated" : "Deactivated"} flavor "${existing?.name ?? "Flavor"}".`,
    path: PATH,
    changedFields: ["Active state"],
  });
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

  const client = supabaseAdminClient;
  try {
    for (const update of updates) {
      const id = update.id?.toString().trim();
      if (!id) continue;
      const sortOrder = Number.isFinite(update.sortOrder) ? Math.max(0, Math.floor(update.sortOrder)) : 0;
      const { error } = await client.from("flavors").update({ sort_order: sortOrder }).eq("id", id);
      if (error) throw error;
    }
    await logAdminActivity({
      area: "products",
      action: "reordered",
      entityType: "flavor-library",
      entityLabel: "Flavors",
      summary: "Saved flavor order.",
      path: PATH,
      changedFields: ["Sort order"],
      metadata: {
        itemCount: updates.length,
      },
    });
    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to save flavor order." };
  }
}
