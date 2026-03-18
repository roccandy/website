"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import {
  analyzeImageOptimization,
  type ImageOptimizationSummary,
} from "@/lib/clientImageOptimization";
import { ImageOptimizationStatus } from "./ImageOptimizationStatus";

function PendingOptimizationStatus() {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <ImageOptimizationStatus
      summary={null}
      pendingLabel="Optimising and uploading image..."
      helperText="The file is being converted to an optimised WEBP for the website."
    />
  );
}

export function OptimizedImageFileInput({
  name,
  label,
  accept,
  required = false,
  className = "block w-full text-sm",
  helperText = "This upload is stored as an optimised WEBP for the website.",
  maxWidth,
  maxHeight,
  quality,
}: {
  name: string;
  label: string;
  accept: string;
  required?: boolean;
  className?: string;
  helperText?: string;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}) {
  const [summary, setSummary] = useState<ImageOptimizationSummary | null>(null);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <label className="space-y-1 text-sm text-zinc-700">
        <span className="text-xs text-zinc-500">{label}</span>
        <input
          type="file"
          name={name}
          accept={accept}
          required={required}
          className={className}
          onChange={async (event) => {
            const file = event.currentTarget.files?.[0];
            setSummary(null);
            setAnalysisError(null);
            if (!file) return;
            setIsAnalysing(true);
            try {
              const nextSummary = await analyzeImageOptimization(file, {
                maxWidth,
                maxHeight,
                quality,
              });
              setSummary(nextSummary);
            } catch {
              setAnalysisError("Unable to calculate optimised image details.");
            } finally {
              setIsAnalysing(false);
            }
          }}
        />
      </label>
      {isAnalysing ? (
        <ImageOptimizationStatus
          summary={null}
          pendingLabel="Calculating optimised image details..."
          helperText={helperText}
        />
      ) : summary ? (
        <ImageOptimizationStatus summary={summary} helperText={helperText} />
      ) : analysisError ? (
        <ImageOptimizationStatus summary={null} helperText={analysisError} />
      ) : null}
      <PendingOptimizationStatus />
    </div>
  );
}
