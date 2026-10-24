"use client";
import { useCallback, useSyncExternalStore } from "react";

const eventName = "admin-view-state";
const memory = new Map<string, string>();
const subscribe = (listener: () => void) => {
  window.addEventListener(eventName, listener);
  window.addEventListener("storage", listener);
  return () => { window.removeEventListener(eventName, listener); window.removeEventListener("storage", listener); };
};
/** Only view preferences live here, never order drafts, credentials or uploads. */
export function useAdminViewState<T extends string>(name: string, fallback: T, valid: (value: string) => boolean) {
  const key = `admin-view:${name}`;
  const snapshot = useCallback(() => {
    try { return window.sessionStorage.getItem(key) ?? memory.get(key) ?? null; }
    catch { return memory.get(key) ?? null; }
  }, [key]);
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  const value = raw !== null && valid(raw) ? raw as T : fallback;
  const setValue = useCallback((next: T) => {
    memory.set(key, next);
    try { window.sessionStorage.setItem(key, next); } catch { /* Private browsing may disable storage. */ }
    window.dispatchEvent(new Event(eventName));
  }, [key]);
  return [value, setValue] as const;
}
