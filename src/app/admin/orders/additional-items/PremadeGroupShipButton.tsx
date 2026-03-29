"use client";

import { useRef } from "react";

type PremadeGroupShipButtonProps = {
  action: (formData: FormData) => void | Promise<void>;
  orderIds: string;
  companionOrderIds?: string;
  baseOrderNumber: string;
  companionLabel?: string;
  companionActionLabel?: string;
  buttonLabel: string;
};

export function PremadeGroupShipButton({
  action,
  orderIds,
  companionOrderIds,
  baseOrderNumber,
  companionLabel,
  companionActionLabel,
  buttonLabel,
}: PremadeGroupShipButtonProps) {
  const includeCompanionRef = useRef<HTMLInputElement | null>(null);

  return (
    <form
      action={action}
      onSubmit={() => {
        if (!includeCompanionRef.current) return;
        if (!companionOrderIds || !companionLabel || !companionActionLabel) {
          includeCompanionRef.current.value = "";
          return;
        }
        includeCompanionRef.current.value = window.confirm(
          `Order #${baseOrderNumber} has multiple items. Would you like to mark ${companionLabel} as ${companionActionLabel} too?`,
        )
          ? "on"
          : "";
      }}
    >
      <input type="hidden" name="order_ids" value={orderIds} />
      <input type="hidden" name="companion_order_ids" value={companionOrderIds ?? ""} />
      <input ref={includeCompanionRef} type="hidden" name="include_companion" value="" />
      <button
        type="submit"
        className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
      >
        {buttonLabel}
      </button>
    </form>
  );
}
