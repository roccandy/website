import "server-only";
import { supabaseAdminClient as db } from "@/lib/supabase/admin";
import { requireAdminSession, requireAdminWriteAccess } from "@/lib/adminAuth";
import { isDraftUuid, orderDraftSourceFingerprint, parseAdminOrderDraftPayload, type AdminOrderDraft } from "./adminOrderDrafts";
import type { OrderRow } from "./data";
import { revalidateAdminPath } from "./adminRevalidation";

export async function loadAdminOrderDraft(id: string): Promise<AdminOrderDraft | null> {
  await requireAdminSession();
  if (!isDraftUuid(id)) return null;
  const { data, error } = await db.from("admin_order_drafts").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error("Unable to load order drafts.");
  return data ? { ...data, payload: parseAdminOrderDraftPayload(data.payload) } : null;
}

export async function listAdminOrderDrafts() {
  await requireAdminSession();
  const { data, error } = await db.from("admin_order_drafts")
    .select("id,revision,source_order_id,title,customer_name,required_date,updated_at,publishing_at")
    .is("completed_at", null).is("discarded_at", null).order("updated_at", { ascending: false });
  if (error) throw new Error("Unable to load order drafts.");
  return data ?? [];
}

export type DraftPublication = { id: string; persisted: boolean };
export async function claimOrderDraft(formData: FormData): Promise<DraftPublication | null> {
  await requireAdminWriteAccess();
  const id = formData.get("order_draft_id")?.toString();
  if (!id) return null;
  const draft = await loadAdminOrderDraft(id);
  if (!draft || draft.completed_at || draft.discarded_at) throw new Error("This draft has already been completed or discarded. Check the schedule before continuing.");
  if (draft.publishing_at) throw new Error("This draft is already being submitted. Check the schedule before retrying.");
  const sourceId = formData.get("id")?.toString() || null;
  if (sourceId !== draft.source_order_id) throw new Error("This draft belongs to another order.");
  if (sourceId) {
    const { data, error } = await db.from("orders").select("*").eq("id", sourceId).single();
    if (error || !data || orderDraftSourceFingerprint(data as OrderRow) !== draft.source_fingerprint)
      throw new Error("The live order has changed since this draft was started. Compare it with the saved draft before applying changes.");
  }
  const revision = Number(formData.get("order_draft_revision"));
  const { data, error } = await db.from("admin_order_drafts").update({ publishing_at: new Date().toISOString() })
    .eq("id", id).eq("revision", revision).is("publishing_at", null).is("completed_at", null).is("discarded_at", null).select("id").maybeSingle();
  if (error || !data) throw new Error("This draft changed in another tab. Reopen it before submitting.");
  return { id, persisted: false };
}

export async function completeOrderDraft(claim: DraftPublication | null, ids: string[]) {
  if (!claim) return;
  // Set this before the network call: a lost response must never unlock a created order for retry.
  claim.persisted = true;
  // Even if invoice creation or draft completion later fails, show the saved order.
  revalidateAdminPath("/admin/orders");
  const { error } = await db.from("admin_order_drafts").update({ completed_at: new Date().toISOString(), published_order_ids: ids })
    .eq("id", claim.id).not("publishing_at", "is", null).is("completed_at", null);
  if (error) throw new Error("The order was saved, but its draft could not be closed. Check the schedule before retrying.");
}
export async function releaseOrderDraft(claim: DraftPublication | null) {
  if (!claim || claim.persisted) return;
  await db.from("admin_order_drafts").update({ publishing_at: null }).eq("id", claim.id).is("completed_at", null);
}
