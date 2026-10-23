"use client";

import { usePathname } from "next/navigation";
import { getAdminLoadingView } from "./adminLoadingViews";

function Block({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-md bg-zinc-200/80 motion-safe:animate-pulse ${className}`}
    />
  );
}

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      <div className="flex gap-5 border-b border-zinc-200 bg-zinc-50 px-4 py-4">
        {["w-14", "flex-1", "w-20", "hidden w-16 sm:block"].map((width, i) => (
          <Block key={i} className={`h-3 ${width}`} />
        ))}
      </div>
      {Array.from({ length: 7 }, (_, index) => (
        <div
          key={index}
          className="flex items-center gap-5 border-b border-zinc-100 px-4 py-5 last:border-0"
        >
          <Block className="h-3 w-14" />
          <div className="flex-1 space-y-2">
            <Block className={`h-3 ${index % 2 ? "w-2/3" : "w-4/5"}`} />
            <Block className="h-2 w-1/3" />
          </div>
          <Block className="h-5 w-20 rounded-full" />
          <Block className="hidden h-3 w-16 sm:block" />
        </div>
      ))}
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {[0, 1].map((panel) => (
        <div
          key={panel}
          className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6"
        >
          <Block className="h-5 w-36" />
          {[0, 1, 2, 3].map((field) => (
            <div key={field} className="space-y-2">
              <Block className="h-3 w-24" />
              <Block className={`w-full ${field === 3 ? "h-24" : "h-10"}`} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function ScheduleSkeleton() {
  return (
    <div className="admin-production-schedule grid gap-6 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.2fr)]">
      <TableSkeleton />
      <div className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <Block className="h-6 w-40" />
          <Block className="h-8 w-24" />
        </div>
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: 5 }, (_, day) => (
            <div
              key={day}
              className="space-y-3 rounded-lg border border-zinc-200 p-2"
            >
              <Block className="h-3 w-3/4" />
              {[0, 1, 2].map((slot) => (
                <Block key={slot} className="h-20 w-full" />
              ))}
            </div>
          ))}
        </div>
        <Block className="h-24 w-full" />
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[0, 1, 2, 3].map((card) => (
          <div
            key={card}
            className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5"
          >
            <Block className="h-3 w-3/4" />
            <Block className="h-8 w-2/3" />
            <Block className="h-3 w-1/2" />
          </div>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-6">
          <Block className="h-5 w-40" />
          <Block className="h-64 w-full" />
        </div>
        <div className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-6">
          <Block className="h-5 w-32" />
          {[0, 1, 2, 3].map((row) => (
            <Block key={row} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function AdminPageSkeleton({ pathname }: { pathname?: string }) {
  const currentPathname = usePathname();
  const view = getAdminLoadingView(pathname ?? currentPathname);
  return (
    <section
      role="status"
      aria-live="polite"
      aria-label={`Loading ${view.title}`}
      className="space-y-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Admin
          </p>
          <h1 className="admin-page-title text-zinc-900">{view.title}</h1>
          <p className="flex items-center gap-2 text-sm text-zinc-500">
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full bg-emerald-500 motion-safe:animate-pulse"
            />
            {view.description}
          </p>
        </div>
        <div aria-hidden="true">
          <Block className="h-9 w-28" />
        </div>
      </div>
      <div aria-hidden="true">
        {view.layout === "schedule" ? (
          <ScheduleSkeleton />
        ) : view.layout === "form" ? (
          <FormSkeleton />
        ) : view.layout === "dashboard" ? (
          <DashboardSkeleton />
        ) : (
          <div className="space-y-4">
            <div className="flex gap-3">
              <Block className="h-10 w-64 max-w-full" />
              <Block className="h-10 w-24" />
            </div>
            <TableSkeleton />
          </div>
        )}
      </div>
    </section>
  );
}
