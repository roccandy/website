"use client";

import { useEffect, useState } from "react";

const LINKS = [
  { label: "FAQ", href: "#faq" },
  { label: "About", href: "#about" },
  { label: "Blog", href: "#blog" },
];

const TOP_SCROLL_THRESHOLD = 0;

export default function LandingTopLinksBar() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const update = () => {
      setHidden(window.scrollY > TOP_SCROLL_THRESHOLD);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <div
      className={`overflow-hidden bg-[rgb(221,221,213)] transition-all duration-200 ${
        hidden
          ? "max-h-0 border-b-0 opacity-0 shadow-none"
          : "max-h-10 border-b border-[rgb(210,210,198)] opacity-100 shadow-[0_2px_8px_rgba(113,113,122,0.15)]"
      }`}
      aria-hidden={hidden}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-6 px-6 py-1 text-[11px] font-semibold tracking-[0.16em] text-[rgb(163,163,140)] md:text-xs">
        {LINKS.map((link) => (
          <a key={link.href} href={link.href} className="transition-colors hover:text-[rgb(143,143,120)]">
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}
