"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ProductionScheduleReviewModal from "../ProductionScheduleReviewModal";
import SplitOrderDecisionModal from "../SplitOrderDecisionModal";

type PremadeGroupShipButtonProps = {
  action: (formData: FormData) => void | Promise<void>;
  orderIds: string;
  companionOrderIds?: string;
  baseOrderNumber: string;
  companionLabel?: string;
  companionActionLabel?: string;
  buttonLabel: string;
  companionScheduleHref?: string;
  companionScheduleMessage?: string;
  redirectTo?: string;
};

export function PremadeGroupShipButton({
  action,
  orderIds,
  companionOrderIds,
  baseOrderNumber,
  companionLabel,
  companionActionLabel,
  buttonLabel,
  companionScheduleHref,
  companionScheduleMessage,
  redirectTo,
}: PremadeGroupShipButtonProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const includeCompanionRef = useRef<HTMLInputElement | null>(null);
  const promptHandledRef = useRef<HTMLInputElement | null>(null);
  const [splitPromptOpen, setSplitPromptOpen] = useState(false);
  const [schedulePromptOpen, setSchedulePromptOpen] = useState(false);

  const submitWithDecision = (includeCompanion: boolean) => {
    if (includeCompanionRef.current) {
      includeCompanionRef.current.value = includeCompanion ? "on" : "";
    }
    if (promptHandledRef.current) {
      promptHandledRef.current.value = "on";
    }
    setSplitPromptOpen(false);
    formRef.current?.requestSubmit();
  };

  return (
    <>
      <form
        ref={formRef}
        action={action}
        onSubmit={(event) => {
          if (promptHandledRef.current?.value === "on") {
            promptHandledRef.current.value = "";
            return;
          }

          if (companionOrderIds && companionLabel && companionActionLabel) {
            event.preventDefault();
            setSplitPromptOpen(true);
          }
        }}
      >
        <input type="hidden" name="order_ids" value={orderIds} />
        <input type="hidden" name="companion_order_ids" value={companionOrderIds ?? ""} />
        <input ref={includeCompanionRef} type="hidden" name="include_companion" value="" />
        <input ref={promptHandledRef} type="hidden" name="_split_prompt_handled" value="" />
        {redirectTo ? <input type="hidden" name="redirect_to" value={redirectTo} /> : null}
        <button
          type="submit"
          className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
        >
          {buttonLabel}
        </button>
      </form>

      {companionOrderIds && companionLabel && companionActionLabel ? (
        <SplitOrderDecisionModal
          open={splitPromptOpen}
          baseOrderNumber={baseOrderNumber}
          companionLabel={companionLabel}
          companionActionLabel={companionActionLabel}
          onYes={() => {
            if (companionScheduleHref && companionScheduleMessage) {
              setSplitPromptOpen(false);
              setSchedulePromptOpen(true);
              return;
            }
            submitWithDecision(true);
          }}
          onNo={() => submitWithDecision(false)}
          onCancel={() => setSplitPromptOpen(false)}
        />
      ) : null}

      <ProductionScheduleReviewModal
        open={schedulePromptOpen}
        message={companionScheduleMessage ?? ""}
        onCancel={() => setSchedulePromptOpen(false)}
        onUpdateSchedule={() => {
          if (!companionScheduleHref) return;
          router.push(companionScheduleHref);
        }}
      />
    </>
  );
}
