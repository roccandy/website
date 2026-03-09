"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function AdminQueryToast() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const handledRef = useRef<string | null>(null);
  const toast = searchParams.get("toast");
  const message = searchParams.get("message");

  useEffect(() => {
    if (!toast || !message) return;

    const key = `${toast}:${message}:${pathname}`;
    if (handledRef.current === key) return;
    handledRef.current = key;

    if (toast === "success" || toast === "error") {
      window.dispatchEvent(new CustomEvent("toast", { detail: { tone: toast, message } }));
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("toast");
    nextParams.delete("message");
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [message, pathname, router, searchParams, toast]);

  return null;
}
