"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal, X } from "lucide-react";
import { AdminLink } from "../AdminNavigationFeedback";
import { AdminModalPortal } from "../AdminModalPortal";
export function OrderRowActionMenu({
  orderId,
  label,
  count,
  primary,
  children,
}: {
  orderId: string;
  label: string;
  count: number;
  primary: { label: string; href: string } | null;
  children: ReactNode;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<{
    top: number;
    right: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const close = () => setPosition(null);
  useEffect(() => {
    if (!position) return;
    const dismiss = () => setPosition(null);
    window.addEventListener("resize", dismiss);
    return () => window.removeEventListener("resize", dismiss);
  }, [position]);
  const open = () => {
    const rect = trigger.current?.getBoundingClientRect();
    const maxHeight = Math.min(560, window.innerHeight - 32),
      width = Math.min(420, window.innerWidth - 32);
    setPosition({
      top: Math.max(
        16,
        Math.min((rect?.bottom ?? 16) + 8, window.innerHeight - maxHeight - 16),
      ),
      right: Math.max(
        16,
        Math.min(
          window.innerWidth - (rect?.right ?? window.innerWidth - 16),
          window.innerWidth - width - 16,
        ),
      ),
      width,
      maxHeight,
    });
  };
  const style =
    "inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-lg border px-2.5 text-xs font-semibold";
  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      {count === 1 ? (
        <AdminLink
          href={`/admin/orders/${orderId}`}
          className={`${style} border-emerald-200 bg-emerald-50 text-emerald-900`}
        >
          View order
        </AdminLink>
      ) : (
        <button
          type="button"
          onClick={open}
          className={`${style} border-emerald-200 bg-emerald-50 text-emerald-900`}
        >
          View orders ({count})
        </button>
      )}
      {count === 1 && primary ? (
        <AdminLink
          href={primary.href}
          className={`${style} border-zinc-200 bg-white text-zinc-700 hover:border-emerald-600`}
        >
          {primary.label}
        </AdminLink>
      ) : null}
      <button
        ref={trigger}
        type="button"
        onClick={open}
        title={`More actions for ${label}`}
        aria-label={`More actions for ${label}`}
        aria-haspopup="dialog"
        aria-expanded={Boolean(position)}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400"
      >
        <MoreHorizontal size={16} />
      </button>
      {position ? (
        <AdminModalPortal onClose={close}>
          <div className="fixed inset-0 z-[55] bg-zinc-950/15" onClick={close}>
            <section
              role="dialog"
              aria-modal="true"
              aria-label={`Actions for ${label}`}
              style={position}
              className="fixed overflow-y-auto whitespace-normal rounded-xl border border-zinc-200 bg-white shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <header className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3">
                <h2 className="min-w-0 break-words text-sm font-semibold">
                  Actions for {label}
                </h2>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close order actions"
                  className="rounded p-1 text-zinc-500 hover:bg-zinc-100"
                >
                  <X size={16} />
                </button>
              </header>
              <div
                className="space-y-4 p-4"
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest("a")) close();
                }}
              >
                {children}
              </div>
            </section>
          </div>
        </AdminModalPortal>
      ) : null}
    </div>
  );
}
