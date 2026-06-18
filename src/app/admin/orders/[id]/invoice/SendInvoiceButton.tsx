"use client";

import { useFormStatus } from "react-dom";

export function SendInvoiceButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded border border-zinc-900 bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-wait disabled:border-zinc-300 disabled:bg-zinc-200 disabled:text-zinc-500"
    >
      {pending ? "Sending invoice..." : "Send invoice"}
    </button>
  );
}
