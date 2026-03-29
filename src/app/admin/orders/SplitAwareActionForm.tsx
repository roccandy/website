"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SplitOrderDecisionModal from "./SplitOrderDecisionModal";

type SplitCompanionMeta = {
  baseOrderNumber: string;
  companionOrderIds: string;
  companionLabel: string;
  companionActionLabel: string;
  shouldPromptForCompanion: boolean;
};

type HiddenField = {
  name: string;
  value: string;
};

type SplitAwareActionFormProps = {
  action: (formData: FormData) => Promise<{
    ok: boolean;
    tone: "success" | "error";
    message: string;
  }>;
  hiddenFields: HiddenField[];
  buttonLabel: string;
  buttonClassName: string;
  confirmMessage?: string;
  companionMeta?: SplitCompanionMeta | null;
};

export default function SplitAwareActionForm({
  action,
  hiddenFields,
  buttonLabel,
  buttonClassName,
  confirmMessage,
  companionMeta,
}: SplitAwareActionFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [promptOpen, setPromptOpen] = useState(false);

  const emitToast = (tone: "success" | "error", message: string) => {
    window.dispatchEvent(new CustomEvent("toast", { detail: { tone, message } }));
  };

  const submitWithDecision = (includeCompanion: boolean) => {
    startTransition(async () => {
      const formData = new FormData();
      hiddenFields.forEach((field) => {
        formData.set(field.name, field.value);
      });
      formData.set("companion_order_ids", companionMeta?.companionOrderIds ?? "");
      if (includeCompanion) {
        formData.set("include_companion", "on");
      }

      try {
        const result = await action(formData);
        if (result?.message) {
          emitToast(result.tone, result.message);
        }
        if (result?.ok) {
          setPromptOpen(false);
          router.refresh();
        }
      } catch (error) {
        emitToast("error", error instanceof Error ? error.message : "Unable to complete order.");
      }
    });
  };

  return (
    <>
      <button
        type="button"
        disabled={isPending}
        className={`${buttonClassName} disabled:cursor-not-allowed disabled:opacity-50`}
        onClick={() => {
          if (companionMeta?.shouldPromptForCompanion) {
            setPromptOpen(true);
            return;
          }

          if (confirmMessage) {
            const confirmed = window.confirm(confirmMessage);
            if (!confirmed) {
              return;
            }
          }

          submitWithDecision(false);
        }}
      >
        {buttonLabel}
      </button>

      {companionMeta ? (
        <SplitOrderDecisionModal
          open={promptOpen}
          baseOrderNumber={companionMeta.baseOrderNumber}
          companionLabel={companionMeta.companionLabel}
          companionActionLabel={companionMeta.companionActionLabel}
          onYes={() => submitWithDecision(true)}
          onNo={() => submitWithDecision(false)}
          onCancel={() => setPromptOpen(false)}
        />
      ) : null}
    </>
  );
}
