"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DesignEditor } from "./DesignEditor";
import {
  designFromOrder,
  newDesignLayer,
  nameDesignForOrder,
  type CandyDesign,
} from "@/lib/candyDesign";
import {
  resolveSiteDesignerDefaults,
  type SiteDesignerDefaults,
} from "@/lib/siteDesignerDefaults";

/** Opens over the current form so customer details and other unsaved order fields survive. */
export function OrderDesignStudio({
  order,
  onApply,
  siteDefaults = resolveSiteDesignerDefaults(),
}: {
  order: Record<string, unknown>;
  onApply: (design: CandyDesign) => void;
  siteDefaults?: SiteDesignerDefaults;
}) {
  const [open, setOpen] = useState(false);
  const [initial, setInitial] = useState<CandyDesign | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const triggerElement = trigger.current;
    dialog.current?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const nodes = [
        ...(dialog.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]),input:not([disabled]),select,textarea,a[href],[tabindex="0"]',
        ) || []),
      ].filter((el) => el.getClientRects().length);
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === dialog.current)
      ) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", trap);
      triggerElement?.focus();
    };
  }, [open]);
  const launch = async () => {
    setLoading(true);
    setError("");
    try {
      const original = designFromOrder(order, siteDefaults);
      const design = nameDesignForOrder(original, order.title);
      // An order-specific name creates a copy rather than renaming a reused template.
      if (design.name !== original.name) delete design.source;
      // Carry real logo artwork into editable layers without reclassifying the order.
      if (
        !order.candy_design &&
        order.category_id === "branded" &&
        typeof order.logo_url === "string" &&
        order.logo_url &&
        !design.layers.some((layer) => layer.type === "image")
      ) {
        const response = await fetch("/api/admin/design/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: order.logo_url }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        design.layers = [
          {
            ...newDesignLayer("image", crypto.randomUUID(), siteDefaults),
            image: result.image,
            name: "Existing artwork",
          },
        ];
      }
      setInitial(design);
      setOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to open this design.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="space-y-2">
      <button
        ref={trigger}
        type="button"
        onClick={() => void launch()}
        disabled={loading}
        className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {loading ? "Opening artwork…" : "Open in Design Studio"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-rose-700">
          {error}
        </p>
      )}
      {open &&
        initial &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] overflow-y-auto bg-zinc-100 p-3 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-label="Order Design Studio"
            tabIndex={-1}
            ref={dialog}
          >
            <div className="mx-auto max-w-[1700px]">
              <DesignEditor
                initialDesign={initial}
                siteDefaults={siteDefaults}
                embedded
                onClose={() => setOpen(false)}
                onApply={(design) => {
                  onApply(design);
                  setOpen(false);
                }}
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
