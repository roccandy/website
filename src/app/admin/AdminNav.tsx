"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { type AdminNavSection, getAdminNavToneClasses } from "@/app/admin/adminNavigation";

export function AdminNav({ sections }: { sections: AdminNavSection[] }) {
  const [open, setOpen] = useState(false);
  const navRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!navRef.current) return;
      if (!navRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  const close = () => setOpen(false);

  return (
    <nav ref={navRef} className="relative lg:hidden">
      <button
        type="button"
        data-plain-button
        onClick={() => setOpen((current) => !current)}
        className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:text-zinc-900"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Menu
        <svg viewBox="0 0 16 16" className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true">
          <path d="M4 6l4 4 4-4z" fill="currentColor" />
        </svg>
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-40 mt-3 w-[min(92vw,28rem)] rounded-3xl border border-zinc-200 bg-white p-4 shadow-xl">
          <div className="space-y-4">
            {sections.map((section) => {
              const toneClasses = getAdminNavToneClasses(section.tone);

              return (
                <div key={section.key} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">{section.label}</p>
                    <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${toneClasses.badgeMuted}`}>
                      {section.items.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {section.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        prefetch
                        onClick={close}
                        className={`block rounded-2xl border px-3 py-3 text-sm transition ${
                          pathname === item.href
                            ? `${toneClasses.border} bg-zinc-50 text-zinc-900`
                            : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:text-zinc-900"
                        }`}
                      >
                        <p className="font-semibold">{item.label}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </nav>
  );
}
