"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const LINKS = [
  { label: "FAQs", href: "/faqs" },
  { label: "About", href: "/about" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "/contact" },
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
        hidden ? "max-h-0 border-b-0 opacity-0" : "max-h-12 border-b border-zinc-200 opacity-100"
      }`}
      aria-hidden={hidden}
    >
      <div className="site-top-links-row mx-auto flex max-w-6xl items-center justify-center px-6 text-[11px] font-semibold tracking-[0.16em] text-[#ff6f95] md:text-xs">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            tabIndex={hidden ? -1 : undefined}
            className="inline-flex min-h-10 items-center transition-colors hover:text-[#ff4f80] focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6f95]"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
