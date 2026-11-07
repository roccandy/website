"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAdminNavigation } from "./AdminNavigationFeedback";
import { draftFingerprint } from "./adminFormDraft";
import { AdminNotice } from "./AdminNotice";
import { orderDraftGuards, type OrderDraftGuard } from "./orderDraftGuard";

export function formFingerprint(form: HTMLFormElement) {
  // Live quote results and submission metadata are not user edits. Otherwise
  // merely waiting for a quote can incorrectly make an untouched form dirty.
  return draftFingerprint(new FormData(form)) + (orderDraftGuards.get(form)?.state() ?? "");
}

/** All forms protect unsaved edits; order forms can also save a private server draft. */
export function AdminUnsavedChanges() {
  const navigation = useAdminNavigation();
  const pathname = usePathname();
  const forms = useRef(new Map<HTMLFormElement, string>());
  const [dirty, setDirty] = useState(false);
  const [leave, setLeave] = useState<null | (() => void)>(null);
  const [draftGuard, setDraftGuard] = useState<OrderDraftGuard | null>(null);
  const [busy, setBusy] = useState(false);
  const stay = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (leave) stay.current?.focus(); }, [leave]);

  useEffect(() => {
    const tracked = forms.current;
    const currentUrl = window.location.href;
    const currentHistoryState = window.history.state;
    const hasChanges = () => {
      let changed = false;
      tracked.forEach((baseline, form) => {
        if (!form.isConnected) tracked.delete(form);
        else if (formFingerprint(form) !== baseline) changed = true;
      });
      return changed;
    };
    const ask = (proceed: () => void) => {
      if (!hasChanges()) return false;
      window.dispatchEvent(new Event("admin:unsaved-prompt"));
      setDirty(true);
      const form = [...tracked].find(([form, baseline]) => form.isConnected && formFingerprint(form) !== baseline)?.[0];
      setDraftGuard(form ? orderDraftGuards.get(form) ?? null : null);
      setLeave(() => proceed);
      return true;
    };
    const baseline = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const form = target.closest<HTMLFormElement>("form[data-protect-unsaved]");
      if (form && !tracked.has(form)) tracked.set(form, formFingerprint(form));
    };
    const check = () => requestAnimationFrame(() => setDirty(hasChanges()));
    check();
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasChanges()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const beforeNavigate = (event: Event) => {
      const intent = event as CustomEvent<{ proceed: () => void }>;
      if (ask(intent.detail.proceed)) event.preventDefault();
    };
    const click = (event: MouseEvent) => {
      check();
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
      const next = new URL(link.href);
      if (next.href === window.location.href || (next.pathname === window.location.pathname && next.search === window.location.search && next.hash)) return;
      if (ask(() => {
        if (next.origin === location.origin && next.pathname.startsWith("/admin") && navigation) navigation.navigate(next.pathname + next.search + next.hash);
        else window.location.assign(next.href);
      })) { event.preventDefault(); event.stopPropagation(); }
    };
    const clear = (event: Event) => {
      const form = (event as CustomEvent<{form?: HTMLFormElement}>).detail?.form;
      if (form) { tracked.set(form, formFingerprint(form)); setDirty(hasChanges()); }
      else { tracked.clear(); setDirty(false); setLeave(null); }
    };
    const back = (event: PopStateEvent) => {
      if (!hasChanges() || ![...tracked.keys()].some(form => orderDraftGuards.has(form))) return;
      const target = window.location.href;
      if (target === currentUrl) return;
      // App Router cannot cancel popstate. Restore the form's history entry
      // before its listener runs, then navigate only after the user's choice.
      event.stopImmediatePropagation();
      window.history.pushState(currentHistoryState, "", currentUrl);
      ask(() => {
        tracked.clear(); setDirty(false); setLeave(null);
        const url = new URL(target);
        if (url.origin === location.origin && navigation) navigation.navigate(url.pathname + url.search + url.hash);
        else location.assign(target);
      });
    };
    document.addEventListener("pointerdown", baseline, true);
    document.addEventListener("focusin", baseline, true);
    document.addEventListener("input", check, true);
    document.addEventListener("change", check, true);
    document.addEventListener("click", click, true);
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("admin:before-navigation", beforeNavigate);
    window.addEventListener("admin:form-saved", clear);
    window.addEventListener("popstate", back, true);
    return () => {
      document.removeEventListener("pointerdown", baseline, true);
      document.removeEventListener("focusin", baseline, true);
      document.removeEventListener("input", check, true);
      document.removeEventListener("change", check, true);
      document.removeEventListener("click", click, true);
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("admin:before-navigation", beforeNavigate);
      window.removeEventListener("admin:form-saved", clear);
      window.removeEventListener("popstate", back, true);
    };
  }, [navigation, pathname]);

  if (!dirty) return null;
  return (
    <AdminNotice>
    <section data-admin-unsaved aria-label="Unsaved changes" aria-live="polite" onKeyDown={(event) => { if (event.key === "Escape") setLeave(null); }} className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 shadow-sm print:hidden">
      <p className="font-medium">{leave ? "Leave without saving your changes?" : "You have unsaved changes"}</p>
      {leave ? <div className="mt-2 flex gap-2">
        <button ref={stay} disabled={busy} type="button" onClick={() => setLeave(null)} className="rounded-lg bg-amber-950 px-3 py-1.5 font-semibold text-white">Keep editing</button>
        {draftGuard ? <button disabled={busy} type="button" onClick={async () => {
          const proceed = leave; setBusy(true);
          try { if (await draftGuard.save()) { forms.current.clear(); setDirty(false); setLeave(null); proceed(); } }
          finally { setBusy(false); }
        }} className="rounded-lg border border-amber-300 px-3 py-1.5 font-semibold">{busy ? "Please wait…" : "Save draft & leave"}</button> : null}
        <button disabled={busy} type="button" onClick={async () => {
          const proceed = leave; setBusy(true);
          try { if (!draftGuard || await draftGuard.discard()) { forms.current.clear(); setDirty(false); setLeave(null); proceed(); } }
          finally { setBusy(false); }
        }} className="rounded-lg border border-amber-300 px-3 py-1.5 font-semibold">Discard & leave</button>
      </div> : null}
    </section>
    </AdminNotice>
  );
}
