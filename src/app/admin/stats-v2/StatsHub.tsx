"use client";

import { AdminLink as Link } from "@/app/admin/AdminNavigationFeedback";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  Package,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import {
  addDays,
  buildTrend,
  comparisonRange,
  count,
  csvCell,
  dateLabel,
  defaultFilters,
  filterOrders,
  money,
  perthDate,
  rankLines,
  resolveRange,
  summarize,
  type DateRange,
  type StatsDataset,
  type StatsFilters,
  type StatsOrder,
  type TrendBucket,
} from "./statsModel";

type Tab = "overview" | "products" | "customers" | "orders";
type Metric = "net" | "orders" | "weight";
type Drill =
  | { type: "date"; range: DateRange }
  | { type: "category" | "packaging" | "flavors" | "customer"; value: string }
  | { type: "attention"; value: "unpaid" | "overdue" | "upcoming" };
const panel =
  "rounded-2xl border border-zinc-200 bg-white shadow-[0_2px_6px_rgba(0,0,0,0.02)]";
const input =
  "min-w-0 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100";
const quietButton =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-600 transition hover:border-zinc-400 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40";

function Change({
  value,
  previous,
  enabled,
  share = false,
}: {
  value: number;
  previous: number;
  enabled: boolean;
  share?: boolean;
}) {
  if (!enabled)
    return <span className="text-xs text-zinc-400">Comparison off</span>;
  if (!previous && !share)
    return (
      <span className="text-xs text-zinc-500">
        {value ? "No previous baseline" : "No change"}
      </span>
    );
  const delta = share
    ? value - previous
    : ((value - previous) / previous) * 100;
  const Icon = delta >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${delta > 0 ? "text-emerald-700" : delta < 0 ? "text-rose-600" : "text-zinc-500"}`}
    >
      <Icon size={14} />
      {Math.abs(delta).toFixed(1)}
      {share ? " pp" : "%"}{" "}
      <span className="font-normal text-zinc-500">vs comparison</span>
    </span>
  );
}

function Card({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className={`${panel} p-5 sm:p-6`}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-zinc-900">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 text-xs leading-5 text-zinc-500">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({
  title = "No orders in this view",
  text = "Try a longer date range or clear a filter.",
  action,
}: {
  title?: string;
  text?: string;
  action?: () => void;
}) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-5 py-8 text-center">
      <BarChart3 className="mb-3 text-zinc-400" size={26} />
      <p className="text-sm font-semibold text-zinc-700">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-5 text-zinc-500">{text}</p>
      {action && (
        <button
          onClick={action}
          className="mt-4 text-xs font-semibold text-emerald-700 underline underline-offset-4"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

function TrendChart({
  buckets,
  metric,
  comparison,
  onDrill,
}: {
  buckets: TrendBucket[];
  metric: Metric;
  comparison: boolean;
  onDrill: (range: DateRange) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const ceiling = Math.max(
    1,
    ...buckets.flatMap((bucket) => [
      bucket[metric],
      comparison ? bucket.previous : 0,
    ]),
  );
  const format = (value: number) =>
    metric === "net"
      ? money(value)
      : metric === "weight"
        ? `${count(value)} kg`
        : count(value);
  const point = hovered === null ? null : buckets[hovered];
  return (
    <div>
      <div className="mb-4 flex min-h-10 flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex gap-4 text-zinc-500">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-sm bg-emerald-600" />
            Selected period
          </span>
          {comparison && (
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-sm bg-zinc-300" />
              Comparison
            </span>
          )}
        </div>
        <div
          className="rounded-lg bg-zinc-50 px-3 py-2 text-zinc-600"
          aria-live="polite"
        >
          {point ? (
            <>
              {dateLabel(point.from)}
              {point.from !== point.to && ` – ${dateLabel(point.to)}`}{" "}
              <strong className="ml-2 text-zinc-900">
                {format(point[metric])}
              </strong>
              {comparison && (
                <span className="ml-2">vs {format(point.previous)}</span>
              )}
            </>
          ) : (
            "Hover to inspect · click to see orders"
          )}
        </div>
      </div>
      <div className="flex gap-3">
        <div className="flex h-56 w-14 shrink-0 flex-col justify-between pb-1 text-right text-[10px] tabular-nums text-zinc-400">
          <span>{format(ceiling)}</span>
          <span>{format(ceiling / 2)}</span>
          <span>0</span>
        </div>
        <div className="min-w-0 flex-1 overflow-x-auto pb-2">
          <div
            className="relative"
            style={{ minWidth: Math.max(240, buckets.length * 19) }}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 flex h-56 flex-col justify-between">
              <div className="border-t border-dashed border-zinc-200" />
              <div className="border-t border-dashed border-zinc-200" />
              <div className="border-t border-zinc-200" />
            </div>
            <div className="relative flex h-56 items-end gap-[3px]">
              {buckets.map((bucket, index) => (
                <button
                  key={bucket.from}
                  type="button"
                  onClick={() => onDrill(bucket)}
                  onMouseEnter={() => setHovered(index)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(index)}
                  onBlur={() => setHovered(null)}
                  aria-label={`${dateLabel(bucket.from, true)} to ${dateLabel(bucket.to, true)}: ${format(bucket[metric])}${comparison ? `, comparison ${format(bucket.previous)}` : ""}. View orders.`}
                  title={`${bucket.label}: ${format(bucket[metric])} · ${bucket.orders} orders`}
                  className="group relative flex h-full min-w-0 flex-1 items-end justify-center gap-px rounded-t focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                >
                  <span
                    className="w-full max-w-10 rounded-t bg-emerald-600 transition-colors group-hover:bg-emerald-800 group-focus:bg-emerald-800"
                    style={{
                      height: `${(bucket[metric] / ceiling) * 100}%`,
                      minHeight: bucket[metric] > 0 ? 3 : 0,
                    }}
                  />
                  {comparison && (
                    <span
                      className="w-full max-w-10 rounded-t bg-zinc-200 group-hover:bg-zinc-300"
                      style={{
                        height: `${(bucket.previous / ceiling) * 100}%`,
                        minHeight: bucket.previous > 0 ? 3 : 0,
                      }}
                    />
                  )}
                  {!bucket[metric] && !bucket.previous && (
                    <span className="absolute bottom-0 h-1 w-full bg-zinc-100" />
                  )}
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-[3px] text-center text-[10px] text-zinc-400">
              {buckets.map((bucket, index) => (
                <span
                  key={bucket.from}
                  className="min-w-0 flex-1 whitespace-nowrap"
                >
                  {index % Math.max(1, Math.ceil(buckets.length / 7)) === 0
                    ? bucket.label
                    : ""}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Rankings({
  items,
  onSelect,
  value = "net",
}: {
  items: { label: string; net: number; orders: number; weight: number }[];
  onSelect: (label: string) => void;
  value?: "net" | "orders";
}) {
  const max = Math.max(1, ...items.map((item) => item[value]));
  if (!items.length) return <Empty title="Nothing to rank yet" />;
  return (
    <div className="space-y-1">
      {items.map((item, index) => (
        <button
          type="button"
          key={item.label}
          onClick={() => onSelect(item.label)}
          className="group w-full rounded-xl px-2 py-3 text-left transition hover:bg-zinc-50 focus-visible:outline-emerald-700"
        >
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="w-4 shrink-0 text-[10px] text-zinc-400">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="truncate font-medium text-zinc-700">
                {item.label}
              </span>
            </span>
            <span className="shrink-0 text-xs font-semibold tabular-nums text-zinc-800">
              {value === "net"
                ? money(item.net)
                : `${count(item.orders)} orders`}
            </span>
          </div>
          <div className="ml-6 h-1.5 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-emerald-600/75 group-hover:bg-emerald-700"
              style={{ width: `${(item[value] / max) * 100}%` }}
            />
          </div>
          <div className="ml-6 mt-1.5 flex justify-between text-[10px] text-zinc-400">
            <span>
              {count(item.orders)} checkouts · {count(item.weight)} kg
            </span>
            <span className="opacity-0 group-hover:opacity-100">
              View orders →
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

function exportOrders(orders: StatsOrder[], range: DateRange) {
  const rows = [
    [
      "Order",
      "Created (Perth)",
      "Due",
      "Customer",
      "Type",
      "Fulfilment",
      "State",
      "Gross AUD",
      "Refund AUD",
      "Net AUD",
      "Marked paid AUD",
      "Unconfirmed payment AUD",
      "Weight kg",
    ],
    ...orders.map((order) => [
      order.number,
      order.created,
      order.due ?? "",
      order.customer,
      order.kind,
      order.fulfillment,
      order.state,
      (order.gross / 100).toFixed(2),
      (order.refund / 100).toFixed(2),
      (order.net / 100).toFixed(2),
      (order.paid / 100).toFixed(2),
      (order.unpaid / 100).toFixed(2),
      order.weight,
    ]),
  ];
  const url = URL.createObjectURL(
    new Blob(
      ["\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8;" },
    ),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `roccandy-stats-${range.from}-to-${range.to}.csv`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function StatsHub({
  dataset,
  initialFilters,
  canViewCustomers,
}: {
  dataset: StatsDataset;
  initialFilters: StatsFilters;
  canViewCustomers: boolean;
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [filters, setFilters] = useState(initialFilters);
  const [tab, setTab] = useState<Tab>("overview");
  const [metric, setMetric] = useState<Metric>("net");
  const [advanced, setAdvanced] = useState(false);
  const [drill, setDrill] = useState<Drill | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(0);
  const today = perthDate(dataset.loadedAt);
  const earliest =
    dataset.orders.find((order) => order.created)?.created ?? today;
  const range = resolveRange(filters, today, earliest);
  const priorRange = comparisonRange(
    range,
    filters.period === "all" ? "none" : filters.comparison,
  );
  const selected = useMemo(
    () => filterOrders(dataset.orders, filters, range),
    [dataset.orders, filters, range],
  );
  const prior = useMemo(
    () => (priorRange ? filterOrders(dataset.orders, filters, priorRange) : []),
    [dataset.orders, filters, priorRange],
  );
  const totals = summarize(selected);
  const priorTotals = summarize(prior);
  const buckets = buildTrend(selected, prior, range, priorRange, metric);
  const activeSegments = [
    filters.kind,
    filters.fulfillment,
    filters.payment,
    filters.state,
  ].filter((value) => value !== "all").length;
  const states = [
    ...new Set(dataset.orders.map((order) => order.state)),
  ].sort();
  const unmatched = selected.filter((order) => !order.customerKey).length;
  const knownOrders = selected.length - unmatched;
  const returningRate = knownOrders
    ? (totals.returning / knownOrders) * 100
    : 0;
  const unpaidOrders = selected.filter((order) => order.unpaid > 0);
  const isOpen = (order: StatsOrder) => !order.complete && order.net > 0;
  const overdue = selected.filter(
    (order) => isOpen(order) && order.due && order.due < today,
  );
  const upcoming = selected.filter(
    (order) =>
      isOpen(order) &&
      order.due &&
      order.due >= today &&
      order.due <= addDays(today, 14),
  );

  const changeFilters = (change: Partial<StatsFilters>) => {
    const next = { ...filters, ...change };
    setFilters(next);
    setDrill(null);
    setPage(0);
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(next))
      if (value && value !== defaultFilters[key as keyof StatsFilters])
        params.set(key, value);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${params.size ? `?${params}` : ""}`,
    );
  };
  const reset = () => {
    changeFilters(defaultFilters);
    setSearch("");
  };
  const openDrill = (next: Drill) => {
    setDrill(next);
    setSearch("");
    setPage(0);
    setTab("orders");
  };
  const filteredExplorer = selected
    .filter((order) => {
      if (
        drill?.type === "date" &&
        !(order.created >= drill.range.from && order.created <= drill.range.to)
      )
        return false;
      if (drill?.type === "customer" && order.customerKey !== drill.value)
        return false;
      if (
        drill?.type === "category" &&
        !order.lines.some((line) => line.category === drill.value)
      )
        return false;
      if (
        drill?.type === "packaging" &&
        !order.lines.some((line) => line.packaging === drill.value)
      )
        return false;
      if (
        drill?.type === "flavors" &&
        !order.lines.some((line) => line.flavors.includes(drill.value))
      )
        return false;
      if (
        drill?.type === "attention" &&
        ((drill.value === "unpaid" && order.unpaid <= 0) ||
          (drill.value === "overdue" && !overdue.includes(order)) ||
          (drill.value === "upcoming" && !upcoming.includes(order)))
      )
        return false;
      return `${order.number} ${order.customer} ${order.lines.map((line) => line.category).join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase().trim());
    })
    .sort((a, b) =>
      sort === "highest"
        ? b.net - a.net
        : sort === "due"
          ? (a.due ?? "9999").localeCompare(b.due ?? "9999")
          : b.created.localeCompare(a.created) ||
            b.number.localeCompare(a.number),
    );
  const pageSize = 15;
  const pageCount = Math.max(1, Math.ceil(filteredExplorer.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const explorerTotals = summarize(filteredExplorer);
  const customerMap = new Map<
    string,
    {
      key: string;
      name: string;
      orders: number;
      net: number;
      latest: string;
      returning: boolean;
    }
  >();
  for (const order of selected)
    if (order.customerKey) {
      const item = customerMap.get(order.customerKey) ?? {
        key: order.customerKey,
        name: order.customer,
        orders: 0,
        net: 0,
        latest: order.created,
        returning: false,
      };
      item.orders++;
      item.net += order.net;
      item.returning ||= order.returning;
      if (order.created > item.latest) item.latest = order.created;
      customerMap.set(order.customerKey, item);
    }
  const customers = [...customerMap.values()].sort((a, b) => b.net - a.net);
  const dimensionRankings = (
    dimension: "category" | "packaging" | "flavors",
    limit = 6,
  ) => (
    <Rankings
      items={rankLines(selected, dimension).slice(0, limit)}
      value={dimension === "flavors" ? "orders" : "net"}
      onSelect={(value) => openDrill({ type: dimension, value })}
    />
  );
  const drillLabel = !drill
    ? ""
    : drill.type === "date"
      ? `${dateLabel(drill.range.from)} – ${dateLabel(drill.range.to)}`
      : drill.type === "customer"
        ? (customers.find((customer) => customer.key === drill.value)?.name ??
          "Selected customer")
        : drill.type === "attention"
          ? {
              unpaid: "Payment unconfirmed",
              overdue: "Past due · still open",
              upcoming: "Due in the next 14 days",
            }[drill.value]
          : drill.value;

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
            Roc Candy · business insights
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
              A clearer view of business.
            </h1>
            <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-emerald-800">
              V2 demo
            </span>
          </div>
          <p className="mt-2 text-sm text-zinc-500">
            See what’s growing, what’s selling, and what needs a little
            attention.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/stats" className={quietButton}>
            Original stats <ArrowUpRight size={14} />
          </Link>
          <button
            onClick={() => startRefresh(() => router.refresh())}
            disabled={refreshing}
            className={quietButton}
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing…" : "Refresh data"}
          </button>
        </div>
      </header>

      <section aria-label="Reporting filters" className={`${panel} p-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1 rounded-xl bg-zinc-100 p-1">
            {(
              [
                ["month", "This month"],
                ["30d", "30 days"],
                ["90d", "90 days"],
                ["fy", "Financial year"],
                ["all", "All time"],
                ["custom", "Custom"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() =>
                  changeFilters({
                    period: value,
                    ...(value === "custom"
                      ? { from: range.from, to: range.to }
                      : {}),
                  })
                }
                aria-pressed={filters.period === value}
                className={`rounded-lg px-3 py-2 text-xs font-medium transition ${filters.period === value ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-900"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="stats-comparison">
              Compare against
            </label>
            <select
              id="stats-comparison"
              value={filters.period === "all" ? "none" : filters.comparison}
              disabled={filters.period === "all"}
              onChange={(event) =>
                changeFilters({
                  comparison: event.target.value as StatsFilters["comparison"],
                })
              }
              className={`${input} !text-xs`}
            >
              <option value="previous">vs previous period</option>
              <option value="year">vs last year</option>
              <option value="none">No comparison</option>
            </select>
            <button
              onClick={() => setAdvanced(!advanced)}
              aria-expanded={advanced}
              aria-controls="stats-segment-filters"
              className={quietButton}
            >
              <SlidersHorizontal size={14} />
              Filters
              {activeSegments > 0 && (
                <span className="rounded bg-emerald-100 px-1.5 text-emerald-800">
                  {activeSegments}
                </span>
              )}
              <ChevronDown size={12} />
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
          <div className="flex flex-wrap items-center gap-2">
            <CalendarDays size={14} />
            {filters.period === "custom" ? (
              <>
                <label className="sr-only" htmlFor="stats-from">
                  Start date
                </label>
                <input
                  id="stats-from"
                  type="date"
                  value={filters.from}
                  max={filters.to || today}
                  onChange={(event) =>
                    changeFilters({ from: event.target.value })
                  }
                  className={`${input} !py-1 !text-xs`}
                />
                <span>to</span>
                <label className="sr-only" htmlFor="stats-to">
                  End date
                </label>
                <input
                  id="stats-to"
                  type="date"
                  value={filters.to}
                  min={filters.from}
                  max={today}
                  onChange={(event) =>
                    changeFilters({ to: event.target.value })
                  }
                  className={`${input} !py-1 !text-xs`}
                />
              </>
            ) : (
              <strong className="font-medium text-zinc-700">
                {dateLabel(range.from, true)} – {dateLabel(range.to, true)}
              </strong>
            )}
            {priorRange && (
              <span className="text-zinc-400">
                compared with {dateLabel(priorRange.from, true)} –{" "}
                {dateLabel(priorRange.to, true)}
              </span>
            )}
          </div>
          <span>{count(selected.length)} checkouts · AUD · Perth time</span>
        </div>
        {advanced && (
          <div
            id="stats-segment-filters"
            className="mt-4 grid gap-3 border-t border-zinc-100 pt-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            {(
              [
                {
                  key: "kind",
                  label: "Order type",
                  options: [
                    ["all", "All order types"],
                    ["Custom", "Custom only"],
                    ["Pre-made", "Pre-made only"],
                    ["Mixed", "Mixed checkout"],
                  ],
                },
                {
                  key: "fulfillment",
                  label: "Fulfilment",
                  options: [
                    ["all", "All fulfilment"],
                    ["Delivery", "Delivery"],
                    ["Pickup", "Pickup"],
                    ["Mixed", "Mixed"],
                  ],
                },
                {
                  key: "payment",
                  label: "Payment record",
                  options: [
                    ["all", "All payment records"],
                    ["paid", "Has marked-paid value"],
                    ["unpaid", "Has unconfirmed payment"],
                    ["refunded", "Has a refund"],
                  ],
                },
                {
                  key: "state",
                  label: "Destination",
                  options: [
                    ["all", "All destinations"],
                    ...states.map((state) => [state, state]),
                  ],
                },
              ] as const
            ).map(({ key, label, options }) => (
              <label
                key={key}
                className="space-y-1.5 text-[11px] font-medium text-zinc-500"
              >
                {label}
                <select
                  aria-label={label}
                  value={filters[key]}
                  onChange={(event) =>
                    changeFilters({ [key]: event.target.value })
                  }
                  className={`${input} block w-full`}
                >
                  {options.map(([value, text]) => (
                    <option key={value} value={value}>
                      {text}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        )}
        {activeSegments > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {(["kind", "fulfillment", "payment", "state"] as const)
              .filter((key) => filters[key] !== "all")
              .map((key) => (
                <button
                  key={key}
                  onClick={() => changeFilters({ [key]: "all" })}
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] text-emerald-800"
                >
                  {key === "payment"
                    ? {
                        paid: "Marked paid",
                        unpaid: "Payment unconfirmed",
                        refunded: "Refunded",
                      }[filters[key]]
                    : filters[key]}
                  <X size={12} aria-label={`Remove ${key} filter`} />
                </button>
              ))}
            <button
              onClick={reset}
              className="text-xs text-zinc-500 underline underline-offset-2"
            >
              Reset all
            </button>
          </div>
        )}
        {range.from > range.to && (
          <p role="alert" className="mt-3 text-sm text-rose-600">
            Choose an end date on or after the start date.
          </p>
        )}
      </section>

      <div
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-live="polite"
      >
        {[
          {
            label: "Net order value",
            value: money(totals.net),
            previous: priorTotals.net,
            raw: totals.net,
            note: "Booked value, less recorded refunds",
            accent: true,
          },
          {
            label: "Checkouts",
            value: count(totals.orders),
            previous: priorTotals.orders,
            raw: totals.orders,
            note: "Split order lines counted once",
          },
          {
            label: "Average order",
            value: money(totals.average),
            previous: priorTotals.average,
            raw: totals.average,
            note: "Net value ÷ checkouts",
          },
          {
            label: "Returning order share",
            value: `${returningRate.toFixed(0)}%`,
            previous:
              priorTotals.orders -
              prior.filter((order) => !order.customerKey).length
                ? (priorTotals.returning /
                    (priorTotals.orders -
                      prior.filter((order) => !order.customerKey).length)) *
                  100
                : 0,
            raw: returningRate,
            note: `${totals.returning} of ${knownOrders} identified checkouts`,
          },
        ].map((item) => (
          <div
            key={item.label}
            className={`${panel} relative overflow-hidden p-5 ${item.accent ? "!border-emerald-200 !bg-emerald-50/40" : ""}`}
          >
            <p className="text-xs font-medium text-zinc-500">{item.label}</p>
            <p
              className={`mt-3 text-3xl font-semibold tracking-tight tabular-nums ${item.accent ? "text-emerald-900" : "text-zinc-900"}`}
            >
              {item.value}
            </p>
            <div className="mt-3">
              <Change
                value={item.raw}
                previous={item.previous}
                enabled={Boolean(priorRange)}
                share={item.label === "Returning order share" && prior.length > 0}
              />
            </div>
            <p className="mt-2 text-[10px] leading-4 text-zinc-400">
              {item.note}
            </p>
          </div>
        ))}
      </div>

      <nav
        aria-label="Stats views"
        className="flex gap-1 overflow-x-auto border-b border-zinc-200"
      >
        {(
          [
            ["overview", "Overview", BarChart3],
            ["products", "Products", Package],
            ["customers", "Customers", Users],
            ["orders", "Order explorer", Search],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            type="button"
            key={value}
            onClick={() => {
              setTab(value);
              if (value !== "orders") setDrill(null);
            }}
            aria-current={tab === value ? "page" : undefined}
            className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 pb-3 pt-1 text-sm font-medium transition ${tab === value ? "border-emerald-700 text-emerald-800" : "border-transparent text-zinc-500 hover:text-zinc-900"}`}
          >
            <Icon size={16} />
            {label}
            {value === "orders" && (
              <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px]">
                {selected.length}
              </span>
            )}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
            <Card
              title="How are we tracking?"
              subtitle={
                filters.period === "all"
                  ? "Monthly net order value across the available order history."
                  : "Compare the same measure across both periods. Click a bar to explore its orders."
              }
              action={
                <div className="flex gap-1 rounded-lg bg-zinc-100 p-1">
                  {(
                    [
                      ["net", "Value"],
                      ["orders", "Orders"],
                      ["weight", "Weight"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => setMetric(value)}
                      aria-pressed={metric === value}
                      className={`rounded-md px-2.5 py-1.5 text-[11px] font-medium ${metric === value ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              }
            >
              {selected.length ? (
                <TrendChart
                  buckets={buckets}
                  metric={metric}
                  comparison={Boolean(priorRange)}
                  onDrill={(selectedRange) =>
                    openDrill({ type: "date", range: selectedRange })
                  }
                />
              ) : (
                <Empty action={reset} />
              )}
            </Card>
            <Card
              title="The money picture"
              subtitle="For orders created in this period."
            >
              <div className="space-y-4">
                {[
                  {
                    label: "Gross booked value",
                    value: totals.gross,
                    tone: "text-zinc-800",
                  },
                  {
                    label: "Recorded refunds",
                    value: totals.refund ? -totals.refund : 0,
                    tone: "text-rose-600",
                  },
                  {
                    label: "Net order value",
                    value: totals.net,
                    tone: "text-emerald-800",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="text-zinc-500">{item.label}</span>
                    <strong className={`tabular-nums ${item.tone}`}>
                      {money(item.value)}
                    </strong>
                  </div>
                ))}
                <div className="border-t border-zinc-100 pt-4">
                  <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400">
                    Payment records
                  </p>
                  <p className="mt-2 text-xl font-semibold text-zinc-900">
                    {money(totals.paid)}{" "}
                    <span className="text-xs font-normal text-zinc-500">
                      marked paid
                    </span>
                  </p>
                  <button
                    onClick={() =>
                      openDrill({ type: "attention", value: "unpaid" })
                    }
                    className="mt-3 flex w-full items-center justify-between rounded-lg bg-amber-50 px-3 py-2.5 text-left text-xs text-amber-900"
                  >
                    <span>{money(totals.unpaid)} unconfirmed</span>
                    <ArrowRight size={14} />
                  </button>
                  <p className="mt-2 text-[10px] leading-4 text-zinc-400">
                    Booked value includes unpaid orders. This is an order
                    report, not a bank reconciliation or profit report.
                  </p>
                </div>
              </div>
            </Card>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <Card
              title="What’s selling"
              subtitle="Categories ranked by net line value."
              action={
                <button
                  className="text-xs font-medium text-emerald-700"
                  onClick={() => setTab("products")}
                >
                  See products →
                </button>
              }
            >
              {dimensionRankings("category", 5)}
            </Card>
            <Card
              title="A little attention"
              subtitle="Follow-ups within your selected orders."
            >
              <div className="space-y-3">
                {[
                  {
                    value: "unpaid" as const,
                    number: unpaidOrders.length,
                    label: "Payment unconfirmed",
                    note: `${money(totals.unpaid)} in booked value`,
                    color: "bg-amber-50 text-amber-800",
                  },
                  {
                    value: "overdue" as const,
                    number: overdue.length,
                    label: "Past due, still open",
                    note: "Check fulfilment or update the order",
                    color: "bg-rose-50 text-rose-700",
                  },
                  {
                    value: "upcoming" as const,
                    number: upcoming.length,
                    label: "Due in the next 14 days",
                    note: `${count(upcoming.reduce((sum, order) => sum + order.weight, 0))} kg of ordered weight`,
                    color: "bg-sky-50 text-sky-800",
                  },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() =>
                      openDrill({ type: "attention", value: item.value })
                    }
                    className="flex w-full items-center gap-3 rounded-xl border border-zinc-100 p-3 text-left transition hover:border-zinc-300"
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base font-semibold ${item.color}`}
                    >
                      {item.number}
                    </span>
                    <span className="flex-1">
                      <span className="block text-xs font-medium text-zinc-800">
                        {item.label}
                      </span>
                      <span className="mt-1 block text-[10px] text-zinc-400">
                        {item.note}
                      </span>
                    </span>
                    <ArrowRight size={14} className="text-zinc-400" />
                  </button>
                ))}
              </div>
              <Link
                href="/admin/orders"
                className="mt-5 inline-flex items-center gap-2 text-xs font-medium text-emerald-700"
              >
                Open production schedule <ArrowUpRight size={14} />
              </Link>
            </Card>
            <Card
              title="Behind the orders"
              subtitle="Helpful context for production and planning."
            >
              <div className="grid grid-cols-2 gap-x-5 gap-y-6">
                {[
                  {
                    value: `${count(totals.weight)} kg`,
                    label: "Ordered weight",
                  },
                  {
                    value:
                      totals.medianLead === null
                        ? "—"
                        : `${count(totals.medianLead)} days`,
                    label: "Median order-to-due time",
                  },
                  {
                    value: count(
                      selected.filter((order) => order.fulfillment === "Pickup")
                        .length,
                    ),
                    label: "Pickup checkouts",
                  },
                  {
                    value: count(
                      selected.filter((order) => order.business).length,
                    ),
                    label: "Business checkouts",
                  },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="text-xl font-semibold tracking-tight text-zinc-800">
                      {item.value}
                    </p>
                    <p className="mt-1 text-[10px] leading-4 text-zinc-400">
                      {item.label}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-5 border-t border-zinc-100 pt-4 text-[10px] leading-4 text-zinc-400">
                Weight is ordered weight, including refunded lines; it is not a
                measure of actual production capacity.
              </p>
            </Card>
          </div>
        </div>
      )}

      {tab === "products" && (
        <div className="space-y-5">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 text-xs leading-5 text-emerald-900">
            Use these rankings to see where order value and demand come from.
            Click any item to inspect the checkouts behind it.
          </div>
          <div className="grid gap-5 xl:grid-cols-3">
            <Card
              title="Candy categories"
              subtitle="Net line value after recorded refunds."
            >
              {dimensionRankings("category", 12)}
            </Card>
            <Card
              title="Packaging favourites"
              subtitle="Net value of order lines using each packaging option."
            >
              {dimensionRankings("packaging", 12)}
            </Card>
            <Card
              title="Flavours customers choose"
              subtitle="Checkouts containing each flavour. Multi-flavour orders appear in more than one row."
            >
              {dimensionRankings("flavors", 12)}
            </Card>
          </div>
          <Card
            title="Where orders are going"
            subtitle="Delivery destination by checkout. Pickup and multi-destination orders appear separately."
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[...new Set(selected.map((order) => order.state))].map(
                (state) => {
                  const orders = selected.filter(
                    (order) => order.state === state,
                  );
                  return (
                    <button
                      key={state}
                      onClick={() => {
                        changeFilters({ state });
                        setTab("orders");
                      }}
                      className="rounded-xl border border-zinc-200 p-4 text-left transition hover:border-emerald-500"
                    >
                      <p className="text-xs font-semibold text-zinc-700">
                        {state}
                      </p>
                      <p className="mt-2 text-xl font-semibold">
                        {money(summarize(orders).net)}
                      </p>
                      <p className="mt-1 text-xs text-zinc-400">
                        {orders.length} checkouts ·{" "}
                        {Math.round((orders.length / selected.length) * 100)}%
                      </p>
                    </button>
                  );
                },
              )}
              {!selected.length && (
                <p className="text-sm text-zinc-500">
                  No destination data for this selection.
                </p>
              )}
            </div>
          </Card>
        </div>
      )}

      {tab === "customers" && (
        <div className="grid gap-5 xl:grid-cols-[18rem_minmax(0,1fr)]">
          <Card
            title="Who’s coming back?"
            subtitle="Based on the available current-site order history."
          >
            <p className="text-5xl font-semibold tracking-tight text-emerald-900">
              {returningRate.toFixed(0)}
              <span className="text-2xl">%</span>
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              of identified checkouts are returning orders
            </p>
            <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-zinc-100">
              <span
                className="bg-emerald-600"
                style={{ width: `${returningRate}%` }}
              />
            </div>
            <div className="mt-4 space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Returning checkouts</span>
                <strong>{totals.returning}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">First known checkouts</span>
                <strong>{knownOrders - totals.returning}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Distinct customers</span>
                <strong>{totals.customers}</strong>
              </div>
            </div>
            <p className="mt-5 border-t border-zinc-100 pt-4 text-[11px] leading-5 text-zinc-400">
              Returning means a customer had an earlier non-zero order in the
              available history, matched by email or phone. {unmatched}{" "}
              unmatched checkouts excluded from this percentage. Imported legacy
              CRM history is not included.
            </p>
            {canViewCustomers && (
              <Link
                href="/admin/customers"
                className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-emerald-700"
              >
                Open customer history <ArrowUpRight size={14} />
              </Link>
            )}
          </Card>
          <Card
            title="Your most valuable customers"
            subtitle="Ranked by net order value in this selection. Click to see their orders."
          >
            {customers.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 text-[10px] uppercase tracking-wider text-zinc-400">
                      <th className="pb-3 font-medium">Customer</th>
                      <th className="pb-3 text-right font-medium">Checkouts</th>
                      <th className="pb-3 text-right font-medium">Net value</th>
                      <th className="pb-3 text-right font-medium">
                        Latest order
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.slice(0, 20).map((customer) => (
                      <tr
                        key={customer.key}
                        className="border-b border-zinc-100 last:border-0"
                      >
                        <td className="py-4 pr-3">
                          <button
                            onClick={() =>
                              openDrill({
                                type: "customer",
                                value: customer.key,
                              })
                            }
                            className="text-left font-medium text-zinc-800 hover:text-emerald-700 hover:underline"
                          >
                            {customer.name}
                          </button>
                          <span
                            className={`mt-1 block text-[10px] ${customer.returning ? "text-emerald-600" : "text-zinc-400"}`}
                          >
                            {customer.returning
                              ? "Returning customer"
                              : "First known order"}
                          </span>
                        </td>
                        <td className="py-4 text-right tabular-nums">
                          {customer.orders}
                        </td>
                        <td className="py-4 text-right font-semibold tabular-nums">
                          {money(customer.net)}
                        </td>
                        <td className="whitespace-nowrap py-4 text-right text-zinc-400">
                          {dateLabel(customer.latest)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-4 text-[10px] text-zinc-400">
                  Showing {Math.min(customers.length, 20)} of {customers.length}{" "}
                  identified customers.
                </p>
              </div>
            ) : (
              <Empty title="No identified customers in this view" />
            )}
          </Card>
        </div>
      )}

      {tab === "orders" && (
        <Card
          title="The orders behind the numbers"
          subtitle="One row per checkout. Product drill-downs show the full checkout value, including other items."
          action={
            <button
              onClick={() => exportOrders(filteredExplorer, range)}
              disabled={!filteredExplorer.length}
              className={quietButton}
            >
              <Download size={14} />
              Export {count(filteredExplorer.length)} orders
            </button>
          }
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <label className="relative min-w-0 flex-1 sm:max-w-sm">
              <Search
                size={15}
                className="absolute left-3 top-2.5 text-zinc-400"
              />
              <span className="sr-only">Search orders or customers</span>
              <input
                type="search"
                placeholder="Search order, customer, or category…"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(0);
                }}
                className={`${input} w-full pl-9`}
              />
            </label>
            <label>
              <span className="sr-only">Sort orders</span>
              <select
                className={`${input} !text-xs`}
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value);
                  setPage(0);
                }}
              >
                <option value="newest">Newest first</option>
                <option value="highest">Highest value</option>
                <option value="due">Due date</option>
              </select>
            </label>
          </div>
          {drill && (
            <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-zinc-400">Showing</span>
              <button
                onClick={() => {
                  setDrill(null);
                  setPage(0);
                }}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-800"
              >
                {drillLabel}
                <X size={12} aria-label="Clear drill-down" />
              </button>
            </div>
          )}
          <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 rounded-lg bg-zinc-50 px-4 py-3 text-xs text-zinc-500">
            <span>
              <strong className="text-zinc-800">
                {count(filteredExplorer.length)}
              </strong>{" "}
              checkouts
            </span>
            <span>
              <strong className="text-zinc-800">
                {money(explorerTotals.net)}
              </strong>{" "}
              net value
            </span>
            <span>
              <strong className="text-zinc-800">
                {count(explorerTotals.weight)} kg
              </strong>{" "}
              ordered weight
            </span>
          </div>
          {filteredExplorer.length ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 text-[10px] uppercase tracking-wider text-zinc-400">
                      {[
                        "Order / customer",
                        "Created",
                        "Due",
                        "Type",
                        "Net value",
                        "Payment record",
                      ].map((label) => (
                        <th
                          key={label}
                          className={`pb-3 pr-3 font-medium ${label === "Net value" ? "text-right" : ""}`}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExplorer
                      .slice(safePage * pageSize, (safePage + 1) * pageSize)
                      .map((order) => (
                        <tr
                          key={order.id}
                          className="border-b border-zinc-100 last:border-0"
                        >
                          <td className="py-3.5 pr-4">
                            <Link
                              href={`/admin/orders/${encodeURIComponent(order.id)}`}
                              className="inline-flex items-center gap-1.5 font-semibold text-emerald-800 hover:underline"
                            >
                              #{order.number}
                              <ArrowUpRight size={12} />
                            </Link>
                            <p
                              className="mt-1 max-w-48 truncate text-[11px] text-zinc-500"
                              title={order.customer}
                            >
                              {order.customer}
                            </p>
                          </td>
                          <td className="whitespace-nowrap py-3.5 pr-3 text-zinc-500">
                            {dateLabel(order.created)}
                          </td>
                          <td className="whitespace-nowrap py-3.5 pr-3 text-zinc-500">
                            {order.due ? dateLabel(order.due) : "—"}
                          </td>
                          <td className="py-3.5 pr-3">
                            <span className="font-medium text-zinc-700">
                              {order.kind}
                            </span>
                            <span className="mt-1 block text-[10px] text-zinc-400">
                              {order.fulfillment}
                            </span>
                          </td>
                          <td className="py-3.5 pr-4 text-right">
                            <strong className="tabular-nums text-zinc-800">
                              {money(order.net, true)}
                            </strong>
                            {order.refund > 0 && (
                              <span className="mt-1 block text-[10px] text-rose-500">
                                {money(order.refund)} refunded
                              </span>
                            )}
                          </td>
                          <td className="py-3.5">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium ${order.net === 0 ? "bg-zinc-100 text-zinc-500" : order.unpaid > 0 ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}
                            >
                              {order.net === 0 ? (
                                "No net value"
                              ) : order.unpaid > 0 ? (
                                order.paid > 0 ? (
                                  "Partly marked paid"
                                ) : (
                                  "Unconfirmed"
                                )
                              ) : (
                                <>
                                  <Check size={11} />
                                  Marked paid
                                </>
                              )}
                            </span>
                            <p className="mt-1 text-[10px] text-zinc-400">
                              {order.payment}
                            </p>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4 text-xs text-zinc-400">
                <span>
                  {safePage * pageSize + 1}–
                  {Math.min((safePage + 1) * pageSize, filteredExplorer.length)}{" "}
                  of {count(filteredExplorer.length)} checkouts
                </span>
                <div className="flex items-center gap-3">
                  <button
                    disabled={!safePage}
                    onClick={() => setPage(safePage - 1)}
                    aria-label="Previous page"
                    className={quietButton}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span>
                    Page {safePage + 1} of {pageCount}
                  </span>
                  <button
                    disabled={safePage >= pageCount - 1}
                    onClick={() => setPage(safePage + 1)}
                    aria-label="Next page"
                    className={quietButton}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <Empty
              title="No matching checkouts"
              text="Try another search, clear the drill-down, or broaden your reporting filters."
              action={() => {
                setSearch("");
                setDrill(null);
                reset();
              }}
            />
          )}
        </Card>
      )}

      <footer className="space-y-3 text-[10px] leading-5 text-zinc-400">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Live order data · read-only demo
          </span>
          <span>
            Loaded{" "}
            {new Intl.DateTimeFormat("en-AU", {
              day: "numeric",
              month: "short",
              hour: "numeric",
              minute: "2-digit",
              timeZone: "Australia/Perth",
            }).format(new Date(dataset.loadedAt))}{" "}
            AWST
          </span>
        </div>
        <details className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <summary className="cursor-pointer font-medium text-zinc-600">
            <Info size={12} className="mr-1.5 inline" />
            How these numbers are calculated
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <p>
              <strong className="text-zinc-600">Date scope.</strong> Filters use
              checkout creation dates in Perth time. Refunds are deducted from
              their original order’s period, not the date the refund was issued.
              Comparisons use the same segment filters; all-time comparison is
              disabled.
            </p>
            <p>
              <strong className="text-zinc-600">Financial scope.</strong> Value
              comes from stored order-line totals. It is not profit, tax
              reporting, shipping analysis, or cash received. Marked paid
              requires a recorded paid date or a paid Square invoice.
              Payment-unconfirmed value can include draft invoices or incomplete
              checkouts.
            </p>
            <p>
              <strong className="text-zinc-600">Order scope.</strong> Numeric
              order-number suffixes are combined into one checkout.{" "}
              {count(dataset.excludedLines)} cancelled, failed, or draft-status
              lines are excluded. {count(dataset.undatedOrders)} checkouts with
              invalid creation dates cannot be placed into a reporting period.
              Archived orders remain in historical totals.
            </p>
            <p>
              <strong className="text-zinc-600">Customers & products.</strong>{" "}
              Customer matching uses email, falling back to phone; unnamed or
              unmatched buyers are not merged by name. Legacy CRM imports are
              separate. Flavours count checkouts, so multi-flavour totals
              overlap. Product values use their own lines; clicking shows the
              full containing checkout.
            </p>
          </div>
        </details>
      </footer>
    </div>
  );
}
