"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";

function Spinner() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 animate-spin motion-reduce:animate-none"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="9" className="opacity-25" />
      <path d="M21 12a9 9 0 0 0-9-9" className="opacity-90" />
    </svg>
  );
}

type AdminSubmitButtonProps = ComponentProps<"button"> & {
  pendingLabel?: ReactNode;
  confirmMessage?: string;
};

export function AdminSubmitButton({ children, className = "", pendingLabel, disabled, confirmMessage, onClick, ...props }: AdminSubmitButtonProps) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;

  return (
    <button
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented && confirmMessage && !window.confirm(confirmMessage)) event.preventDefault();
      }}
      disabled={isDisabled}
      aria-busy={pending || undefined}
      className={`${className} ${pending ? "cursor-wait opacity-80" : ""}`.trim()}
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <Spinner />
          <span>{pendingLabel ?? "Working…"}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
