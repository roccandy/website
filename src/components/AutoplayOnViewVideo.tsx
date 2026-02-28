"use client";

import { useEffect, useRef } from "react";

type Props = {
  src: string;
  poster?: string;
  className?: string;
};

export default function AutoplayOnViewVideo({ src, poster, className }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const node = videoRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        if (entry.isIntersecting) {
          void node.play().catch(() => {
            // Browsers may block play until user gesture in edge cases.
          });
        } else {
          node.pause();
        }
      },
      { threshold: 0.45 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <video
      ref={videoRef}
      className={className}
      muted
      loop
      playsInline
      preload="metadata"
      poster={poster}
      controls={false}
      aria-label="Roc Candy feature video"
    >
      <source src={src} type="video/mp4" />
    </video>
  );
}
