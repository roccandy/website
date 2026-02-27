"use client";

import { useEffect, useRef, useState } from "react";
const OPTIONS = [
  { label: "Wedding Candy", href: "/design?type=weddings" },
  { label: "Text Candy", href: "/design?type=text" },
  { label: "Branded Logo Candy", href: "/design?type=branded" },
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
    <div ref={containerRef} className="mx-auto w-full max-w-xl">
      <div
        className={`overflow-hidden rounded-3xl border bg-white/90 shadow-lg transition-transform duration-200 ease-out ${
          expanded ? "border-[#e91e63]" : "border-zinc-200 hover:scale-[1.02]"
        }`}
      >
        <div
          className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${
            expanded ? "max-h-0 opacity-0 pointer-events-none" : "max-h-20 opacity-100"
          }`}
        >
          <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-expanded={expanded}
            aria-controls="design-options"
            className="flex w-full items-center justify-center rounded-3xl bg-[#e91e63] px-6 py-4 text-sm font-semibold uppercase tracking-[0.2em] text-white transition-colors hover:bg-[#d81b60]"
          >
            Design Your Candy + Pricing
          </button>
        </div>
        <div
          id="design-options"
          aria-hidden={!expanded}
          className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${
            expanded ? "max-h-[240px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
          }`}
        >
          <div className="bg-[#fbd6e3] text-center">
            <div className="divide-y divide-[#e91e63]">
            {OPTIONS.map((option) => (
              <a
                key={option.href}
                href={option.href}
                className="block px-6 py-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#e91e63] transition-colors hover:bg-[#f6c1d3] hover:text-[#d81b60]"
              >
                {option.label}
              </a>
            ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
