"use client";

import { useFormStatus } from "react-dom";

export function SendInvoiceButton({
  delivery,
}: {
  delivery: "invoice" | "pdf";
}) {
  const { pending } = useFormStatus();
  const isPdf = delivery === "pdf";
  return (
    <button
      type="submit"
      name="invoice_delivery"
      value={delivery}
      disabled={pending}
      onClick={(event) => {
        if (
          !window.confirm(
            isPdf
              ? "Email this PDF bank-transfer invoice to the customer now? Check the recipient and total first."
              : "Publish and send this Square payment invoice to the customer now? Check the recipient and total first.",
          )
        )
          event.preventDefault();
      }}
      className={`inline-flex items-center justify-center rounded border px-4 py-2 text-sm font-semibold disabled:cursor-wait disabled:border-zinc-300 disabled:bg-zinc-200 disabled:text-zinc-500 ${
        isPdf
          ? "border-zinc-300 bg-white text-zinc-800 hover:border-zinc-400"
          : "border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800"
      }`}
    >
      {pending ? "Sending..." : isPdf ? "Send PDF" : "Send invoice"}
    </button>
  );
}
