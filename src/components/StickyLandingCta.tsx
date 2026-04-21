"use client";

import type { ReactNode, RefObject } from "react";
import { useEffect, useRef } from "react";

type StickyLandingCtaProps = {
  children: ReactNode;
  containerRef?: RefObject<HTMLDivElement | null>;
  className?: string;
};

export function StickyLandingCta({
  children,
  containerRef,
  className = "mx-auto w-fit max-w-full overflow-visible",
}: StickyLandingCtaProps) {
  const innerContainerRef = useRef<HTMLDivElement | null>(null);
  const resolvedContainerRef = containerRef ?? innerContainerRef;
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const stickyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = resolvedContainerRef.current?.closest<HTMLElement>(".site-page-frame") ?? resolvedContainerRef.current;
    const wrap = wrapRef.current;
    const stickyEl = stickyRef.current;
    if (!container || !wrap || !stickyEl) return;

    const headerEl =
      document.querySelector<HTMLElement>("[data-site-header]") ?? document.querySelector<HTMLElement>("[data-quote-header]");
    const bannerEl = document.querySelector<HTMLElement>("[data-production-blockout-banner]");
    const topGap = 16;
    let raf = 0;
    let lockedWidth = 0;
    let lockedHeight = 0;
    let lockedControlOffset = 0;

    const reset = () => {
      stickyEl.style.position = "static";
      stickyEl.style.top = "";
      stickyEl.style.left = "";
      stickyEl.style.width = "";
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
        zIndex: stickyEl.style.zIndex,
        wrapHeight: wrap.style.height,
        wrapWidth: wrap.style.width,
      };

      reset();
      const measured = Math.ceil(Math.max(wrap.getBoundingClientRect().width, stickyEl.getBoundingClientRect().width, 220)) + 2;
      const viewportMax = Math.max(220, window.innerWidth - 16);

      stickyEl.style.position = prev.position;
      stickyEl.style.top = prev.top;
      stickyEl.style.left = prev.left;
      stickyEl.style.width = prev.width;
      stickyEl.style.zIndex = prev.zIndex;
      wrap.style.height = prev.wrapHeight;
      wrap.style.width = prev.wrapWidth;

      return Math.min(measured, viewportMax);
    };

    const measureRestingHeight = () => {
      const prev = {
        position: stickyEl.style.position,
        top: stickyEl.style.top,
        left: stickyEl.style.left,
        width: stickyEl.style.width,
        zIndex: stickyEl.style.zIndex,
        wrapHeight: wrap.style.height,
        wrapWidth: wrap.style.width,
      };

      reset();
      const measured = Math.ceil(Math.max(wrap.getBoundingClientRect().height, stickyEl.getBoundingClientRect().height, 40));

      stickyEl.style.position = prev.position;
      stickyEl.style.top = prev.top;
      stickyEl.style.left = prev.left;
      stickyEl.style.width = prev.width;
      stickyEl.style.zIndex = prev.zIndex;
      wrap.style.height = prev.wrapHeight;
      wrap.style.width = prev.wrapWidth;

      return measured;
    };

    const measureRestingControlOffset = () => {
      const prev = {
        position: stickyEl.style.position,
        top: stickyEl.style.top,
        left: stickyEl.style.left,
        width: stickyEl.style.width,
        zIndex: stickyEl.style.zIndex,
        wrapHeight: wrap.style.height,
        wrapWidth: wrap.style.width,
      };

      reset();
      const controlEl = stickyEl.querySelector<HTMLElement>(".site-primary-cta");
      const stickyRect = stickyEl.getBoundingClientRect();
      const controlRect = controlEl?.getBoundingClientRect() ?? stickyRect;
      const measured = controlRect.top - stickyRect.top;

      stickyEl.style.position = prev.position;
      stickyEl.style.top = prev.top;
      stickyEl.style.left = prev.left;
      stickyEl.style.width = prev.width;
      stickyEl.style.zIndex = prev.zIndex;
      wrap.style.height = prev.wrapHeight;
      wrap.style.width = prev.wrapWidth;

      return measured;
    };

    const update = () => {
      const containerRect = container.getBoundingClientRect();
      const wrapRect = wrap.getBoundingClientRect();
      const scrollY = window.scrollY;
      const containerTop = scrollY + containerRect.top;
      const containerBottom = containerTop + containerRect.height;
      const stickyHeight = stickyEl.offsetHeight;
      const bannerHeight = bannerEl?.getBoundingClientRect().height ?? 0;
      const topOffset = (headerEl?.getBoundingClientRect().height ?? 0) + bannerHeight + topGap;
      const controlOffset = lockedControlOffset;
      const controlTop = scrollY + wrapRect.top + controlOffset;

      const start = controlTop - topOffset;
      const end = containerBottom - topOffset - stickyHeight;

      if (scrollY < start) {
        reset();
        lockedWidth = measureRestingWidth();
        lockedHeight = measureRestingHeight();
        lockedControlOffset = measureRestingControlOffset();
        return;
      }

      if (!lockedWidth) {
        lockedWidth = measureRestingWidth();
      }
      if (!lockedHeight) {
        lockedHeight = measureRestingHeight();
      }
      if (!lockedControlOffset) {
        lockedControlOffset = measureRestingControlOffset();
      }
      const width = Math.min(lockedWidth, Math.max(220, window.innerWidth - 16));
      wrap.style.height = `${Math.max(lockedHeight, stickyHeight)}px`;
      wrap.style.width = `${width}px`;
      const currentWrapRect = wrap.getBoundingClientRect();
      const left = Math.min(Math.max(Math.round(currentWrapRect.left), 8), Math.max(8, window.innerWidth - width - 8));

      if (scrollY <= end) {
        stickyEl.style.position = "fixed";
        stickyEl.style.top = `${topOffset - controlOffset}px`;
        stickyEl.style.left = `${left}px`;
        stickyEl.style.width = `${width}px`;
        stickyEl.style.zIndex = "20";
        return;
      }

      const absoluteTop = container.clientHeight - stickyHeight;
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
  }, [resolvedContainerRef]);

  return (
    <div ref={resolvedContainerRef} className={className}>
      <div ref={wrapRef} className="relative h-16 sm:h-[4.5rem]">
        <div ref={stickyRef} className="w-fit max-w-full overflow-visible">
          <div className="inline-flex max-w-full items-center justify-center rounded-full bg-[#ff6f95] p-[2px] shadow-[0_18px_38px_rgba(114,112,111,0.24)]">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
