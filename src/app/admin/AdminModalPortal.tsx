"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, type ReactNode } from "react";

let openPortals = 0;
let previousBodyOverflow = "";

/** Responsive containers establish containing blocks. Keep overlays viewport-sized. */
export function AdminModalPortal({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    if (openPortals === 0) previousBodyOverflow = document.body.style.overflow;
    openPortals += 1;
    document.body.style.overflow = "hidden";
    root.current
      ?.querySelector<HTMLElement>(
        "button:not(:disabled), input:not(:disabled), select:not(:disabled), [href]",
      )
      ?.focus();
    return () => {
      openPortals -= 1;
      if (openPortals === 0) document.body.style.overflow = previousBodyOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus();
    };
  }, []);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={root}
      data-admin-modal-portal
      onKeyDown={(event) => {
        const portals = document.querySelectorAll("[data-admin-modal-portal]");
        if (portals[portals.length - 1] !== root.current) return;
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
        if (event.key === "Tab") {
          const controls = Array.from(
            root.current?.querySelectorAll<HTMLElement>(
              "button:not(:disabled), input:not(:disabled):not([type=hidden]), select:not(:disabled), textarea:not(:disabled), [href], [tabindex='0']",
            ) ?? [],
          ).filter((element) => element.getClientRects().length > 0);
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
