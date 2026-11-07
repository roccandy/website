"use client";
import { useState } from "react";
import { AdminLink } from "../AdminNavigationFeedback";
import { adminDraftHref, type AdminOrderDraftSummary } from "@/lib/adminOrderDrafts";
import { discardOrderDraft } from "./draftActions";

export function OrderDraftsList({ drafts, canWrite }: { drafts: AdminOrderDraftSummary[]; canWrite: boolean }) {
  const [removed, setRemoved] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const visible = drafts.filter(draft => !removed.includes(draft.id));
  if (!visible.length) return null;
  return <section aria-label="Draft orders" className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
    <h2 className="text-base font-semibold text-amber-950">Draft orders · {visible.length}</h2>
    <p className="mt-1 text-xs text-amber-900">Not sent to customer. Drafts reserve no production capacity. Draft changes leave the live order unchanged until submitted.</p>
    {error && <p role="alert" className="mt-3 text-sm text-rose-800">{error}</p>}
    <ul className="mt-3 grid gap-3 md:grid-cols-2">{visible.map(draft => <li key={draft.id} className="rounded-lg border border-amber-200 bg-white p-3">
      <p className="text-xs font-semibold text-amber-800">{draft.publishing_at ? "Submission in progress — check orders before retrying" : draft.source_order_id ? "Draft changes — not sent" : "Draft — not sent to customer"}</p>
      <p className="mt-1 font-semibold text-zinc-900">{draft.title}</p>
      <p className="mt-1 text-xs text-zinc-600">{draft.customer_name || "Customer details unfinished"}{draft.required_date ? ` · Required ${draft.required_date}` : ""}</p>
      <p className="mt-1 text-xs text-zinc-500">Saved {new Date(draft.updated_at).toLocaleString("en-AU", { timeZone: "Australia/Perth" })}</p>
      <div className="mt-3 flex gap-4 text-xs font-semibold">
        {canWrite && !draft.publishing_at && <AdminLink href={adminDraftHref(draft)} className="underline">Resume draft</AdminLink>}
        {draft.source_order_id && <AdminLink href={`/admin/orders/${draft.source_order_id}`} className="underline">View live order</AdminLink>}
        {canWrite && !draft.publishing_at && <button type="button" disabled={busy !== null} className="text-rose-700 underline" onClick={async () => {
          if (!window.confirm("Discard this saved draft? The live order, if any, will remain unchanged.")) return;
          setBusy(draft.id); setError("");
          try { const result = await discardOrderDraft(draft.id, draft.revision); if (result.ok) setRemoved(ids => [...ids, draft.id]); else setError(result.error); }
          catch { setError("Unable to confirm discard. Refresh the schedule before retrying."); }
          finally { setBusy(null); }
        }}>Discard draft</button>}
      </div>
    </li>)}</ul>
  </section>;
}
