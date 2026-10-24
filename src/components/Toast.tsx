"use client";

import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from "react";

type Toast = { id: string; message: string; tone: "success" | "error"; scope?: string };

type ToastContextValue = {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const recent = useRef({ key: "", time: 0 });
  const removeToast = useCallback((id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((previous) => previous.filter((toast) => toast.id !== id));
  }, []);
  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const key = `${toast.scope ?? ""}:${toast.tone}:${toast.message}`;
    if (recent.current.key === key && Date.now() - recent.current.time < 1500) return;
    recent.current = { key, time: Date.now() };
    const id = crypto.randomUUID();
    setToasts((previous) => {
      const active = toast.tone === "success" && toast.scope ? previous.filter((item) => item.scope !== toast.scope) : previous;
      if (toast.tone === "error" && active.some((item) => item.tone === "error" && item.message === toast.message && item.scope === toast.scope)) return active;
      const recentSuccesses = new Set(active.filter((item) => item.tone === "success").slice(-2).map((item) => item.id));
      return [...active.filter((item) => item.tone === "error" || recentSuccesses.has(item.id)), { ...toast, id }];
    });
    // Errors stay until dismissed or a confirmed success resolves their scope.
    if (toast.tone === "success") timers.current.set(id, setTimeout(() => removeToast(id), 6000));
  }, [removeToast]);
  useEffect(() => {
    const activeTimers = timers.current;
    return () => { activeTimers.forEach(clearTimeout); activeTimers.clear(); };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      toasts,
      addToast,
      removeToast,
    }),
    [toasts, addToast, removeToast]
  );

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<Toast>;
      if (custom.detail?.message && custom.detail?.tone) {
        if (custom.detail.tone !== "success" && custom.detail.tone !== "error") return;
        addToast({ message: custom.detail.message, tone: custom.detail.tone, scope: typeof custom.detail.scope === "string" ? custom.detail.scope : undefined });
      }
    };
    window.addEventListener("toast", handler as EventListener);
    return () => window.removeEventListener("toast", handler as EventListener);
  }, [addToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div data-toast-region className="pointer-events-none fixed inset-x-0 bottom-4 z-[110] flex justify-end px-4 sm:bottom-6 sm:px-6 print:hidden">
        <div className="pointer-events-auto flex max-h-[50dvh] w-full max-w-md flex-col gap-2 overflow-y-auto">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              role={toast.tone === "error" ? "alert" : "status"}
              aria-atomic="true"
              onMouseEnter={() => { clearTimeout(timers.current.get(toast.id)); timers.current.delete(toast.id); }}
              onMouseLeave={() => { if (toast.tone === "success") timers.current.set(toast.id, setTimeout(() => removeToast(toast.id), 6000)); }}
              onFocus={() => { clearTimeout(timers.current.get(toast.id)); timers.current.delete(toast.id); }}
              className={`pointer-events-auto flex items-start gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
                toast.tone === "success"
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border border-red-200 bg-red-50 text-red-800"
              }`}
            >
              <span className="min-w-0 flex-1 break-words">{toast.message}</span>
              <button type="button" aria-label="Dismiss notification" className="shrink-0 rounded px-1 text-lg leading-5 opacity-60 hover:opacity-100 focus-visible:outline-2" onClick={() => removeToast(toast.id)}>×</button>
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
