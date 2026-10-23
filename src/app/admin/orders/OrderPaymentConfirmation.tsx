"use client";

import { useFormStatus } from "react-dom";
import { markOrderAsPaid } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 disabled:opacity-50"
    >
      {pending ? "Recording…" : "Record payment received"}
    </button>
  );
}
export function OrderPaymentConfirmation({
  id,
  combined,
}: {
  id: string;
  combined: boolean;
}) {
  return (
    <form
      action={markOrderAsPaid}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Confirm you have independently checked that payment was received${combined ? " for the whole combined invoice" : ""}. This records payment; it does not charge the customer.`,
          )
        )
          event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Submit />
    </form>
  );
}
