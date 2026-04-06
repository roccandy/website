"use client";

import { useEffect, useRef } from "react";

type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

type AnimatedHeadingProps = {
  as?: HeadingTag;
  className?: string;
  children: React.ReactNode;
};

const MOTION_KEYFRAMES: Keyframe[] = [
  { opacity: 0, transform: "scale(0.96)" },
  { opacity: 1, transform: "scale(1)" },
];

const MOTION_OPTIONS: KeyframeAnimationOptions = {
  duration: 720,
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
  fill: "both",
};

export function AnimatedHeading({
  as = "h1",
  className = "",
  children,
}: AnimatedHeadingProps) {
  const ref = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const shouldReduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (shouldReduceMotion) return;

    const play = () => {
      if (!ref.current || typeof ref.current.animate !== "function") return;
      ref.current.getAnimations().forEach((animation) => animation.cancel());
      ref.current.animate(MOTION_KEYFRAMES, MOTION_OPTIONS);
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        play();
      }
    };

    play();
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  const Tag = as;

  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}
