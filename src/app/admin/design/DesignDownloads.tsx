"use client";

import { useState } from "react";
import type { CandyDesign } from "@/lib/candyDesign";

/** Download the order's snapshot directly; opening or editing the library is unnecessary. */
export function DesignDownloads({ design }: { design: CandyDesign }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const download = async (format: "png" | "pdf" | "svg") => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/design/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ design, format }),
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(
          payload.error || "The artwork could not be downloaded.",
        );
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `${design.name.replace(/[^a-z0-9_-]/gi, "-")}.${format}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to export artwork. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2 print:hidden">
      <div className="flex flex-wrap gap-2">
        {(["png", "pdf", "svg"] as const).map((format) => (
          <button
            type="button"
            key={format}
            disabled={busy}
            onClick={() => void download(format)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 disabled:opacity-40"
          >
            Download design {format.toUpperCase()}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-xs text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}
