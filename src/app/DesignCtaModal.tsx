"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { buildDesignerPath } from "@/lib/designUrls";
import { LANDING_CTA_ARROW_CLASS, LANDING_CTA_BUTTON_BASE_CLASS } from "@/components/StickyLandingCta";

const OPTIONS = [
  { label: "Wedding Candy", href: buildDesignerPath({ orderType: "weddings" }) },
  { label: "Text Candy", href: buildDesignerPath({ orderType: "text" }) },
  { label: "Branded Candy", href: buildDesignerPath({ orderType: "branded", categoryId: "branded" }) },
];

export function DesignCtaModal() {
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const stickyRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const container = containerRef.current?.closest<HTMLElement>(".site-page-frame") ?? containerRef.current;
    const wrap = wrapRef.current;
    const stickyEl = stickyRef.current;
    if (!container || !wrap || !stickyEl) return;

    const headerEl = document.querySelector<HTMLElement>("[data-quote-header]");
    const bannerEl = document.querySelector<HTMLElement>("[data-production-blockout-banner]");
    const topGap = 16;
    let raf = 0;
    let lockedWidth = 0;

    const reset = () => {
      stickyEl.style.position = "static";
      stickyEl.style.top = "";
      stickyEl.style.left = "";
      stickyEl.style.width = "";
      stickyEl.style.height = "";
      stickyEl.style.zIndex = "";
      wrap.style.height = "";
      wrap.style.width = "";
    };

    const measureRestingWidth = () => {
      const prev = {
        position: stickyEl.style.position,
        top: stickyEl.style.top,
        left: stickyEl.style.left,
        width: stickyEl.style.width,
        height: stickyEl.style.height,
        zIndex: stickyEl.style.zIndex,
        wrapHeight: wrap.style.height,
        wrapWidth: wrap.style.width,
      };

      reset();
      const measured =
        Math.ceil(
          Math.max(
            wrap.getBoundingClientRect().width,
            stickyEl.getBoundingClientRect().width,
            buttonRef.current?.getBoundingClientRect().width ?? 0,
            220,
          ),
        ) + 2;
      const viewportMax = Math.max(220, window.innerWidth - 16);

      stickyEl.style.position = prev.position;
      stickyEl.style.top = prev.top;
      stickyEl.style.left = prev.left;
      stickyEl.style.width = prev.width;
      stickyEl.style.height = prev.height;
      stickyEl.style.zIndex = prev.zIndex;
      wrap.style.height = prev.wrapHeight;
      wrap.style.width = prev.wrapWidth;

      return Math.min(measured, viewportMax);
    };

    const update = () => {
      const containerRect = container.getBoundingClientRect();
      const wrapRect = wrap.getBoundingClientRect();
      const scrollY = window.scrollY;
      const containerTop = scrollY + containerRect.top;
      const containerBottom = containerTop + containerRect.height;
      const wrapTop = scrollY + wrapRect.top;
      const controlHeight = buttonRef.current?.offsetHeight ?? stickyEl.offsetHeight;
      const bannerHeight = bannerEl?.getBoundingClientRect().height ?? 0;
      const topOffset = (headerEl?.getBoundingClientRect().height ?? 0) + bannerHeight + topGap;

      const start = wrapTop - topOffset;
      const end = containerBottom - topOffset - controlHeight;

      if (scrollY < start) {
        reset();
        lockedWidth = measureRestingWidth();
        return;
      }

      if (!lockedWidth) {
        lockedWidth = measureRestingWidth();
      }
      const width = Math.min(lockedWidth, Math.max(220, window.innerWidth - 16));
      stickyEl.style.height = `${controlHeight}px`;
      wrap.style.height = `${controlHeight}px`;
      wrap.style.width = `${width}px`;
      const currentWrapRect = wrap.getBoundingClientRect();
      const left = Math.min(Math.max(Math.round(currentWrapRect.left), 8), Math.max(8, window.innerWidth - width - 8));

      if (scrollY <= end) {
        stickyEl.style.position = "fixed";
        stickyEl.style.top = `${topOffset}px`;
        stickyEl.style.left = `${left}px`;
        stickyEl.style.width = `${width}px`;
        stickyEl.style.zIndex = "20";
        return;
      }

      const absoluteTop = container.clientHeight - controlHeight;
      stickyEl.style.position = "absolute";
      stickyEl.style.top = `${absoluteTop}px`;
      stickyEl.style.left = `${Math.round(left - containerRect.left)}px`;
      stickyEl.style.width = `${width}px`;
      stickyEl.style.zIndex = "1";
    };

    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    const observer = new ResizeObserver(onScroll);
    observer.observe(container);
    observer.observe(wrap);
    observer.observe(stickyEl);
    if (headerEl) {
      observer.observe(headerEl);
    }
    if (bannerEl) {
      observer.observe(bannerEl);
    }

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      observer.disconnect();
      reset();
    };
  }, []);

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
    <div ref={containerRef} className="mx-auto w-fit max-w-full overflow-visible">
      <div ref={wrapRef} className="relative h-16 sm:h-[4.5rem]">
        <div ref={stickyRef} className="w-fit max-w-full overflow-visible">
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              ref={buttonRef}
              type="button"
              onClick={() => setExpanded(true)}
              aria-expanded={expanded}
              aria-controls="design-options"
              className={`${LANDING_CTA_BUTTON_BASE_CLASS} bg-[#ff6f95] shadow-[0_18px_38px_rgba(114,112,111,0.24)] transition-all duration-300 ease-out hover:bg-[#ff4f80] ${
                expanded ? "pointer-events-none scale-95 opacity-0" : "scale-100 opacity-100"
              }`}
            >
              <span className="site-primary-cta-label">Design Your Candy</span>
              <span className="site-primary-cta-arrow" aria-hidden="true">
                <svg viewBox="0 0 12 12" className={LANDING_CTA_ARROW_CLASS} fill="none">
                  <path d="M3 2.25 7.5 6 3 9.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </button>
          </div>

          <div
            id="design-options"
            aria-hidden={!expanded}
            className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ease-out ${
              expanded ? "scale-100 opacity-100" : "pointer-events-none scale-90 opacity-0"
            }`}
          >
            <div className="inline-flex overflow-hidden rounded-full border border-zinc-200 bg-white shadow-[0_10px_22px_rgba(114,112,111,0.16)]">
              {OPTIONS.map((option, index) => (
                <Link
                  key={option.href}
                  href={option.href}
                  className={`inline-flex items-center justify-center whitespace-nowrap px-4 py-3 text-[13px] font-semibold normal-case tracking-normal leading-none text-[#ff6f95] transition-colors duration-200 ease-out hover:bg-[#fff1f5] hover:text-[#ff4f80] sm:px-6 sm:py-3.5 sm:text-sm ${
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
    </div>
  );
}
