import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Search, Users, Repeat2, MessageSquareText, CircleDollarSign, AlertTriangle } from "lucide-react";
import { assertCustomerCrmAccess } from "./actions";
import {
  customerSourceLabel,
  getCustomerHistoryStats,
  isCustomerFilter,
  isCustomerSourceSystem,
  listCustomerSummaries,
  type CustomerFilter,
  type CustomerSourceSystem,
  type CustomerSummary,
} from "@/lib/customerHistory";

export const metadata: Metadata = {
  title: "Customers | Roc Candy Admin",
};

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type SearchParams = {
  q?: string | string[];
  filter?: string | string[];
  source?: string | string[];
};

const money = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});

const numberFormat = new Intl.NumberFormat("en-AU");

const FILTERS: { value: CustomerFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "repeat", label: "Repeat" },
  { value: "company", label: "Company" },
  { value: "orders", label: "Has orders" },
  { value: "enquiries", label: "Has enquiries" },
  { value: "low-confidence", label: "Check matches" },
];

const SOURCES: Array<{ value: "all" | CustomerSourceSystem; label: string }> = [
  { value: "all", label: "All sources" },
  { value: "legacy_old", label: "Old site" },
  { value: "legacy_new", label: "New legacy site" },
  { value: "current_next", label: "Current site" },
];

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

function locationLabel(customer: CustomerSummary) {
  return [customer.suburb, customer.state, customer.postcode].filter(Boolean).join(", ") || "-";
}

function sourceBadges(sources: CustomerSourceSystem[]) {
  return sources.length > 0 ? sources.map(customerSourceLabel).join(", ") : "-";
}

function StatCard({
  icon,
  label,
  value,
  secondary,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  secondary: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">{label}</p>
          <p className="text-2xl font-semibold text-zinc-900">{value}</p>
          <p className="text-xs text-zinc-500">{secondary}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-2 text-zinc-700">{icon}</div>
      </div>
    </div>
  );
}

export default async function CustomersPage({ searchParams }: { searchParams?: SearchParams | Promise<SearchParams> }) {
  await assertCustomerCrmAccess();
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const query = firstParam(resolvedSearchParams?.q)?.trim() ?? "";
  const filterParam = firstParam(resolvedSearchParams?.filter);
  const sourceParam = firstParam(resolvedSearchParams?.source);
  const filter = isCustomerFilter(filterParam) ? filterParam : "all";
  const source = isCustomerSourceSystem(sourceParam) ? sourceParam : "all";

  const [listResult, statsResult] = await Promise.all([
    listCustomerSummaries({ query, filter, source }),
    getCustomerHistoryStats(),
  ]);
  const customers = listResult.data;
  const stats = statsResult.data;
  const schemaMissing = !listResult.ok || !statsResult.ok;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Admin / Insight</p>
          <h1 className="admin-page-title text-zinc-900">Customers</h1>
          <p className="max-w-3xl text-sm leading-6 text-zinc-600">
            Search customer profiles across historic orders, current orders, and enquiry history.
          </p>
        </div>
        <Link
          href="/admin/stats"
          className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
        >
          View stats
        </Link>
      </div>

      {schemaMissing ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-none" />
            <div className="space-y-2">
              <p className="font-semibold">Customer history tables are not installed yet.</p>
              <p>Apply `docs/sql/2026-04-29-customer-history-crm.sql`, then run `npm run import-customer-history -- --dry-run` and `npm run import-customer-history -- --apply`.</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Customers"
          value={numberFormat.format(stats.totalCustomers)}
          secondary="matched profiles"
        />
        <StatCard
          icon={<Repeat2 className="h-5 w-5" />}
          label="Repeat"
          value={numberFormat.format(stats.repeatCustomers)}
          secondary="more than one order"
        />
        <StatCard
          icon={<CircleDollarSign className="h-5 w-5" />}
          label="Lifetime value"
          value={money.format(stats.lifetimeValue)}
          secondary={`${numberFormat.format(stats.totalOrders)} orders`}
        />
        <StatCard
          icon={<MessageSquareText className="h-5 w-5" />}
          label="Enquiries"
          value={numberFormat.format(stats.totalEnquiries)}
          secondary="historic messages"
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Review"
          value={numberFormat.format(stats.lowConfidenceCustomers)}
          secondary="low-confidence matches"
        />
      </div>

      <form className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm" action="/admin/customers">
        <div className="grid gap-3 lg:grid-cols-[1fr_12rem_12rem_auto]">
          <label className="relative block">
            <span className="sr-only">Search customers</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              name="q"
              defaultValue={query}
              placeholder="Search name, email, phone, company, suburb, postcode, or order number"
              className="w-full rounded-lg border border-zinc-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-zinc-400"
            />
          </label>
          <label className="block">
            <span className="sr-only">Filter customers</span>
            <select
              name="filter"
              defaultValue={filter}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
            >
              {FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="sr-only">Filter by source</span>
            <select
              name="source"
              defaultValue={source}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
            >
              {SOURCES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button className="rounded-lg border border-zinc-900 bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800">
            Search
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 text-[11px] uppercase tracking-[0.2em] text-zinc-500">
            <tr>
              <th className="px-3 py-3 text-left">Customer</th>
              <th className="px-3 py-3 text-left">Contact</th>
              <th className="px-3 py-3 text-left">Company</th>
              <th className="px-3 py-3 text-left">Location</th>
              <th className="px-3 py-3 text-left">Orders</th>
              <th className="px-3 py-3 text-left">Spend</th>
              <th className="px-3 py-3 text-left">Last activity</th>
              <th className="px-3 py-3 text-left">Sources</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id} className="border-t border-zinc-100">
                <td className="px-3 py-3">
                  <Link href={`/admin/customers/${customer.id}`} className="font-semibold text-zinc-900 hover:underline">
                    {customer.display_name || customer.primary_email || customer.primary_phone || "Unknown customer"}
                  </Link>
                  <div className="mt-1 flex gap-2">
                    {customer.order_count > 1 ? (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        Repeat
                      </span>
                    ) : null}
                    {customer.match_confidence === "low" ? (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        Check match
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-3 text-zinc-700">
                  <div>{customer.primary_email || "-"}</div>
                  <div className="text-xs text-zinc-500">{customer.primary_phone || ""}</div>
                </td>
                <td className="px-3 py-3 text-zinc-700">{customer.company || "-"}</td>
                <td className="px-3 py-3 text-zinc-700">{locationLabel(customer)}</td>
                <td className="px-3 py-3 text-zinc-700">
                  {numberFormat.format(customer.order_count)}
                  {customer.enquiry_count > 0 ? <span className="text-xs text-zinc-500"> / {customer.enquiry_count} enquiries</span> : null}
                </td>
                <td className="px-3 py-3 font-semibold text-zinc-900">{money.format(customer.lifetime_value)}</td>
                <td className="px-3 py-3 text-zinc-700">{formatDate(customer.last_seen_at)}</td>
                <td className="px-3 py-3 text-zinc-700">{sourceBadges(customer.source_systems)}</td>
              </tr>
            ))}
            {customers.length === 0 ? (
              <tr>
                <td className="px-3 py-10 text-center text-sm text-zinc-500" colSpan={8}>
                  No customer history records found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
