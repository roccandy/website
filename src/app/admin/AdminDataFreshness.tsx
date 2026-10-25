"use client";

import { useEffect, useRef, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { isAdminReadView,isAdminWriteForm } from "./adminRoutePolicy";
import { draftFingerprint } from "./adminFormDraft";

/** Reused/prefetched pages stay quick, but old operational data refreshes quietly. */
export function AdminDataFreshness({ loadedAt }: { loadedAt: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const readView = isAdminReadView(`${pathname}?${search}`);
  const [pending, startTransition] = useTransition();
  const lastAttempt = useRef(0);
  const formBaselines = useRef(new Map<HTMLFormElement,string>());
  useEffect(() => { formBaselines.current.clear(); }, [pathname,search]);
  useEffect(() => {
    if (!readView) return;
    let refreshing = false;
    let dragging = false;
    const dragStart = () => { dragging = true; };
    const dragEnd = () => { dragging = false; };
    const rememberForm = (event: Event) => {
      const form = event.target instanceof Element ? event.target.closest<HTMLFormElement>("form") : null;
      if (form && isAdminWriteForm(form.method,form.getAttribute("action"),Boolean(form.querySelector('input[name^="$ACTION_"]'))) && !formBaselines.current.has(form)) formBaselines.current.set(form,draftFingerprint(new FormData(form)));
    };
    const hasDraft = () => {
      let dirty = false;
      formBaselines.current.forEach((baseline,form) => {
        if (!form.isConnected) formBaselines.current.delete(form);
        else if (draftFingerprint(new FormData(form)) !== baseline) dirty = true;
      });
      return dirty;
    };
    const refresh = () => {
      if (refreshing || dragging || pending || hasDraft() || document.activeElement?.matches("input,textarea,select,[contenteditable='true']") || Date.now() - lastAttempt.current < 30_000 || document.visibilityState !== "visible" || Date.now() - Date.parse(loadedAt) < 30_000 || document.querySelector("[data-admin-unsaved], [aria-busy='true'], dialog[open], [role='dialog']")) return;
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
    document.addEventListener("focusin",rememberForm,true);
    document.addEventListener("pointerdown",rememberForm,true);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); document.removeEventListener("dragstart", dragStart); document.removeEventListener("dragend", dragEnd); document.removeEventListener("drop", dragEnd); document.removeEventListener("focusin",rememberForm,true); document.removeEventListener("pointerdown",rememberForm,true); };
  }, [loadedAt, pending, router, readView]);
  return null;
}
