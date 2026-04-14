"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";

function Spinner() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 animate-spin"
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

type AdminSubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingLabel?: ReactNode;
};

export function AdminSubmitButton({ children, className = "", pendingLabel, disabled, ...props }: AdminSubmitButtonProps) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;

  return (
    <button
      {...props}
      disabled={isDisabled}
      aria-busy={pending || undefined}
      className={`${className} ${pending ? "cursor-wait opacity-80" : ""}`.trim()}
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <Spinner />
          <span>{pendingLabel ?? children}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
