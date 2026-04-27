"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const STORAGE_PREFIX = "admin-scroll:";
const MAX_AGE_MS = 5 * 60 * 1000;

function getStorageKey(pathname: string) {
  return `${STORAGE_PREFIX}${pathname}`;
}

function readSavedScroll(key: string) {
  const raw = window.sessionStorage.getItem(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { y: number; ts: number };
    if (!Number.isFinite(parsed.y) || !Number.isFinite(parsed.ts)) return null;
    if (Date.now() - parsed.ts > MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function AdminScrollRestoration() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const locationKey = search ? `${pathname}?${search}` : pathname;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const exactKey = getStorageKey(locationKey);
    const pathnameKey = getStorageKey(pathname);
    const parsed = readSavedScroll(exactKey) ?? readSavedScroll(pathnameKey);
    if (!parsed) return;

    window.sessionStorage.removeItem(exactKey);
    window.sessionStorage.removeItem(pathnameKey);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: parsed.y, left: 0, behavior: "auto" });
      });
    });
  }, [locationKey, pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleSubmit = (event: Event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;

      try {
        const value = JSON.stringify({
          y: window.scrollY,
          ts: Date.now(),
        });

        window.sessionStorage.setItem(getStorageKey(locationKey), value);
        window.sessionStorage.setItem(getStorageKey(pathname), value);
      } catch {
        // Ignore storage failures.
      }
    };

    window.addEventListener("submit", handleSubmit, true);
    return () => window.removeEventListener("submit", handleSubmit, true);
  }, [locationKey, pathname]);

  return null;
}
