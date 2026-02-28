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
      className={`overflow-hidden bg-white transition-all duration-200 ${
        hidden ? "max-h-0 border-b-0 opacity-0" : "max-h-10 border-b border-zinc-200 opacity-100"
      }`}
      aria-hidden={hidden}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-6 px-6 py-1 text-[11px] font-semibold tracking-[0.16em] text-[#ff6f95] md:text-xs">
        {LINKS.map((link) => (
          <a key={link.href} href={link.href} className="transition-colors hover:text-[#ff4f80]">
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}
