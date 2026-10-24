"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";

export function LogoutButton() {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      aria-busy={pending || undefined}
      onClick={() => {
        if (pending) return;
        const callbackUrl =
          typeof window !== "undefined" ? `${window.location.origin}/admin/login` : "/admin/login";
        const proceed = () => {
          setPending(true);
          void signOut({ callbackUrl }).catch(() => {
            setPending(false);
            window.dispatchEvent(new CustomEvent("toast", { detail: { tone: "error", message: "Unable to sign out. Please try again." } }));
          });
        };
        if (window.dispatchEvent(new CustomEvent("admin:before-navigation", { cancelable: true, detail: { proceed } }))) proceed();
      }}
      className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-900"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
