"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

const getHost = () => document.getElementById("admin-header-notices");
function subscribe(listener: () => void) {
  if (getHost()) return () => {};
  const observer = new MutationObserver(() => {
    if (getHost()) { listener(); observer.disconnect(); }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}

/** Share one header location for progress, results and unsaved-work notices. */
export function AdminNotice({ children }: { children: ReactNode }) {
  const host = useSyncExternalStore(subscribe, getHost, () => null);
  if (host) return createPortal(children, host);
  return <div className="fixed right-4 top-4 z-[110] max-w-[calc(100vw-2rem)] print:hidden">{children}</div>;
}
