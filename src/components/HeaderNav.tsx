"use client";

import { useEffect, useRef, useState } from "react";

const WEDDING_LINKS = [
  { label: "Initials", href: "/design?type=weddings&subtype=weddings-initials" },
  { label: "Both names", href: "/design?type=weddings&subtype=weddings-both-names" },
];

const TEXT_LINKS = [
  { label: "1-6 letters", href: "/design?type=text&subtype=custom-1-6" },
  { label: "7-14 letters", href: "/design?type=text&subtype=custom-7-14" },
];

type OpenDropdown = "wedding" | "text" | null;

export default function HeaderNav() {
  const [openDropdown, setOpenDropdown] = useState<OpenDropdown>(null);
  const navRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!navRef.current) return;
      if (!navRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  const toggleDropdown = (key: OpenDropdown) => {
    setOpenDropdown((current) => (current === key ? null : key));
  };

  const closeDropdown = () => setOpenDropdown(null);

  return (
    <div
      ref={navRef}
      className="order-3 flex w-full flex-nowrap items-center justify-start gap-5 overflow-x-auto overflow-y-visible whitespace-nowrap px-1 pb-1 text-[15px] font-semibold normal-case tracking-normal text-[#ff6781] md:order-none md:flex-1 md:flex-wrap md:justify-center md:gap-17 md:overflow-visible md:whitespace-normal md:px-0 md:pb-0 md:text-[17px]"
    >
      <a href="/design?type=branded" className="leading-none transition-colors hover:text-[#e91e63]">
        Branded
      </a>
      <div className="relative">
        <button
          type="button"
          data-plain-button
          onClick={() => toggleDropdown("wedding")}
          aria-haspopup="menu"
          aria-expanded={openDropdown === "wedding"}
          className="inline-flex cursor-pointer items-center gap-2 leading-none transition-colors !text-[#ff6781] hover:!text-[#e91e63]"
        >
          Wedding
          <svg
            viewBox="0 0 16 16"
            className={`h-3 w-3 transition-transform ${openDropdown === "wedding" ? "rotate-180" : ""}`}
            aria-hidden="true"
          >
            <path d="M4 6l4 4 4-4z" fill="currentColor" />
          </svg>
        </button>
        {openDropdown === "wedding" ? (
          <div className="absolute left-1/2 top-full z-40 mt-3 min-w-[180px] -translate-x-1/2 rounded-2xl border border-zinc-200 bg-white px-2 py-2 text-xs normal-case tracking-[0.16em] shadow-lg">
            {WEDDING_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={closeDropdown}
                className="block rounded-xl px-3 py-2 text-[#ff6781] transition-colors hover:bg-[#fedae1]/60 hover:text-[#e91e63]"
              >
                {link.label}
              </a>
            ))}
          </div>
        ) : null}
      </div>
      <div className="relative">
        <button
          type="button"
          data-plain-button
          onClick={() => toggleDropdown("text")}
          aria-haspopup="menu"
          aria-expanded={openDropdown === "text"}
          className="inline-flex cursor-pointer items-center gap-2 leading-none transition-colors !text-[#ff6781] hover:!text-[#e91e63]"
        >
          Text
          <svg
            viewBox="0 0 16 16"
            className={`h-3 w-3 transition-transform ${openDropdown === "text" ? "rotate-180" : ""}`}
            aria-hidden="true"
          >
            <path d="M4 6l4 4 4-4z" fill="currentColor" />
          </svg>
        </button>
        {openDropdown === "text" ? (
          <div className="absolute left-1/2 top-full z-40 mt-3 min-w-[180px] -translate-x-1/2 rounded-2xl border border-zinc-200 bg-white px-2 py-2 text-xs normal-case tracking-[0.16em] shadow-lg">
            {TEXT_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={closeDropdown}
                className="block rounded-xl px-3 py-2 text-[#ff6781] transition-colors hover:bg-[#fedae1]/60 hover:text-[#e91e63]"
              >
                {link.label}
              </a>
            ))}
          </div>
        ) : null}
      </div>
      <a href="/pre-made-candy" className="leading-none transition-colors hover:text-[#e91e63]">
        Pre-Made
      </a>
      <a href="/#gallery" className="leading-none transition-colors hover:text-[#e91e63]">
        Gallery
      </a>
    </div>
  );
}
