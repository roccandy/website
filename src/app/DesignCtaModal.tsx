"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { buildDesignerPath } from "@/lib/designUrls";

const OPTIONS = [
  { label: "Wedding Candy", href: buildDesignerPath({ orderType: "weddings" }) },
  { label: "Text Candy", href: buildDesignerPath({ orderType: "text" }) },
  { label: "Branded Candy", href: buildDesignerPath({ orderType: "branded", categoryId: "branded" }) },
];

export function DesignCtaModal() {
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!expanded) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [expanded]);

  return (
    <div ref={containerRef} className="mx-auto w-full max-w-[36rem]">
      <div className="relative h-14 sm:h-[3.75rem]">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-expanded={expanded}
          aria-controls="design-options"
          className={`absolute left-1/2 top-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#ff6f95] px-8 py-3 text-sm font-semibold normal-case tracking-normal text-white shadow-[0_18px_38px_rgba(114,112,111,0.24)] transition-all duration-300 ease-out hover:bg-[#ff4f80] ${
            expanded ? "pointer-events-none scale-95 opacity-0" : "scale-100 opacity-100"
          }`}
        >
          Design Your Candy + Pricing
        </button>

        <div
          id="design-options"
          aria-hidden={!expanded}
          className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ease-out ${
            expanded ? "scale-100 opacity-100" : "pointer-events-none scale-90 opacity-0"
          }`}
        >
          <div className="inline-flex overflow-hidden rounded-full border border-zinc-200 bg-white shadow-[0_10px_22px_rgba(114,112,111,0.16)]">
            {OPTIONS.map((option, index) => (
              <Link
                key={option.href}
                href={option.href}
                className={`inline-flex items-center justify-center whitespace-nowrap px-3 py-3 text-xs font-semibold normal-case tracking-normal text-[#ff6f95] transition-colors duration-200 ease-out hover:bg-[#fff1f5] hover:text-[#ff4f80] sm:px-5 sm:text-sm ${
                  index > 0 ? "border-l border-zinc-200" : ""
                }`}
              >
                {option.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
