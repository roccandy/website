"use client";

import type { ImageOptimizationSummary } from "@/lib/clientImageOptimization";
import { formatBytes } from "@/lib/clientImageOptimization";

export function ImageOptimizationStatus({
  summary,
  pendingLabel,
  helperText,
}: {
  summary: ImageOptimizationSummary | null;
  pendingLabel?: string | null;
  helperText?: string | null;
}) {
  if (!summary && !pendingLabel && !helperText) return null;

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] text-zinc-600">
      {pendingLabel ? <p className="font-semibold text-zinc-900">{pendingLabel}</p> : null}
      {summary ? (
        <div className="space-y-1">
          <p>
            Original: {summary.originalType} • {formatBytes(summary.originalBytes)}
          </p>
          <p>
            Stored as: {summary.finalType} • {formatBytes(summary.finalBytes)}
          </p>
        </div>
      ) : null}
      {helperText ? <p>{helperText}</p> : null}
    </div>
  );
}
