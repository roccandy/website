"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const WEDDING_LINKS = [
  { label: "Wedding Candy", href: "/design/wedding-candy" },
  { label: "Design - Initials", href: "/design?type=weddings&subtype=weddings-initials" },
  { label: "Design - Both Names", href: "/design?type=weddings&subtype=weddings-both-names" },
];

const TEXT_LINKS = [
  { label: "Custom Text Candy", href: "/design/custom-text-candy" },
  { label: "Design - 1-6 Letters", href: "/design?type=text&subtype=custom-1-6" },
  { label: "Design - 7-14 Letters", href: "/design?type=text&subtype=custom-7-14" },
];

const BRANDED_LINKS = [
  { label: "Branded Logo Candy", href: "/design/branded-logo-candy" },
  { label: "Design - Branded", href: "/design?type=branded" },
];

type OpenDropdown = "branded" | "wedding" | "text" | null;

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

  const dropdownClassName =
    "absolute left-1/2 top-full z-40 mt-3 min-w-[220px] -translate-x-1/2 rounded-2xl border border-zinc-200 bg-white/98 px-2 py-2 text-sm font-semibold normal-case tracking-normal shadow-lg backdrop-blur";
  const dropdownLinkClassName =
    "block rounded-xl px-3 py-2 text-[#ff6f95] transition-colors hover:bg-[#fedae1]/60 hover:text-[#ff4f80]";

  return (
    <div
      ref={navRef}
      className="order-3 flex w-full flex-nowrap items-center justify-start gap-5 overflow-x-auto overflow-y-visible whitespace-nowrap px-1 pb-1 text-[15px] font-semibold normal-case tracking-normal text-[#ff6f95] md:order-none md:flex-1 md:flex-wrap md:justify-center md:gap-17 md:overflow-visible md:whitespace-normal md:px-0 md:pb-0 md:text-[17px]"
    >
      <div className="relative">
        <button
          type="button"
          data-plain-button
          onClick={() => toggleDropdown("wedding")}
          aria-haspopup="menu"
          aria-expanded={openDropdown === "wedding"}
          className="inline-flex cursor-pointer items-center gap-2 leading-none transition-colors !text-[#ff6f95] hover:!text-[#ff4f80]"
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
          <div className={dropdownClassName}>
            {WEDDING_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeDropdown}
                className={dropdownLinkClassName}
              >
                {link.label}
              </Link>
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
          className="inline-flex cursor-pointer items-center gap-2 leading-none transition-colors !text-[#ff6f95] hover:!text-[#ff4f80]"
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
          <div className={dropdownClassName}>
            {TEXT_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeDropdown}
                className={dropdownLinkClassName}
              >
                {link.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
      <div className="relative">
        <button
          type="button"
          data-plain-button
          onClick={() => toggleDropdown("branded")}
          aria-haspopup="menu"
          aria-expanded={openDropdown === "branded"}
          className="inline-flex cursor-pointer items-center gap-2 leading-none transition-colors !text-[#ff6f95] hover:!text-[#ff4f80]"
        >
          Branded
          <svg
            viewBox="0 0 16 16"
            className={`h-3 w-3 transition-transform ${openDropdown === "branded" ? "rotate-180" : ""}`}
            aria-hidden="true"
          >
            <path d="M4 6l4 4 4-4z" fill="currentColor" />
          </svg>
        </button>
        {openDropdown === "branded" ? (
          <div className={dropdownClassName}>
            {BRANDED_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeDropdown}
                className={dropdownLinkClassName}
              >
                {link.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
      <Link href="/pre-made-candy" className="leading-none transition-colors hover:text-[#ff4f80]">
        Pre-Made
      </Link>
      <Link href="/#gallery" className="leading-none transition-colors hover:text-[#ff4f80]">
        Gallery
      </Link>
    </div>
  );
}
