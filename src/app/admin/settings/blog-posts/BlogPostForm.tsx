"use client";

import { useActionState, type ReactNode } from "react";
import { saveBlogPostAction } from "./actions";

export function BlogPostForm({ children, className }: { children: ReactNode; className?: string }) {
  const [state, formAction] = useActionState(saveBlogPostAction, { error: null });

  return (
    <form action={formAction} className={className}>
      {state.error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          {state.error}
        </p>
      ) : null}
      {children}
    </form>
  );
}
