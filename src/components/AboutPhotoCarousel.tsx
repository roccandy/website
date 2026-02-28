"use client";

import { useEffect, useMemo, useState } from "react";

const ABOUT_IMAGES = [
  "/about-carousel/about-1.jpg",
  "/about-carousel/about-2.jpg",
  "/about-carousel/about-3.jpg",
  "/about-carousel/about-4.jpg",
];

const AUTOPLAY_MS = 3500;

export default function AboutPhotoCarousel() {
  const [index, setIndex] = useState(0);
  const [animated, setAnimated] = useState(true);

  const slides = useMemo(() => [...ABOUT_IMAGES, ...ABOUT_IMAGES.slice(0, 2)], []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((current) => current + 1);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (animated) return;
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setAnimated(true));
    });
    return () => window.cancelAnimationFrame(id);
  }, [animated]);

  const handleTransitionEnd = () => {
    if (index < ABOUT_IMAGES.length) return;
    setAnimated(false);
    setIndex(0);
  };

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white/90 p-2 shadow-sm">
      <div className="overflow-hidden rounded-2xl">
        <div
          className="flex"
          style={{
            transform: `translateX(-${index * 50}%)`,
            transition: animated ? "transform 650ms ease" : "none",
          }}
          onTransitionEnd={handleTransitionEnd}
        >
          {slides.map((src, slideIndex) => (
            <div key={`${src}-${slideIndex}`} className="w-1/2 shrink-0 p-1">
              <img
                src={src}
                alt={`Roc Candy gallery image ${((slideIndex % ABOUT_IMAGES.length) + 1).toString()}`}
                className="h-60 w-full rounded-xl object-cover md:h-72"
                loading={slideIndex < 2 ? "eager" : "lazy"}
                onError={(event) => {
                  event.currentTarget.src = "/landing/hero-bg.webp";
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
