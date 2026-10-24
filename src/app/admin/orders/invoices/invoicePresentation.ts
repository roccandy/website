import type { InvoiceStatus } from "./invoiceModel";
export const invoiceMoney = (value: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(
    value / 100,
  );
export const invoiceDate = (date: string | null) =>
  date
    ? new Intl.DateTimeFormat("en-AU", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${date}T12:00:00Z`))
    : "Not recorded";
export const invoiceTone = (status: InvoiceStatus) =>
  status === "paid"
    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
    : ["overdue", "error", "review"].includes(status)
      ? "bg-rose-50 text-rose-800 border-rose-200"
      : ["cancelled", "refunded"].includes(status)
        ? "bg-zinc-100 text-zinc-600 border-zinc-200"
        : status === "draft"
          ? "bg-sky-50 text-sky-800 border-sky-200"
          : "bg-amber-50 text-amber-800 border-amber-200";
