"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";

/** The browser's top layer keeps focus inside the drawer and restores it on close. */
export function StudioPanel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    titleId = useId();
  useEffect(() => {
    const node = dialog.current!;
    node.showModal();
    return () => node.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-dvh w-[min(900px,100vw)] max-w-full border-0 bg-white p-0 text-zinc-900 shadow-2xl backdrop:bg-black/30"
    >
      <div className="flex h-full flex-col">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-zinc-200 px-5 py-4">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
          >
            Close
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </dialog>
  );
}
