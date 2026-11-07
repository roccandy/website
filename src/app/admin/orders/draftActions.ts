"use server";
import { requireAdminWriteAccess } from "@/lib/adminAuth";
import { supabaseAdminClient as db } from "@/lib/supabase/admin";
import { revalidateAdminPath } from "@/lib/adminRevalidation";
import { isDraftUuid, orderDraftSourceFingerprint, parseAdminOrderDraftPayload } from "@/lib/adminOrderDrafts";
import type { OrderRow } from "@/lib/data";
import { logAdminActivity } from "@/lib/adminActivity";

export async function saveOrderDraft(input: { id: string; revision: number; sourceOrderId: string | null; sourceFingerprint: string | null; payload: unknown }) {
  try {
    const session = await requireAdminWriteAccess();
    if (!isDraftUuid(input.id) || (input.sourceOrderId && !isDraftUuid(input.sourceOrderId))) throw new Error("Invalid draft reference.");
    const payload = parseAdminOrderDraftPayload(input.payload);
    if (input.sourceOrderId) {
      const { data, error } = await db.from("orders").select("*").eq("id", input.sourceOrderId).single();
      if (error || !data) throw new Error("The original order could not be loaded.");
      if (orderDraftSourceFingerprint(data as OrderRow) !== input.sourceFingerprint)
        throw new Error("The original order has changed. Reopen it before saving draft changes.");
      if (payload.orders.length !== 1) throw new Error("An existing order draft must contain one order.");
    }
    const { data, error } = await db.rpc("save_admin_order_draft", { p_id: input.id, p_revision: input.revision, p_source_order_id: input.sourceOrderId, p_source_fingerprint: input.sourceFingerprint, p_payload: payload, p_actor: session.user.email ?? "admin" });
    if (error || !data) throw new Error(error?.code === "23505" ? "This order already has a saved draft. Resume it from the schedule." : error?.message || "Unable to save draft.");
    revalidateAdminPath("/admin/orders");
    await logAdminActivity({ area: "operations", action: "saved", entityType: "order-draft", entityId: data.id, entityLabel: data.title, summary: "Saved unfinished order draft. Nothing sent to customer.", path: "/admin/orders" });
    return { ok: true as const, id: data.id as string, revision: data.revision as number, updatedAt: data.updated_at as string };
  } catch (error) { return { ok: false as const, error: error instanceof Error ? error.message : "Unable to save draft. Your changes are still open." }; }
}

export async function discardOrderDraft(id: string, revision: number) {
  try {
    await requireAdminWriteAccess();
    if (!isDraftUuid(id)) throw new Error("Invalid draft reference.");
    const { data, error } = await db.from("admin_order_drafts").update({ discarded_at: new Date().toISOString() })
      .eq("id", id).eq("revision", revision).is("publishing_at", null).is("completed_at", null).is("discarded_at", null).select("id").maybeSingle();
    if (error || !data) throw new Error("The draft changed or is being submitted. Refresh the schedule before discarding.");
    revalidateAdminPath("/admin/orders");
    await logAdminActivity({ area: "operations", action: "discarded", entityType: "order-draft", entityId: id, summary: "Discarded order draft. Live orders unchanged.", path: "/admin/orders" });
    return { ok: true as const };
  } catch (error) { return { ok: false as const, error: error instanceof Error ? error.message : "Unable to discard draft." }; }
}
