"use client";

import Link from "next/link";
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
    <div ref={containerRef} className="mx-auto w-fit max-w-full">
      <div
        className={`overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-lg transition-transform duration-200 ease-out ${
          expanded ? "" : "hover:scale-[1.02]"
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
            className="inline-flex w-full items-center justify-center rounded-3xl bg-[#ff6f95] px-8 py-3 text-sm font-semibold normal-case tracking-normal text-white transition-colors hover:bg-[#ff4f80]"
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
          <div className="bg-transparent text-center">
            <div>
              {OPTIONS.map((option) => (
                <Link
                  key={option.href}
                  href={option.href}
                  className="block px-6 py-4 text-sm font-semibold normal-case tracking-normal text-[#ff6f95] transition-colors hover:text-[#ff4f80]"
                >
                  {option.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
