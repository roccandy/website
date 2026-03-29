"use client";

import { useRef, useState } from "react";
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
  action: (formData: FormData) => void | Promise<void>;
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
  const formRef = useRef<HTMLFormElement | null>(null);
  const includeCompanionRef = useRef<HTMLInputElement | null>(null);
  const promptHandledRef = useRef<HTMLInputElement | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);

  const submitWithDecision = (includeCompanion: boolean) => {
    if (includeCompanionRef.current) {
      includeCompanionRef.current.value = includeCompanion ? "on" : "";
    }
    if (promptHandledRef.current) {
      promptHandledRef.current.value = "on";
    }
    setPromptOpen(false);
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

          if (companionMeta?.shouldPromptForCompanion) {
            event.preventDefault();
            setPromptOpen(true);
            return;
          }

          if (confirmMessage) {
            const confirmed = window.confirm(confirmMessage);
            if (!confirmed) {
              event.preventDefault();
            }
          }
        }}
      >
        {hiddenFields.map((field) => (
          <input key={`${field.name}:${field.value}`} type="hidden" name={field.name} value={field.value} />
        ))}
        <input
          type="hidden"
          name="companion_order_ids"
          value={companionMeta?.companionOrderIds ?? ""}
        />
        <input ref={includeCompanionRef} type="hidden" name="include_companion" value="" />
        <input ref={promptHandledRef} type="hidden" name="_split_prompt_handled" value="" />
        <button type="submit" className={buttonClassName}>
          {buttonLabel}
        </button>
      </form>

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
