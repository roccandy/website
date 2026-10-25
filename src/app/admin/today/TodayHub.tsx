"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCheck,
  ChevronDown,
  ClipboardList,
  Clock3,
  CreditCard,
  PackageCheck,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { AdminLink } from "../AdminNavigationFeedback";
import { refreshAdminWorkspace } from "../refreshWorkspace";
import { useAdminViewState } from "../useAdminViewState";
import { count, dateLabel, daysBetween } from "../stats-v2/statsModel";
import type { TodayHubData, WorkCategory } from "./todayModel";

const panel =
  "min-w-0 rounded-2xl border border-zinc-200 bg-white shadow-[0_2px_6px_rgba(0,0,0,0.02)]";
const button =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 hover:border-zinc-400 hover:text-zinc-900 disabled:opacity-50";
const categoryLabels: Record<WorkCategory, string> = {
  schedule: "Scheduling",
  payments: "Payments",
  dispatch: "Fulfilment",
  review: "Review",
};
const categoryStyles: Record<WorkCategory, string> = {
  schedule: "bg-sky-50 text-sky-800",
  payments: "bg-amber-50 text-amber-800",
  dispatch: "bg-emerald-50 text-emerald-800",
  review: "bg-rose-50 text-rose-700",
};

export function TodayHub({
  data,
  name,
  canWrite,
}: {
  data: TodayHubData;
  name: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [category, setCategory] = useAdminViewState<"all" | WorkCategory>("today-category", "all", value => ["all", "schedule", "payments", "dispatch", "review"].includes(value));
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useAdminViewState<string>("today-sort", "priority", value => ["priority", "due"].includes(value));
  const [limit, setLimit] = useState(8);
  const [selectedDay, setSelectedDay] = useState(data.today);
  const day =
    data.agenda.find((day) => day.date === selectedDay) ?? data.agenda[0];
  const todayProduction = data.agenda[0];
  const weekWeight = data.agenda.reduce(
    (sum, day) =>
      sum + day.batches.reduce((total, batch) => total + batch.weight, 0),
    0,
  );
  const items = data.items
    .filter(
      (item) =>
        (!urgentOnly || item.priority >= 85) &&
        (category === "all" ||
          item.issues.some((issue) => issue.category === category)) &&
        `${item.number} ${item.title} ${item.customer} ${item.issues.map((issue) => `${issue.label} ${issue.detail}`).join(" ")}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    )
    .sort((a, b) =>
      sort === "due"
        ? (a.due || "9999").localeCompare(b.due || "9999") ||
          b.priority - a.priority
        : b.priority - a.priority ||
          (a.due || "9999").localeCompare(b.due || "9999"),
    );
  const chooseCategory = (value: "all" | WorkCategory, urgent = false) => {
    setCategory(value);
    setUrgentOnly(urgent);
    setLimit(8);
  };
  const reset = () => {
    chooseCategory("all");
    setQuery("");
  };
  const date = new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Australia/Perth",
  }).format(new Date(data.loadedAt));

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.17em] text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
            {date} · Perth
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
            Your day, in focus.
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            {name ? `${name}, here’s` : "Here’s"} what’s happening and what
            needs your attention.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => startRefresh(async () => { await refreshAdminWorkspace(); router.refresh(); })}
            disabled={refreshing}
            className={button}
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          <AdminLink
            href="/admin/orders"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-900"
          >
            <CalendarDays size={15} />
            Open production
            <ArrowUpRight size={14} />
          </AdminLink>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          {
            label: "Needs attention",
            value: data.counts.attention,
            note: data.counts.urgent
              ? `${data.counts.urgent} urgent follow-ups`
              : "No urgent flags right now",
            Icon: AlertCircle,
            style: "text-amber-800 bg-amber-50",
            onClick: () => chooseCategory("all"),
            active: category === "all" && !urgentOnly,
          },
          {
            label: "To schedule",
            value: data.counts.schedule,
            note: "Unassigned or partially allocated",
            Icon: CalendarDays,
            style: "text-sky-800 bg-sky-50",
            onClick: () => chooseCategory("schedule"),
            active: category === "schedule",
          },
          {
            label: "Payment follow-ups",
            value: data.counts.payments,
            note: "Drafts, overdue or unconfirmed",
            Icon: CreditCard,
            style: "text-violet-800 bg-violet-50",
            onClick: () => chooseCategory("payments"),
            active: category === "payments",
          },
          {
            label: "Fulfilment follow-ups",
            value: data.counts.dispatch,
            note: "Packing, dispatch or collection",
            Icon: PackageCheck,
            style: "text-emerald-800 bg-emerald-50",
            onClick: () => chooseCategory("dispatch"),
            active: category === "dispatch",
          },
        ].map(({ label, value, note, Icon, style, onClick, active }) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={`${panel} group p-4 text-left transition hover:border-emerald-400 sm:p-5 ${active ? "!border-emerald-300 ring-1 ring-emerald-100" : ""}`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium leading-5 text-zinc-500">
                {label}
              </p>
              <span className={`rounded-lg p-2 ${style}`}>
                <Icon size={17} />
              </span>
            </div>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
              {count(value)}
            </p>
            <p className="mt-2 text-[10px] leading-4 text-zinc-400">{note}</p>
          </button>
        ))}
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_25rem]">
        <section
          className={`${panel} overflow-hidden`}
          aria-label="Your work queue"
        >
          <div className="border-b border-zinc-100 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
                  Let’s work through it.
                </h2>
                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  The most pressing items come first. Open an item to take the
                  next step.
                </p>
              </div>
              {data.counts.urgent > 0 && (
                <button
                  onClick={() => chooseCategory("all", !urgentOnly)}
                  aria-pressed={urgentOnly}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium ${urgentOnly ? "border-rose-400 bg-rose-100 text-rose-900" : "border-rose-100 bg-rose-50 text-rose-700"}`}
                >
                  <Clock3 size={12} />
                  {data.counts.urgent} urgent{urgentOnly && <X size={12} />}
                </button>
              )}
            </div>
            <div
              className="mt-5 flex flex-wrap gap-1.5"
              aria-label="Filter work queue"
            >
              {(
                ["all", "schedule", "payments", "dispatch", "review"] as const
              ).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => chooseCategory(value)}
                  aria-pressed={category === value}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${category === value ? "bg-zinc-900 text-white" : "bg-zinc-50 text-zinc-500 hover:bg-zinc-100"}`}
                >
                  {value === "all" ? "All work" : categoryLabels[value]}
                  <span
                    className={`rounded px-1 text-[10px] ${category === value ? "bg-white/15" : "bg-zinc-200/60"}`}
                  >
                    {value === "all"
                      ? data.counts.attention
                      : data.counts[value]}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <label className="relative min-w-0 flex-1">
                <Search
                  size={14}
                  className="absolute left-3 top-2.5 text-zinc-400"
                />
                <span className="sr-only">Search the work queue</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setLimit(8);
                  }}
                  placeholder="Find an order or customer…"
                  className="w-full min-w-0 rounded-lg border border-zinc-200 py-2 pl-9 pr-3 text-xs outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <label>
                <span className="sr-only">Sort work queue</span>
                <select
                  value={sort}
                  onChange={(event) => {
                    setSort(event.target.value);
                    setLimit(8);
                  }}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-600"
                >
                  <option value="priority">Priority first</option>
                  <option value="due">Required date</option>
                </select>
              </label>
            </div>
          </div>
          <div aria-live="polite">
            {items.slice(0, limit).map((item) => {
              const issue =
                category === "all"
                  ? item.issues[0]
                  : item.issues.find((issue) => issue.category === category)!;
              const days = item.due ? daysBetween(data.today, item.due) : null;
              return (
                <article
                  key={item.id}
                  className="border-b border-zinc-100 px-5 py-5 last:border-0 sm:px-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-md px-2 py-1 text-[10px] font-semibold ${categoryStyles[issue.category]}`}
                        >
                          {issue.label}
                        </span>
                        <span className="text-[11px] font-medium text-zinc-400">
                          #{item.number}
                          {item.lines > 1 ? ` · ${item.lines} items` : ""}
                        </span>
                      </div>
                      <AdminLink
                        href={issue.href}
                        className="block text-sm font-semibold text-zinc-900 hover:text-emerald-800 hover:underline"
                      >
                        {item.title}
                      </AdminLink>
                      {item.customer !== item.title && (
                        <p className="mt-1 text-xs text-zinc-400">
                          {item.customer}
                        </p>
                      )}
                      <p className="mt-2 max-w-3xl text-xs leading-5 text-zinc-500">
                        {issue.detail}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-zinc-400">
                        <span
                          className={
                            days !== null && days < 0
                              ? "font-medium text-rose-600"
                              : days === 0
                                ? "font-medium text-amber-700"
                                : ""
                          }
                        >
                          {days === null
                            ? "No required date"
                            : days < 0
                              ? `Required ${Math.abs(days)}d ago`
                              : days === 0
                                ? "Required today"
                                : `Required ${dateLabel(item.due!)}`}
                        </span>
                        <span>{count(item.weight)} kg</span>
                        <span>{item.fulfillment}</span>
                      </div>
                    </div>
                    <AdminLink
                      href={issue.href}
                      className="mt-1 inline-flex shrink-0 items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-emerald-600 hover:text-emerald-800"
                    >
                      {issue.action}
                      <ArrowRight size={13} />
                    </AdminLink>
                  </div>
                  {item.issues.length > 1 && (
                    <details className="mt-3">
                      <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[10px] font-medium text-zinc-400 hover:text-zinc-700 [&::-webkit-details-marker]:hidden">
                        <ChevronDown size={12} />
                        {item.issues.length - 1} other{" "}
                        {item.issues.length === 2 ? "follow-up" : "follow-ups"}{" "}
                        on this order
                      </summary>
                      <div className="mt-2 space-y-2 rounded-lg bg-zinc-50 p-3">
                        {item.issues
                          .filter((other) => other !== issue)
                          .map((other) => (
                            <AdminLink
                              key={`${other.category}-${other.label}`}
                              href={other.href}
                              className="flex items-center justify-between gap-3 text-xs text-zinc-600 hover:text-emerald-800"
                            >
                              <span>
                                <strong className="font-medium">
                                  {other.label}
                                </strong>
                                <span className="mt-0.5 block text-[10px] font-normal text-zinc-400">
                                  {other.detail}
                                </span>
                              </span>
                              <ArrowUpRight size={13} className="shrink-0" />
                            </AdminLink>
                          ))}
                      </div>
                    </details>
                  )}
                </article>
              );
            })}
            {!items.length && (
              <div className="flex min-h-64 flex-col items-center justify-center px-6 py-10 text-center">
                <span className="mb-3 rounded-full bg-emerald-50 p-3 text-emerald-700">
                  <CheckCheck size={24} />
                </span>
                <h3 className="text-base font-semibold text-zinc-800">
                  {data.items.length
                    ? "Nothing matches this view"
                    : "No follow-ups flagged"}
                </h3>
                <p className="mt-2 max-w-sm text-xs leading-5 text-zinc-500">
                  {data.items.length
                    ? "Try another search or clear your filters."
                    : "The recorded orders have no outstanding flags. Check today’s production plan for scheduled work."}
                </p>
                {data.items.length > 0 && (
                  <button
                    onClick={reset}
                    className="mt-4 text-xs font-semibold text-emerald-800 underline underline-offset-4"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 bg-zinc-50/60 px-5 py-3 text-[10px] text-zinc-400 sm:px-6">
            <span>
              Showing {Math.min(limit, items.length)} of {items.length}{" "}
              checkouts{urgentOnly ? " · urgent only" : ""}
            </span>
            {items.length > limit && (
              <button
                onClick={() => setLimit(limit + 8)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800"
              >
                Show 8 more
                <ChevronDown size={12} />
              </button>
            )}
          </div>
        </section>

        <aside
          className="min-w-0 space-y-5"
          aria-label="Production outlook and shortcuts"
        >
          <section className={`${panel} p-5`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-700">
                  On the bench
                </p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight">
                  Production outlook
                </h2>
              </div>
              <span className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
                <CalendarDays size={18} />
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 border-b border-zinc-100 pb-4">
              <div>
                <p className="text-2xl font-semibold tracking-tight">
                  {todayProduction.batches.length}
                  <span className="ml-1.5 text-xs font-normal text-zinc-400">
                    batches today
                  </span>
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  {count(
                    todayProduction.batches.reduce(
                      (sum, batch) => sum + batch.weight,
                      0,
                    ),
                  )}{" "}
                  kg scheduled
                </p>
              </div>
              <div>
                <p className="text-2xl font-semibold tracking-tight">
                  {count(weekWeight)}
                  <span className="ml-1.5 text-xs font-normal text-zinc-400">
                    kg
                  </span>
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  over the next 7 days
                </p>
              </div>
            </div>
            <div
              className="mt-4 grid grid-cols-7 gap-1"
              aria-label="Choose an outlook day"
            >
              {data.agenda.map((day) => (
                <button
                  key={day.date}
                  onClick={() => setSelectedDay(day.date)}
                  aria-label={`${dateLabel(day.date)}, ${day.batches.length} batches`}
                  aria-pressed={selectedDay === day.date}
                  className={`min-w-0 rounded-lg px-1 py-2 text-center transition ${selectedDay === day.date ? "bg-emerald-800 text-white" : "bg-zinc-50 text-zinc-500 hover:bg-zinc-100"}`}
                >
                  <span className="block text-[9px]">
                    {new Intl.DateTimeFormat("en-AU", {
                      weekday: "short",
                      timeZone: "UTC",
                    }).format(new Date(day.date))}
                  </span>
                  <span className="mt-1 block text-sm font-semibold">
                    {Number(day.date.slice(-2))}
                  </span>
                  <span
                    className={`mx-auto mt-1.5 block h-1 w-1 rounded-full ${day.batches.length ? (selectedDay === day.date ? "bg-white" : "bg-emerald-500") : "bg-transparent"}`}
                  />
                </button>
              ))}
            </div>
            <h3 className="mt-5 text-xs font-semibold text-zinc-700">
              {day.date === data.today
                ? "Today’s scheduled batches"
                : `Scheduled for ${dateLabel(day.date)}`}
            </h3>
            <div className="mt-3 space-y-2">
              {day.batches.map((batch) => (
                <AdminLink
                  key={batch.id}
                  href={batch.href}
                  className="flex items-start justify-between gap-3 rounded-lg border border-zinc-100 px-3 py-3 hover:border-emerald-300"
                >
                  <span className="min-w-0">
                    <span className="block text-[10px] text-zinc-400">
                      Slot {batch.slotIndex} · #{batch.number}
                    </span>
                    <span className="mt-1 block text-xs font-medium text-zinc-800">
                      {batch.title}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-emerald-800">
                    {count(batch.weight)} kg
                  </span>
                </AdminLink>
              ))}
              {!day.batches.length && (
                <p className="rounded-lg border border-dashed border-zinc-200 p-4 text-xs leading-5 text-zinc-400">
                  No open batches scheduled for this day.
                </p>
              )}
            </div>
            {day.note && (
              <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide">
                  Day note
                </p>
                <p className="whitespace-pre-wrap">{day.note}</p>
              </div>
            )}
            <AdminLink
              href="/admin/orders#production-calendar"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800"
            >
              Open full schedule
              <ArrowUpRight size={13} />
            </AdminLink>
          </section>
          <section className={`${panel} p-5`}>
            <h2 className="text-sm font-semibold text-zinc-800">
              A few useful shortcuts
            </h2>
            <div className="mt-3 space-y-1">
              {[
                ...(canWrite
                  ? [
                      {
                        href: "/admin/orders/new",
                        label: "Create an order",
                        note: "Start a new customer order",
                      },
                    ]
                  : []),
                {
                  href: "/admin/orders/additional-items",
                  label: "Pre-made orders",
                  note: "Pack, dispatch and collect",
                },
                {
                  href: "/admin/customers",
                  label: "Find a customer",
                  note: "History, details and notes",
                },
                {
                  href: "/admin/stats-v2",
                  label: "See business insights",
                  note: "Trends and sales performance",
                },
              ].map((item) => (
                <AdminLink
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-3 hover:bg-zinc-50"
                >
                  <span>
                    <span className="block text-xs font-medium text-zinc-700">
                      {item.label}
                    </span>
                    <span className="mt-1 block text-[10px] text-zinc-400">
                      {item.note}
                    </span>
                  </span>
                  <ArrowUpRight size={13} className="shrink-0 text-zinc-400" />
                </AdminLink>
              ))}
            </div>
          </section>
          <div className="flex items-start gap-2 px-1 text-[10px] leading-5 text-zinc-400">
            <ClipboardList size={14} className="mt-0.5 shrink-0" />
            <p>
              {data.counts.active} active checkouts · {data.counts.dueSoon}{" "}
              required in the next 7 days. This hub reflects recorded orders and
              assignments; it doesn’t infer that production is complete.
            </p>
          </div>
        </aside>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-2 text-[10px] leading-5 text-zinc-400">
        <span>
          Grouped by checkout · a checkout can appear in more than one filter ·
          all dates use Perth time.
        </span>
        <span>
          Updated{" "}
          {new Intl.DateTimeFormat("en-AU", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: "Australia/Perth",
          }).format(new Date(data.loadedAt))}{" "}
          AWST
        </span>
      </footer>
    </section>
  );
}
