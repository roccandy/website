"use client";

import { useState } from "react";

type RefundFormProps = {
  orderId: string;
  orderNumber?: string | null;
  amount?: number | null;
  helperText?: string | null;
  action: (formData: FormData) => void;
  redirectTo?: string;
  compact?: boolean;
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
  compact = false,
}: RefundFormProps) {
  const [reason, setReason] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const label = orderNumber ? `#${orderNumber}` : "payment";
  const amountLabel = formatAmount(amount);
  const refundLabel = amountLabel ? `Refund ${label} (${amountLabel})` : `Refund ${label}`;
  const buttonLabel = compact ? `Refund ${label}` : refundLabel;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center rounded-md border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 hover:border-rose-300 hover:text-rose-800"
      >
        {buttonLabel}
      </button>
      {isOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-zinc-950/35 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-zinc-900">{refundLabel}</h3>
              <p className="text-sm text-zinc-600">Add an optional refund reason, then confirm the refund.</p>
            </div>
            <form action={action} className="mt-4 space-y-3">
              <input type="hidden" name="id" value={orderId} />
              {redirectTo ? <input type="hidden" name="redirect_to" value={redirectTo} /> : null}
              <input type="hidden" name="refund_reason" value={reason} />
              <input
                type="text"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Refund reason (optional)"
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-700 placeholder:text-zinc-400"
                autoFocus
              />
              {helperText ? <p className="text-[11px] leading-4 text-zinc-500">{helperText}</p> : null}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-600 hover:border-zinc-300 hover:text-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:border-rose-300 hover:text-rose-800"
                >
                  Confirm refund
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
