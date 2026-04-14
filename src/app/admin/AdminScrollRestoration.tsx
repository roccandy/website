"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const STORAGE_PREFIX = "admin-scroll:";
const MAX_AGE_MS = 5 * 60 * 1000;

function getStorageKey(pathname: string) {
  return `${STORAGE_PREFIX}${pathname}`;
}

export function AdminScrollRestoration() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const key = getStorageKey(pathname);
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return;

    window.sessionStorage.removeItem(key);

    try {
      const parsed = JSON.parse(raw) as { y: number; ts: number };
      if (!Number.isFinite(parsed.y) || !Number.isFinite(parsed.ts)) return;
      if (Date.now() - parsed.ts > MAX_AGE_MS) return;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo({ top: parsed.y, left: 0, behavior: "auto" });
        });
      });
    } catch {
      // Ignore malformed state.
    }
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleSubmit = (event: Event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;

      try {
        window.sessionStorage.setItem(
          getStorageKey(pathname),
          JSON.stringify({
            y: window.scrollY,
            ts: Date.now(),
          }),
        );
      } catch {
        // Ignore storage failures.
      }
    };

    window.addEventListener("submit", handleSubmit, true);
    return () => window.removeEventListener("submit", handleSubmit, true);
  }, [pathname]);

  return null;
}
