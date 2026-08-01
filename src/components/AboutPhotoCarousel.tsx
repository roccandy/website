"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

const ABOUT_IMAGES = [
  {
    src: "/about-carousel/about-1.jpg",
    alt: "Andy and Sylvi from Roc Candy",
  },
  {
    src: "/about-carousel/about-2.png",
    alt: "Roc Candy confectioner ready to make handmade candy",
  },
  {
    src: "/about-carousel/about-3.png",
    alt: "Personalised Roc Candy made for Kye and Melissa",
  },
  {
    src: "/about-carousel/about-4.png",
    alt: "Roc Candy confectioners with colourful handmade lollipops",
  },
  {
    src: "/about-carousel/about-5.png",
    alt: "Roc Candy confectioner hand-pulling green candy",
  },
  {
    src: "/about-carousel/about-6.png",
    alt: "Roc Candy team celebrating a special day in the original shop",
  },
  {
    src: "/about-carousel/about-7.png",
    alt: "Roc Candy confectioner hand-pulling red candy",
  },
];

const AUTOPLAY_MS = 3500;
const FALLBACK_IMAGE = "/landing/watercolour-hero-Homepage_2.webp";

export default function AboutPhotoCarousel() {
  const [index, setIndex] = useState(0);
  const [animated, setAnimated] = useState(true);
  const [brokenSlides, setBrokenSlides] = useState<Record<string, boolean>>({});

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
          {slides.map((slide, slideIndex) => (
            <div key={`${slide.src}-${slideIndex}`} className="w-1/2 shrink-0 p-1">
              <div className="relative h-60 w-full overflow-hidden rounded-xl bg-zinc-100 md:h-96">
                <Image
                  src={brokenSlides[slide.src] ? FALLBACK_IMAGE : slide.src}
                  alt={slide.alt}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 50vw, 33vw"
                  quality={90}
                  priority={slideIndex < 2}
                  onError={() => {
                    setBrokenSlides((current) =>
                      current[slide.src] ? current : { ...current, [slide.src]: true },
                    );
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
