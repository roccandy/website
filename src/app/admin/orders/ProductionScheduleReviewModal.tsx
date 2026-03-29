"use client";

type ProductionScheduleReviewModalProps = {
  open: boolean;
  message: string;
  onCancel: () => void;
  onUpdateSchedule: () => void;
};

export default function ProductionScheduleReviewModal({
  open,
  message,
  onCancel,
  onUpdateSchedule,
}: ProductionScheduleReviewModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Production schedule</p>
          <h4 className="text-lg font-semibold text-zinc-900">Schedule update required</h4>
          <p className="text-sm leading-relaxed text-zinc-600">{message}</p>
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
            onClick={onUpdateSchedule}
            className="rounded border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:border-blue-300"
          >
            Update production schedule
          </button>
        </div>
      </div>
    </div>
  );
}
