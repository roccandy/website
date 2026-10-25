"use client";

import { AdminSubmitButton } from "@/components/AdminSubmitButton";
import { useFormStatus } from "react-dom";
import { markOrderAsPaid } from "./actions";
import { useState } from "react";

function Submit({ square }: { square: boolean }) {
  const { pending } = useFormStatus();
  return (
    <AdminSubmitButton
      type="submit"
      disabled={pending}
      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 disabled:opacity-50"
    >
      {pending ? "Checking…" : square ? "Check Square payment" : "Confirm bank transfer received"}
    </AdminSubmitButton>
  );
}
export function OrderPaymentConfirmation({
  id,
  combined,
  square = false,
  total = 0,
}: {
  id: string;
  combined: boolean;
  square?: boolean;
  total?: number;
}) {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">Record bank transfer</button>;
  return (
    <form
      action={markOrderAsPaid}
      className="w-full max-w-xl space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4"
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="return_to" value={`/admin/orders/${encodeURIComponent(id)}/invoice`} />
      <p className="text-sm font-semibold">Bank transfer{combined ? " — whole combined invoice" : ""}</p>
      {square ? <div className="space-y-2 text-sm text-zinc-600"><p>Record the transfer against this invoice in Square first. This stops the invoice remaining payable and prevents further payment reminders.</p><a href="https://app.squareup.com/dashboard/invoices" target="_blank" rel="noopener noreferrer" className="inline-block font-semibold text-emerald-800 underline">Open Square to record the transfer ↗</a><p>Then check below. We only mark this invoice paid after Square confirms the full amount. This does not charge the customer.</p></div> : <>
        <p className="text-xs text-zinc-600">Only confirm after checking your bank account. This records the full payment; it does not charge the customer or send another confirmation email.</p>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs">Amount received (AUD)<input name="payment_amount" type="number" min="0.01" step="0.01" required defaultValue={total.toFixed(2)} className="mt-1 w-full rounded border bg-white px-3 py-2" /></label><label className="text-xs">Date received<input name="payment_date" type="date" required defaultValue={new Intl.DateTimeFormat("en-CA", {timeZone:"Australia/Perth"}).format(new Date())} max={new Intl.DateTimeFormat("en-CA", {timeZone:"Australia/Perth"}).format(new Date())} className="mt-1 w-full rounded border bg-white px-3 py-2" /></label></div>
        <label className="block text-xs">Bank reference (optional)<input name="payment_reference" maxLength={200} className="mt-1 w-full rounded border bg-white px-3 py-2" /></label>
        <label className="flex items-start gap-2 text-xs"><input type="checkbox" required className="mt-0.5" />I have checked that the full invoice amount has reached our bank account.</label>
      </>}
      <div className="flex gap-2"><Submit square={square} /><button type="button" onClick={() => setOpen(false)} className="rounded-lg border px-3 py-2 text-xs">Cancel</button></div>
    </form>
  );
}
