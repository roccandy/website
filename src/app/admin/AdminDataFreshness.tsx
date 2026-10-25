"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

/** Reused/prefetched pages stay quick, but old operational data refreshes quietly. */
export function AdminDataFreshness({ loadedAt }: { loadedAt: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const lastAttempt = useRef(0);
  useEffect(() => {
    let refreshing = false;
    let dragging = false;
    const dragStart = () => { dragging = true; };
    const dragEnd = () => { dragging = false; };
    const refresh = () => {
      if (refreshing || dragging || pending || document.activeElement?.matches("input,textarea,select,[contenteditable='true']") || Date.now() - lastAttempt.current < 30_000 || document.visibilityState !== "visible" || Date.now() - Date.parse(loadedAt) < 30_000 || document.querySelector("[data-admin-unsaved], [aria-busy='true'], dialog[open], [role='dialog']")) return;
      lastAttempt.current = Date.now();
      refreshing = true;
      startTransition(async () => {
        try { router.refresh(); } catch { /* Keep the current page usable while offline; retry later. */ } finally { refreshing = false; }
      });
    };
    const timer = window.setInterval(refresh, 30_000);
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    document.addEventListener("dragstart", dragStart);
    document.addEventListener("dragend", dragEnd);
    document.addEventListener("drop", dragEnd);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); document.removeEventListener("dragstart", dragStart); document.removeEventListener("dragend", dragEnd); document.removeEventListener("drop", dragEnd); };
  }, [loadedAt, pending, router]);
  return null;
}
