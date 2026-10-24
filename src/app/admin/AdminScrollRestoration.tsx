"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const MAX_AGE_MS = 30 * 60 * 1000;
export function adminLocationKey(pathname: string, search: string) {
  const params = new URLSearchParams(search);
  params.delete("toast");
  params.delete("message");
  params.sort();
  return pathname + (params.size ? `?${params}` : "");
}

export function AdminScrollRestoration() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const locationKey = adminLocationKey(pathname, search);
  useEffect(() => {
    const key = `admin-scroll:${locationKey}`;
    let frame = 0;
    let restoring = false;
    let leaving = false;
    let y = window.scrollY;
    const save = () => {
      if (restoring) return;
      try { sessionStorage.setItem(key, JSON.stringify({ y, ts: Date.now() })); } catch { /* Storage is optional. */ }
    };
    try {
      if (["/admin/orders", "/admin/orders/archived", "/admin/orders/invoices"].includes(pathname)) sessionStorage.setItem("admin-view:orders-return", locationKey);
      const raw = sessionStorage.getItem(key);
      const saved = raw ? JSON.parse(raw) as { y: number; ts: number } : null;
      if (saved && Number.isFinite(saved.y) && saved.y >= 0 && Number.isFinite(saved.ts) && Date.now() - saved.ts < MAX_AGE_MS) {
        restoring = true;
        const started = performance.now();
        const restore = () => {
          // Wait for actual content, not a loading skeleton, to have room.
          if (document.documentElement.scrollHeight >= saved.y + window.innerHeight || performance.now() - started > 3000) {
            window.scrollTo({ top: saved.y, behavior: "instant" });
            y = window.scrollY;
            restoring = false;
          } else frame = requestAnimationFrame(restore);
        };
        frame = requestAnimationFrame(() => { frame = requestAnimationFrame(restore); });
      }
    } catch { /* Malformed or unavailable storage must never break navigation. */ }
    const scroll = () => { if (!restoring && !leaving) y = window.scrollY; };
    const capture = () => { if (!restoring && !leaving) y = window.scrollY; save(); };
    const beforeNavigate = (event: Event) => {
      capture();
      leaving = true;
      // A draft guard may cancel this navigation later in the same dispatch.
      queueMicrotask(() => { if (event.defaultPrevented) leaving = false; });
    };
    const cancelRestore = () => { if (restoring) { cancelAnimationFrame(frame); restoring = false; y = window.scrollY; } };
    window.addEventListener("scroll", scroll, { passive: true });
    document.addEventListener("click", capture, true);
    document.addEventListener("submit", capture, true);
    window.addEventListener("pagehide", capture);
    window.addEventListener("admin:before-navigation", beforeNavigate);
    window.addEventListener("wheel", cancelRestore, { passive: true });
    window.addEventListener("touchstart", cancelRestore, { passive: true });
    return () => {
      save(); cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scroll);
      document.removeEventListener("click", capture, true);
      document.removeEventListener("submit", capture, true);
      window.removeEventListener("pagehide", capture);
      window.removeEventListener("admin:before-navigation", beforeNavigate);
      window.removeEventListener("wheel", cancelRestore);
      window.removeEventListener("touchstart", cancelRestore);
    };
  }, [locationKey, pathname]);
  return null;
}
