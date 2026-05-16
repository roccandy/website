"use client";

import { useState } from "react";

type RefundMode = "full" | "partial";
type RefundStep = "mode" | "amount" | "reason";

type RefundFormProps = {
  orderId: string;
  orderIds?: string[];
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

const formatInputAmount = (value: number) => value.toFixed(2);

export function RefundForm({
  orderId,
  orderIds,
  orderNumber,
  amount,
  helperText,
  action,
  redirectTo,
  compact = false,
}: RefundFormProps) {
  const [reason, setReason] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<RefundStep>("mode");
  const [refundMode, setRefundMode] = useState<RefundMode>("full");
  const [refundAmount, setRefundAmount] = useState("");
  const label = orderNumber ? `#${orderNumber}` : "payment";
  const maxRefundAmount = Number.isFinite(amount) && Number(amount) > 0 ? Number(amount) : null;
  const amountLabel = formatAmount(amount);
  const refundLabel = amountLabel ? `Refund ${label} (${amountLabel})` : `Refund ${label}`;
  const buttonLabel = compact ? `Refund ${label}` : refundLabel;
  const modalTitleId = `refund-title-${orderId}`;
  const parsedRefundAmount = Number(refundAmount);
  const hasValidPartialAmount =
    refundMode === "partial" &&
    maxRefundAmount !== null &&
    Number.isFinite(parsedRefundAmount) &&
    parsedRefundAmount > 0 &&
    parsedRefundAmount <= maxRefundAmount;
  const submittedRefundAmount =
    refundMode === "partial" && hasValidPartialAmount
      ? parsedRefundAmount
      : maxRefundAmount;
  const submittedRefundAmountLabel = formatAmount(submittedRefundAmount);

  const openModal = () => {
    setReason("");
    setStep("mode");
    setRefundMode("full");
    setRefundAmount("");
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
  };

  const selectFullRefund = () => {
    setRefundMode("full");
    setRefundAmount(maxRefundAmount !== null ? formatInputAmount(maxRefundAmount) : "");
    setStep("reason");
  };

  const selectPartialRefund = () => {
    setRefundMode("partial");
    setRefundAmount("");
    setStep("amount");
  };

  const updateRefundAmount = (value: string) => {
    if (!value) {
      setRefundAmount("");
      return;
    }

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return;
    }

    if (maxRefundAmount !== null && numericValue > maxRefundAmount) {
      setRefundAmount(formatInputAmount(maxRefundAmount));
      return;
    }

    setRefundAmount(value);
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="inline-flex items-center rounded-md border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 hover:border-rose-300 hover:text-rose-800"
      >
        {buttonLabel}
      </button>
      {isOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-zinc-950/35 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={modalTitleId}
        >
          <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
            <div className="space-y-1">
              <h3 id={modalTitleId} className="admin-card-title text-zinc-900">
                {refundLabel}
              </h3>
              {step === "mode" ? (
                <p className="text-sm text-zinc-600">Choose whether this is a full refund or a partial refund.</p>
              ) : null}
              {step === "amount" ? (
                <p className="text-sm text-zinc-600">Enter the partial refund amount. The maximum is {amountLabel ?? "the order total"}.</p>
              ) : null}
              {step === "reason" ? (
                <p className="text-sm text-zinc-600">
                  Add the refund reason. The customer will see this reason in their refund email.
                </p>
              ) : null}
            </div>

            {step === "mode" ? (
              <div className="mt-4 space-y-3">
                <button
                  type="button"
                  onClick={selectFullRefund}
                  className="flex w-full items-center justify-between rounded-xl border border-zinc-200 px-3 py-2 text-left text-sm font-semibold text-zinc-800 hover:border-rose-200 hover:bg-rose-50"
                >
                  <span>Full refund</span>
                  <span className="text-xs font-medium text-zinc-500">{amountLabel ?? "Order total"}</span>
                </button>
                <button
                  type="button"
                  onClick={selectPartialRefund}
                  disabled={maxRefundAmount === null}
                  className="flex w-full items-center justify-between rounded-xl border border-zinc-200 px-3 py-2 text-left text-sm font-semibold text-zinc-800 hover:border-rose-200 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span>Partial refund</span>
                  <span className="text-xs font-medium text-zinc-500">Custom amount</span>
                </button>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-600 hover:border-zinc-300 hover:text-zinc-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            {step === "amount" ? (
              <div className="mt-4 space-y-3">
                <label className="block space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Refund amount</span>
                  <input
                    type="number"
                    min="0.01"
                    max={maxRefundAmount ?? undefined}
                    step="0.01"
                    inputMode="decimal"
                    value={refundAmount}
                    onChange={(event) => updateRefundAmount(event.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-700 placeholder:text-zinc-400"
                    autoFocus
                  />
                </label>
                <p className="text-[11px] leading-4 text-zinc-500">
                  Maximum refund amount: {amountLabel ?? "order total"}.
                </p>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setStep("mode")}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-600 hover:border-zinc-300 hover:text-zinc-800"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep("reason")}
                    disabled={!hasValidPartialAmount}
                    className="inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:border-rose-300 hover:text-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}

            {step === "reason" ? (
              <form action={action} className="mt-4 space-y-3">
                <input type="hidden" name="id" value={orderId} />
                {orderIds && orderIds.length > 1 ? <input type="hidden" name="ids" value={orderIds.join(",")} /> : null}
                {redirectTo ? <input type="hidden" name="redirect_to" value={redirectTo} /> : null}
                <input type="hidden" name="refund_type" value={refundMode} />
                <input type="hidden" name="refund_amount" value={submittedRefundAmount ?? ""} />
                <input type="hidden" name="refund_reason" value={reason} />
                <label className="block space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Customer-visible reason</span>
                  <input
                    type="text"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Refund reason (optional)"
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-700 placeholder:text-zinc-400"
                    autoFocus
                  />
                </label>
                <p className="text-[11px] leading-4 text-zinc-500">
                  {refundMode === "partial" ? "Partial refund" : "Full refund"}
                  {submittedRefundAmountLabel ? `: ${submittedRefundAmountLabel}. ` : ". "}
                  This reason is included in the customer email.
                </p>
                {helperText ? <p className="text-[11px] leading-4 text-zinc-500">{helperText}</p> : null}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setStep(refundMode === "partial" ? "amount" : "mode")}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-600 hover:border-zinc-300 hover:text-zinc-800"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={closeModal}
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
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
