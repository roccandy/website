"use client";

import SplitAwareActionForm from "../SplitAwareActionForm";

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
  return (
    <SplitAwareActionForm
      action={action}
      hiddenFields={[{ name: "order_ids", value: orderIds }]}
      buttonLabel={buttonLabel}
      buttonClassName="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
      companionMeta={
        companionOrderIds && companionLabel && companionActionLabel
          ? {
              baseOrderNumber,
              companionOrderIds,
              companionLabel,
              companionActionLabel,
              shouldPromptForCompanion: true,
            }
          : null
      }
    />
  );
}
