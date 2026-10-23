"use client";

import { AdminModalPortal } from "../AdminModalPortal";

type SplitOrderDecisionModalProps = {
  open: boolean;
  baseOrderNumber: string;
  companionLabel: string;
  companionActionLabel: string;
  onYes: () => void;
  onNo: () => void;
  onCancel: () => void;
};

export default function SplitOrderDecisionModal({
  open,
  baseOrderNumber,
  companionLabel,
  companionActionLabel,
  onYes,
  onNo,
  onCancel,
}: SplitOrderDecisionModalProps) {
  if (!open) return null;

  return (
    <AdminModalPortal onClose={onCancel}>
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
        onClick={onCancel}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Linked order items"
          className="max-h-[calc(100dvh-2rem)] w-full min-w-0 max-w-md overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl [overflow-wrap:anywhere]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Linked order items
            </p>
            <h4 className="admin-subsection-title text-zinc-900">
              Order #{baseOrderNumber} has multiple items
            </h4>
            <p className="text-sm leading-relaxed text-zinc-600">
              Would you like to mark{" "}
              <span className="font-semibold text-zinc-900">
                {companionLabel}
              </span>{" "}
              as{" "}
              <span className="font-semibold text-zinc-900">
                {companionActionLabel}
              </span>{" "}
              too?
            </p>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onNo}
              className="rounded border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:border-rose-300"
            >
              No
            </button>
            <button
              type="button"
              onClick={onYes}
              className="rounded border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:border-emerald-300"
            >
              Yes
            </button>
          </div>
        </div>
      </div>
    </AdminModalPortal>
  );
}
