"use client";

import { useEffect } from "react";

const MOBILE_BREAKPOINT_QUERY = "(max-width: 767px)";
const SCROLL_THRESHOLD = 8;

export default function MobileHeaderShrinkOnScroll() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const body = document.body;
    const mediaQuery = window.matchMedia(MOBILE_BREAKPOINT_QUERY);

    const applyState = () => {
      if (!mediaQuery.matches) {
        body.classList.remove("mobile-header-scrolled");
        return;
      }
      const isScrolled = window.scrollY > SCROLL_THRESHOLD;
      body.classList.toggle("mobile-header-scrolled", isScrolled);
    };

    applyState();
    window.addEventListener("scroll", applyState, { passive: true });
    mediaQuery.addEventListener("change", applyState);

    return () => {
      window.removeEventListener("scroll", applyState);
      mediaQuery.removeEventListener("change", applyState);
      body.classList.remove("mobile-header-scrolled");
    };
  }, []);

  return null;
}
