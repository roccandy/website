"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  src: string;
  poster?: string;
  className?: string;
};

export default function AutoplayOnViewVideo({ src, poster, className }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isVisibleRef = useRef(false);
  const hasPreloadedRef = useRef(false);
  const [isInView, setIsInView] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const node = videoRef.current;
    if (!node) return;

    node.muted = true;
    node.defaultMuted = true;
    node.playsInline = true;

    const tryPlay = () => {
      const playPromise = node.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          // Browser may delay autoplay until more media data is buffered.
        });
      }
    };

    const playObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        const shouldPlay = entry.isIntersecting && entry.intersectionRatio > 0;
        isVisibleRef.current = shouldPlay;
        setIsInView(shouldPlay);
        if (shouldPlay) {
          tryPlay();
        } else {
          node.pause();
        }
      },
      { threshold: [0, 0.1], rootMargin: "120px 0px 120px 0px" }
    );

    const preloadObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry || !entry.isIntersecting || hasPreloadedRef.current) return;
        hasPreloadedRef.current = true;
        node.preload = "auto";
        node.load();
        preloadObserver.disconnect();
      },
      { threshold: 0.01, rootMargin: "900px 0px" }
    );

    const handleCanPlay = () => {
      setIsReady(true);
      if (isVisibleRef.current) {
        tryPlay();
      }
    };

    const handlePlaying = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => setIsPlaying(false);
    const handleEnded = () => {
      // Some browsers can intermittently miss seamless loop on autoplay videos.
      if (!isVisibleRef.current) return;
      node.currentTime = 0;
      tryPlay();
    };

    const retryTimer = window.setInterval(() => {
      if (isVisibleRef.current && node.paused) {
        tryPlay();
      }
    }, 900);

    node.addEventListener("loadeddata", handleCanPlay);
    node.addEventListener("canplay", handleCanPlay);
    node.addEventListener("playing", handlePlaying);
    node.addEventListener("pause", handlePause);
    node.addEventListener("waiting", handleWaiting);
    node.addEventListener("ended", handleEnded);
    playObserver.observe(node);
    preloadObserver.observe(node);

    return () => {
      window.clearInterval(retryTimer);
      node.removeEventListener("loadeddata", handleCanPlay);
      node.removeEventListener("canplay", handleCanPlay);
      node.removeEventListener("playing", handlePlaying);
      node.removeEventListener("pause", handlePause);
      node.removeEventListener("waiting", handleWaiting);
      node.removeEventListener("ended", handleEnded);
      playObserver.disconnect();
      preloadObserver.disconnect();
    };
  }, []);

  const showLoader = isInView && (!isReady || !isPlaying);

  return (
    <div className="relative h-full w-full overflow-hidden">
      {poster ? (
        <img
          src={poster}
          alt=""
          aria-hidden="true"
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
            isPlaying ? "opacity-0" : "opacity-100"
          }`}
        />
      ) : null}
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
      {showLoader ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/12">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/55 border-t-white" />
        </div>
      ) : null}
    </div>
  );
}
