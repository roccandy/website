"use client";

import { useEffect, useRef } from "react";

type Props = {
  src: string;
  poster?: string;
  className?: string;
};

export default function AutoplayOnViewVideo({ src, poster, className }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isVisibleRef = useRef(false);

  useEffect(() => {
    const node = videoRef.current;
    if (!node) return;

    const tryPlay = () => {
      const playPromise = node.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          // Browser may delay autoplay until more media data is buffered.
        });
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        isVisibleRef.current = entry.isIntersecting;
        if (entry.isIntersecting) {
          tryPlay();
        } else {
          node.pause();
        }
      },
      { threshold: 0.2 }
    );

    const handleCanPlay = () => {
      if (isVisibleRef.current) {
        tryPlay();
      }
    };

    node.addEventListener("loadeddata", handleCanPlay);
    node.addEventListener("canplay", handleCanPlay);
    observer.observe(node);

    return () => {
      node.removeEventListener("loadeddata", handleCanPlay);
      node.removeEventListener("canplay", handleCanPlay);
      observer.disconnect();
    };
  }, []);

  return (
    <video
      ref={videoRef}
      className={className}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      poster={poster}
      controls={false}
      disablePictureInPicture
      aria-label="Roc Candy feature video"
    >
      <source src={src} type="video/mp4" />
    </video>
  );
}
