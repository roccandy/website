"use client";
import { useEffect, useState, useTransition, Fragment } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Search,
  RefreshCw,
  Download,
  Plus,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { AdminLink } from "../../AdminNavigationFeedback";
import { csvCell, perthDate } from "../../stats-v2/statsModel";
import {
  filterInvoices,
  invoiceStatusLabels,
  type InvoiceFilter,
  type InvoiceFilters,
  type InvoiceRecord,
} from "./invoiceModel";
import { invoiceDate, invoiceMoney, invoiceTone } from "./invoicePresentation";

const button =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-600 hover:border-emerald-600 hover:text-emerald-800 disabled:opacity-40";
const tabs: [InvoiceFilter, string][] = [
  ["all", "All invoices"],
  ["attention", "Needs attention"],
  ["draft", "Drafts"],
  ["unpaid", "Awaiting payment"],
  ["overdue", "Overdue"],
  ["paid", "Paid"],
  ["cancelled", "Cancelled"],
  ["refunded", "Refunded"],
  ["error", "Errors / review"],
];
export function InvoiceHub({
  invoices,
  loadedAt,
  initialFilters,
  initialPage = 1,
  canWrite,
}: {
  invoices: InvoiceRecord[];
  loadedAt: string;
  initialFilters: InvoiceFilters;
  initialPage?: number;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(initialPage);
  const [expanded, setExpanded] = useState<string | null>(null);
  const filtered = filterInvoices(invoices, filters);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 25));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * 25, currentPage * 25);
  const counts = Object.fromEntries(
    tabs.map(([view]) => [
      view,
      filterInvoices(invoices, {
        view,
        q: "",
        sort: "newest",
        from: "",
        to: "",
      }).length,
    ]),
  );
  const overdue = invoices.filter((invoice) => invoice.status === "overdue");
  const recordedUnpaid = invoices.reduce(
    (sum, invoice) => sum + (invoice.unpaid ?? 0),
    0,
  );
  const unknownBalances = invoices.filter(
    (invoice) => invoice.unpaid === null,
  ).length;
  const change = (update: Partial<InvoiceFilters>) => {
    setFilters((current) => ({ ...current, ...update }));
    setPage(1);
  };
  const clear = () => {
    setFilters({ view: "all", q: "", sort: "newest", from: "", to: "" });
    setPage(1);
  };
  useEffect(() => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters))
      if (
        value &&
        !(
          (key === "view" && value === "all") ||
          (key === "sort" && value === "newest")
        )
      )
        params.set(key, value);
    if (page > 1) params.set("page", String(page));
    const url = `/admin/orders/invoices${params.size ? `?${params}` : ""}`;
    if (`${window.location.pathname}${window.location.search}` !== url)
      window.history.replaceState(window.history.state, "", url);
  }, [filters, page]);
  const exportCsv = () => {
    const rows = [
      [
        "Invoice",
        "Customer",
        "Email",
        "Order numbers",
        "Created (Perth)",
        "Payment due",
        "Last sent (Perth)",
        "Recorded total AUD",
        "Refunded AUD",
        "Recorded unpaid AUD",
        "Status",
        "Delivery route",
      ],
      ...filtered.map((invoice) => [
        invoice.title,
        invoice.customer,
        invoice.email,
        invoice.orders.map((order) => order.number).join("; "),
        perthDate(invoice.created),
        invoice.due || "",
        invoice.sent ? perthDate(invoice.sent) : "",
        (invoice.total / 100).toFixed(2),
        (invoice.refunded / 100).toFixed(2),
        invoice.unpaid === null ? "Unknown" : (invoice.unpaid / 100).toFixed(2),
        invoiceStatusLabels[invoice.status],
        invoice.routeLabel,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(
        ["\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `roc-candy-invoices-${perthDate(loadedAt)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-emerald-700">
            Payments, without the guesswork
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
            Invoices
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            All invoices, clear payment states, and the next thing to do.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => startRefresh(() => router.refresh())}
            disabled={refreshing}
            className={button}
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing…" : "Refresh records"}
          </button>
          {canWrite && (
            <AdminLink
              href="/admin/orders/new"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-4 py-2 text-xs font-semibold text-white"
            >
              <Plus size={14} />
              Create invoice order
            </AdminLink>
          )}
        </div>
      </header>
      <div className="grid min-w-0 grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          {
            label: "Recorded unpaid",
            value: invoiceMoney(recordedUnpaid),
            note: `${counts.unpaid} awaiting / part-paid · ${unknownBalances} balances unknown`,
            view: "unpaid" as InvoiceFilter,
          },
          {
            label: "Overdue",
            value: String(overdue.length),
            note: `${invoiceMoney(overdue.reduce((sum, invoice) => sum + (invoice.unpaid ?? 0), 0))} recorded past payment due`,
            view: "overdue" as InvoiceFilter,
          },
          {
            label: "Drafts not sent",
            value: String(counts.draft),
            note: "Review before choosing how to send",
            view: "draft" as InvoiceFilter,
          },
          {
            label: "Needs attention",
            value: String(counts.attention),
            note: "Drafts, overdue, errors and reviews",
            view: "attention" as InvoiceFilter,
          },
        ].map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={() => change({ view: card.view })}
            className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm hover:border-emerald-400 sm:p-5"
          >
            <p className="text-xs font-medium text-zinc-500">{card.label}</p>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
              {card.value}
            </p>
            <p className="mt-2 text-[10px] leading-5 text-zinc-400">
              {card.note}
            </p>
          </button>
        ))}
      </div>
      <section
        className="min-w-0 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
        aria-label="Invoice directory"
      >
        <div className="space-y-4 border-b border-zinc-100 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-900">
              {filters.view === "all" ? "All invoices" : "Invoice work queue"}
            </h2>
            <button type="button" className={button} onClick={exportCsv}>
              <Download size={13} />
              Export this list
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5" aria-label="Invoice views">
            {tabs.map(([view, label]) => (
              <button
                key={view}
                type="button"
                onClick={() => change({ view })}
                aria-pressed={filters.view === view}
                className={`rounded-lg px-3 py-2 text-xs font-medium ${filters.view === view ? "bg-zinc-900 text-white" : "bg-zinc-50 text-zinc-500 hover:bg-zinc-100"}`}
              >
                {label}
                <span className="ml-2 text-[10px] opacity-60">
                  {counts[view]}
                </span>
              </button>
            ))}
          </div>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_13rem_10rem_10rem]">
            <label className="relative block min-w-0">
              <span className="sr-only">
                Search invoices by customer, invoice or order
              </span>
              <Search
                size={15}
                className="absolute left-3 top-3 text-zinc-400"
              />
              <input
                type="search"
                value={filters.q}
                onChange={(event) => change({ q: event.target.value })}
                placeholder="Customer, email, invoice or order number…"
                className="w-full min-w-0 rounded-lg border border-zinc-200 py-2.5 pl-9 pr-3 text-xs"
              />
            </label>
            <label>
              <span className="sr-only">Sort invoices</span>
              <select
                value={filters.sort}
                onChange={(event) => change({ sort: event.target.value })}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-xs"
              >
                <option value="newest">Created · newest first</option>
                <option value="oldest">Created · oldest first</option>
                <option value="customer">Customer · A–Z</option>
                <option value="customer-desc">Customer · Z–A</option>
                <option value="due">Payment due · earliest</option>
                <option value="amount">Amount · highest first</option>
              </select>
            </label>
            <label className="text-[10px] text-zinc-500">
              Created from
              <input
                type="date"
                aria-label="Invoices created from"
                value={filters.from}
                onChange={(event) => change({ from: event.target.value })}
                className="mt-1 block w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-xs text-zinc-700"
              />
            </label>
            <label className="text-[10px] text-zinc-500">
              Created to
              <input
                type="date"
                aria-label="Invoices created to"
                value={filters.to}
                onChange={(event) => change({ to: event.target.value })}
                className="mt-1 block w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-xs text-zinc-700"
              />
            </label>
          </div>
          {(filters.q ||
            filters.from ||
            filters.to ||
            filters.view !== "all") && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
              <span>
                {filtered.length} matching invoice records
                {filters.from && filters.to && filters.from > filters.to
                  ? " · start date is after end date"
                  : ""}
              </span>
              <button
                type="button"
                onClick={clear}
                className="inline-flex items-center gap-1 text-emerald-800"
              >
                <X size={12} />
                Show all / clear filters
              </button>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-xs">
            <thead className="bg-zinc-50 text-[10px] uppercase tracking-wider text-zinc-400">
              <tr>
                {[
                  "Invoice / customer",
                  "Created",
                  "Payment due",
                  "Recorded total",
                  "Status / delivery",
                  "Next action",
                ].map((label) => (
                  <th key={label} className="px-4 py-3 font-semibold">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {visible.map((invoice) => (
                <Fragment key={invoice.id}>
                  <tr className="align-top hover:bg-zinc-50/60">
                    <td className="max-w-xs px-4 py-4">
                      <AdminLink
                        href={
                          invoice.invoiceId
                            ? `/admin/orders/${invoice.orderId}/invoice`
                            : `/admin/orders/${invoice.orderId}`
                        }
                        className="font-semibold text-zinc-900 hover:text-emerald-800 hover:underline"
                      >
                        {invoice.title}
                      </AdminLink>
                      <p className="mt-1 text-zinc-500">{invoice.customer}</p>
                      <p className="mt-1 text-[10px] text-zinc-400">
                        {invoice.orders
                          .map((order) => `#${order.number}`)
                          .join(", ")}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded(
                            expanded === invoice.id ? null : invoice.id,
                          )
                        }
                        aria-expanded={expanded === invoice.id}
                        className="mt-2 text-[10px] font-semibold text-emerald-800"
                      >
                        {expanded === invoice.id
                          ? "Hide details"
                          : "Show details"}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-zinc-500">
                      {invoiceDate(perthDate(invoice.created))}
                    </td>
                    <td
                      className={`whitespace-nowrap px-4 py-4 ${invoice.status === "overdue" ? "font-semibold text-rose-700" : "text-zinc-500"}`}
                    >
                      {invoice.due ? invoiceDate(invoice.due) : "Not recorded"}
                      {invoice.sent && (
                        <p className="mt-1 text-[10px] font-normal text-zinc-400">
                          Sent {invoiceDate(perthDate(invoice.sent))}
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 font-semibold text-zinc-900">
                      {invoiceMoney(invoice.total)}
                      {invoice.refunded > 0 && (
                        <p className="mt-1 text-[10px] font-normal text-zinc-400">
                          {invoiceMoney(invoice.refunded)} refunded
                        </p>
                      )}
                    </td>
                    <td className="max-w-xs px-4 py-4">
                      <span
                        className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-semibold ${invoiceTone(invoice.status)}`}
                      >
                        {invoiceStatusLabels[invoice.status]}
                      </span>
                      <p className="mt-2 text-[10px] text-zinc-500">
                        {invoice.routeLabel}
                      </p>
                    </td>
                    <td className="max-w-64 px-4 py-4">
                      <p className="mb-3 max-w-xs text-[11px] leading-5 text-zinc-500">
                        {invoice.reason}
                      </p>
                      <AdminLink
                        href={
                          invoice.invoiceId
                            ? `/admin/orders/${invoice.orderId}/invoice`
                            : `/admin/orders/${invoice.orderId}`
                        }
                        className={button}
                      >
                        {!invoice.invoiceId
                          ? "Review order"
                          : invoice.status === "draft" && canWrite
                            ? "Review & send"
                            : invoice.attention
                              ? "Review invoice"
                              : "Invoice details"}
                        <ArrowUpRight size={12} />
                      </AdminLink>
                      {invoice.originalPdf ? <a href={`/api/admin/emails/${invoice.originalPdf.emailId}/attachment/${invoice.originalPdf.index}?inline=1`} target="_blank" rel="noopener noreferrer" className={`${button} mt-2`}>View sent invoice PDF<ArrowUpRight size={12}/></a> : null}
                    </td>
                  </tr>
                  {expanded === invoice.id && (
                    <tr>
                      <td colSpan={6} className="bg-zinc-50 px-4 py-4">
                        <div className="grid min-w-0 gap-4 md:grid-cols-2">
                          <div>
                            <p className="mb-2 text-[10px] font-semibold uppercase text-zinc-400">
                              Linked orders
                            </p>
                            <div className="space-y-2">
                              {invoice.orders.map((order) => (
                                <AdminLink
                                  key={order.id}
                                  href={`/admin/orders/${order.id}`}
                                  className="flex items-start justify-between gap-3 text-xs text-emerald-800 hover:underline"
                                >
                                  <span>
                                    #{order.number} · {order.title}
                                  </span>
                                  <span className="shrink-0 text-zinc-500">
                                    {invoiceMoney(order.total)}
                                  </span>
                                </AdminLink>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-2 text-xs text-zinc-500">
                            <p className="break-all">
                              {invoice.email || "Email not recorded"}
                            </p>
                            <p className="break-all">
                              Invoice reference:{" "}
                              {invoice.invoiceId || "Not created"}
                            </p>
                            <p>
                              {invoice.unpaid === null
                                ? "Remaining balance: check the payment record"
                                : invoice.unpaid > 0
                                  ? `Recorded unpaid: ${invoiceMoney(invoice.unpaid)}`
                                  : "No recorded payment follow-up amount"}
                            </p>
                            {invoice.externalUrl && (
                              <a
                                href={invoice.externalUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 font-semibold text-emerald-800"
                              >
                                Open Square invoice
                                <ArrowUpRight size={12} />
                              </a>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {!visible.length && (
          <div className="px-5 py-16 text-center">
            <p className="text-sm font-semibold text-zinc-800">
              {invoices.length
                ? "No invoices match this view"
                : "No invoice records yet"}
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              {invoices.length
                ? "Try another name, change the dates, or show all invoices."
                : "Website checkout payments are not automatically Square invoices. Admin invoice orders will appear here."}
            </p>
            {invoices.length > 0 && (
              <button
                type="button"
                onClick={clear}
                className="mt-4 text-xs font-semibold text-emerald-800"
              >
                Show all invoices
              </button>
            )}
          </div>
        )}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 px-4 py-3 text-[10px] text-zinc-500">
          <span>
            Showing {filtered.length ? (currentPage - 1) * 25 + 1 : 0}–
            {Math.min(currentPage * 25, filtered.length)} of {filtered.length}{" "}
            invoice records
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous invoice page"
              className={button}
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft size={12} />
            </button>
            <span>
              Page {currentPage} of {pageCount}
            </span>
            <button
              type="button"
              aria-label="Next invoice page"
              className={button}
              disabled={currentPage === pageCount}
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRight size={12} />
            </button>
          </div>
        </footer>
      </section>
      <p className="text-[10px] leading-5 text-zinc-400">
        Figures use saved order/invoice records, not a live bank or Square
        reconciliation. Unknown part-paid balances are excluded from the
        recorded unpaid total. Dates use Perth time. Records loaded{" "}
        {new Intl.DateTimeFormat("en-AU", {
          hour: "numeric",
          minute: "2-digit",
          timeZone: "Australia/Perth",
        }).format(new Date(loadedAt))}{" "}
        AWST.
      </p>
    </section>
  );
}
