"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const PERTH_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;

function millisecondsUntilNextPerthMidnight() {
  const now = new Date();
  const perth = new Date(now.getTime() + PERTH_UTC_OFFSET_MS);
  const nextMidnight = Date.UTC(perth.getUTCFullYear(), perth.getUTCMonth(), perth.getUTCDate() + 1) - PERTH_UTC_OFFSET_MS;
  return Math.max(1_000, nextMidnight - now.getTime());
}

/** Refreshes server-rendered admin chrome when Perth moves into a new day. */
export function AdminBirthdayRefresh() {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setTimeout(() => router.refresh(), millisecondsUntilNextPerthMidnight());
    return () => window.clearTimeout(timer);
  }, [router]);

  return null;
}
