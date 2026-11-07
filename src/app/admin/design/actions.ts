"use server";

import { requireAdminWriteAccess } from "@/lib/adminAuth";
import { parseCandyDesign } from "@/lib/candyDesign";
import { persistDesignAssets } from "@/lib/candyDesignExport";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { logAdminActivity } from "@/lib/adminActivity";
import { revalidatePath } from "next/cache";

export async function saveCandyDesign(input: unknown, copy = false) {
  try {
    const session = await requireAdminWriteAccess();
    const parsed = parseCandyDesign(input);
    if (!parsed) throw new Error("Add a design before saving.");
    const design = await persistDesignAssets(parsed);
    const source = copy ? undefined : design.source;
    const document = { ...design };
    delete document.source;
    const { data, error } = await supabaseAdminClient.rpc("save_candy_design", {
      p_id: source?.id ?? null,
      p_revision: source?.revision ?? 0,
      p_document: document,
      p_actor: session.user.email || "Admin",
    });
    if (error)
      throw new Error(
        error.message.includes("another tab")
          ? error.message
          : "Unable to save the design. Check the Design Studio migration has been applied, then try again.",
      );
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.id)
      throw new Error(
        "The save could not be confirmed. Your design is still open.",
      );
    const saved = {
      ...document,
      source: { id: String(row.id), revision: Number(row.revision) },
    };
    await logAdminActivity({
      area: "operations",
      action: source ? "updated" : "created",
      entityType: "candy-design",
      entityId: saved.source.id,
      entityLabel: design.name,
      summary: `Saved ${design.name}, revision ${saved.source.revision}.`,
      path: `/admin/design?design=${saved.source.id}`,
      changedFields: ["Candy design"],
    });
    revalidatePath("/admin/design");
    return { ok: true as const, design: saved };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Unable to save design. Your changes are still here.",
    };
  }
}
