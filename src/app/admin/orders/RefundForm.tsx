"use client";

import { useState } from "react";

type RefundFormProps = {
  orderId: string;
  orderNumber?: string | null;
  amount?: number | null;
  helperText?: string | null;
  action: (formData: FormData) => void;
  redirectTo?: string;
};

const formatAmount = (value: number | null | undefined) => {
  if (!Number.isFinite(value)) return null;
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(Number(value));
};

export function RefundForm({
  orderId,
  orderNumber,
  amount,
  helperText,
  action,
  redirectTo,
}: RefundFormProps) {
  const [reason, setReason] = useState("");
  const label = orderNumber ? `#${orderNumber}` : "payment";
  const amountLabel = formatAmount(amount);
  const refundLabel = amountLabel ? `Refund ${label} (${amountLabel})` : `Refund ${label}`;

  return (
    <form
      action={action}
      onSubmit={(event) => {
        const confirmed = window.confirm(`${refundLabel}? This cannot be undone.`);
        if (!confirmed) event.preventDefault();
      }}
      className="space-y-2"
    >
      <input type="hidden" name="id" value={orderId} />
      {redirectTo ? <input type="hidden" name="redirect_to" value={redirectTo} /> : null}
      <input type="hidden" name="refund_reason" value={reason} />
      <input
        type="text"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Refund reason (optional)"
        className="w-full rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-700 placeholder:text-zinc-400"
      />
      {helperText ? <p className="text-[11px] leading-4 text-zinc-500">{helperText}</p> : null}
      <button
        type="submit"
        className="inline-flex items-center rounded-md border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 hover:border-rose-300 hover:text-rose-800"
      >
        {refundLabel}
      </button>
    </form>
  );
}
