import type { OrderRow } from "@/lib/data";
import { cents, perthDate } from "../../stats-v2/statsModel";

export type InvoiceOrder = Pick<
  OrderRow,
  | "id"
  | "order_number"
  | "title"
  | "customer_name"
  | "customer_email"
  | "first_name"
  | "last_name"
  | "created_at"
  | "due_date"
  | "total_price"
  | "status"
  | "paid_at"
  | "payment_provider"
  | "payment_method"
  | "square_invoice_id"
  | "square_invoice_title"
  | "square_invoice_status"
  | "square_invoice_url"
  | "square_invoice_due_date"
  | "square_invoice_created_at"
  | "square_invoice_sent_at"
  | "square_invoice_error"
  | "refunded_at"
  | "refunded_amount"
>;
export type InvoiceStatus =
  | "draft"
  | "awaiting"
  | "overdue"
  | "partial"
  | "paid"
  | "cancelled"
  | "refunded"
  | "partial-refund"
  | "error"
  | "review";
export const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  draft: "Draft · not sent",
  awaiting: "Awaiting payment",
  overdue: "Overdue",
  partial: "Part-paid · check balance",
  paid: "Paid",
  cancelled: "Cancelled invoice",
  refunded: "Fully refunded",
  "partial-refund": "Partially refunded",
  error: "Invoice error",
  review: "Needs review",
};
export type InvoiceRecord = {
  originalPdf?: {emailId:string; index:number};
  id: string;
  invoiceId: string | null;
  orderId: string;
  title: string;
  customer: string;
  email: string;
  orders: { id: string; number: string; title: string; total: number }[];
  total: number;
  refunded: number;
  unpaid: number | null;
  created: string;
  due: string | null;
  sent: string | null;
  paidAt: string | null;
  status: InvoiceStatus;
  route: "pdf" | "square" | "unknown";
  routeLabel: string;
  reason: string;
  attention: boolean;
  hasError: boolean;
  canSend: boolean;
  canRecordPayment: boolean;
  externalUrl: string | null;
};
export function safeInvoiceUrl(value: string | null | undefined) {
  try {
    const url = new URL(value || "");
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
const latest = (values: (string | null)[]) =>
  values
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;

export function buildInvoiceRecord(
  rows: InvoiceOrder[],
  loadedAt: string,
): InvoiceRecord {
  if (!rows.length) throw new Error("Invoice has no linked orders.");
  const ordered = [...rows].sort(
    (a, b) =>
      a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
  );
  const first = ordered[0];
  const today = perthDate(loadedAt);
  const invoiceId =
    ordered.find((row) => row.square_invoice_id)?.square_invoice_id ?? null;
  const states = new Set(
    ordered
      .map((row) => row.square_invoice_status?.trim().toUpperCase())
      .filter(Boolean),
  );
  const hasError = ordered.some((row) => Boolean(row.square_invoice_error));
  const sent = latest(ordered.map((row) => row.square_invoice_sent_at));
  const paidAt = latest(ordered.map((row) => row.paid_at));
  const paid =
    ordered.every((row) => Boolean(row.paid_at)) || states.has("PAID");
  const somePaid = ordered.some((row) => Boolean(row.paid_at));
  const cancelled = states.has("CANCELED") || states.has("CANCELLED");
  const inactiveOrders = ordered.every((row) =>
    ["cancelled", "canceled", "failed", "test"].includes(row.status),
  );
  const total = ordered.reduce(
    (sum, row) => sum + Math.max(0, cents(row.total_price)),
    0,
  );
  const refunded = ordered.reduce(
    (sum, row) =>
      sum +
      Math.min(
        Math.max(0, cents(row.total_price)),
        Math.max(0, cents(row.refunded_amount)) ||
          (row.refunded_at && row.status !== "partially-refunded"
            ? Math.max(0, cents(row.total_price))
            : 0),
      ),
    0,
  );
  const hasRefund =
    refunded > 0 || ordered.some((row) => Boolean(row.refunded_at));
  const dueDates = [
    ...new Set(
      ordered
        .map((row) => row.square_invoice_due_date)
        .filter((date): date is string => Boolean(date)),
    ),
  ].sort();
  const due = dueDates[0] ?? null; // Never substitute the order's production/required date.
  const pdf =
    Boolean(
      sent &&
      ordered.some((row) =>
        /direct.deposit|bank.transfer|pdf/i.test(row.payment_method || ""),
      ),
    ) || Boolean(sent && states.size === 1 && states.has("DRAFT"));
  const published = [
    "UNPAID",
    "PARTIALLY_PAID",
    "PAID",
    "PAYMENT_PENDING",
  ].some((state) => states.has(state));
  const sentKnown = Boolean(sent || published);
  const route = pdf ? "pdf" : published ? "square" : "unknown";
  const routeLabel = pdf
    ? "PDF sent · bank transfer"
    : published
      ? "Square payment link"
      : sent
        ? "Sent · route unconfirmed"
        : "Not sent";
  const conflicting =
    dueDates.length > 1 ||
    (paid && cancelled) ||
    (somePaid && !paid && !states.has("PARTIALLY_PAID"));
  let status: InvoiceStatus;
  let reason: string;
  if (hasRefund) {
    status = total > 0 && refunded >= total ? "refunded" : "partial-refund";
    reason =
      status === "refunded"
        ? "The recorded order total has been refunded. No payment follow-up is suggested."
        : "A partial refund is recorded. Review the order and retained amount; that amount is not a new customer debt.";
  } else if (conflicting) {
    status = "review";
    reason =
      "Linked orders have conflicting saved payment or due-date records. Check the invoice before taking action.";
  } else if (paid) {
    status = "paid";
    reason = hasError
      ? "Payment is recorded, but an earlier invoice error is still saved. Review it; do not send a new payment request."
      : "Payment is recorded. No payment follow-up needed.";
  } else if (cancelled) {
    status = "cancelled";
    reason =
      "The invoice is recorded as cancelled. Check the linked order separately if fulfilment remains open.";
  } else if (hasError || states.has("FAILED") || !invoiceId) {
    status = "error";
    reason = !invoiceId
      ? "Invoice creation did not produce a saved invoice reference. Review the order before creating or retrying anything."
      : "An invoice send or sync error is recorded. Review it before retrying to avoid duplicate messages.";
  } else if (inactiveOrders) {
    status = "review";
    reason =
      "The linked orders are cancelled, failed or test orders, but the invoice is not recorded as cancelled. Check both records.";
  } else if (states.has("PAYMENT_PENDING")) {
    status = "review";
    reason =
      "Square reports a payment in progress. Check its outcome before sending a reminder or recording another payment.";
  } else if (states.has("PARTIALLY_PAID") || somePaid) {
    status = "partial";
    reason =
      "Part payment is recorded, but the exact remaining balance is not stored here. Check Square before following up.";
  } else if (!sentKnown) {
    status = "draft";
    reason =
      "The draft is saved but no send is recorded. Review the customer and choose PDF or Square payment link.";
  } else if (due && due < today) {
    status = "overdue";
    reason = pdf
      ? "The PDF invoice's recorded payment due date has passed. Check bank receipts before following up."
      : "The recorded invoice payment due date has passed. Check the latest payment status before following up.";
  } else {
    status = "awaiting";
    reason = due
      ? "Sent and awaiting recorded payment."
      : "Sent and awaiting payment; no invoice payment due date is recorded.";
  }
  const canSend = Boolean(
    invoiceId &&
    !hasError &&
    !paid &&
    !hasRefund &&
    !cancelled &&
    !inactiveOrders &&
    !sentKnown &&
    !somePaid &&
    (!states.size || (states.size === 1 && states.has("DRAFT"))),
  );
  const attention =
    ["draft", "overdue", "partial", "error", "review"].includes(status) ||
    hasError ||
    status === "partial-refund";
  const unpaid =
    status === "awaiting" || status === "overdue"
      ? total
      : ["partial", "review", "error"].includes(status)
        ? null
        : 0;
  return {
    id: invoiceId || `missing-${first.id}`,
    invoiceId,
    orderId: first.id,
    title:
      ordered
        .find((row) => row.square_invoice_title?.trim())
        ?.square_invoice_title?.trim() ||
      `Invoice ${first.order_number ? `#${first.order_number}` : first.id.slice(0, 8)}`,
    customer:
      first.customer_name?.trim() ||
      [first.first_name, first.last_name].filter(Boolean).join(" ") ||
      "Customer not recorded",
    email: first.customer_email || "",
    orders: ordered.map((row) => ({
      id: row.id,
      number: row.order_number || row.id.slice(0, 8),
      title: row.title || "Untitled order",
      total: cents(row.total_price),
    })),
    total,
    refunded,
    unpaid,
    created:
      latest(ordered.map((row) => row.square_invoice_created_at)) ||
      first.created_at,
    due,
    sent,
    paidAt,
    status,
    route,
    routeLabel,
    reason,
    attention,
    hasError,
    canSend,
    canRecordPayment:
      !hasError && ["pdf", "square"].includes(route) && ["awaiting", "overdue"].includes(status),
    externalUrl:
      route === "square"
        ? ordered
            .map((row) => safeInvoiceUrl(row.square_invoice_url))
            .find(Boolean) || null
        : null,
  };
}
export function buildInvoices(rows: InvoiceOrder[], loadedAt: string) {
  const groups = new Map<string, InvoiceOrder[]>();
  for (const row of rows) {
    if (
      !row.square_invoice_id &&
      !row.square_invoice_error &&
      row.payment_provider !== "square_invoice"
    )
      continue;
    const key = row.square_invoice_id || `missing-${row.id}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.values()]
    .map((rows) => buildInvoiceRecord(rows, loadedAt))
    .sort(
      (a, b) => b.created.localeCompare(a.created) || a.id.localeCompare(b.id),
    );
}
export type InvoiceFilter =
  | "all"
  | "attention"
  | "draft"
  | "unpaid"
  | "overdue"
  | "paid"
  | "cancelled"
  | "refunded"
  | "error";
export type InvoiceFilters = {
  view: InvoiceFilter;
  q: string;
  sort: string;
  from: string;
  to: string;
};
export function parseInvoiceFilters(
  values: Record<string, unknown>,
): InvoiceFilters {
  const text = (key: string) =>
    typeof values[key] === "string"
      ? (values[key] as string).slice(0, 200)
      : "";
  const view = text("view");
  const sort = text("sort");
  const date = (key: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(text(key)) ? text(key) : "";
  return {
    view: [
      "all",
      "attention",
      "draft",
      "unpaid",
      "overdue",
      "paid",
      "cancelled",
      "refunded",
      "error",
    ].includes(view)
      ? (view as InvoiceFilter)
      : "all",
    q: text("q"),
    sort: [
      "newest",
      "oldest",
      "customer",
      "customer-desc",
      "due",
      "amount",
    ].includes(sort)
      ? sort
      : "newest",
    from: date("from"),
    to: date("to"),
  };
}
export function filterInvoices(
  invoices: InvoiceRecord[],
  filters: InvoiceFilters,
) {
  const collator = new Intl.Collator("en-AU", {
    sensitivity: "base",
    numeric: true,
  });
  return invoices
    .filter((invoice) => {
      const matches =
        filters.view === "all" ||
        (filters.view === "attention"
          ? invoice.attention
          : filters.view === "unpaid"
            ? ["awaiting", "overdue", "partial"].includes(invoice.status)
            : filters.view === "refunded"
              ? ["refunded", "partial-refund"].includes(invoice.status)
              : filters.view === "error"
                ? invoice.hasError ||
                  ["error", "review"].includes(invoice.status)
                : invoice.status === filters.view);
      const created = perthDate(invoice.created);
      return (
        matches &&
        (!filters.from || created >= filters.from) &&
        (!filters.to || created <= filters.to) &&
        `${invoice.title} ${invoice.invoiceId || ""} ${invoice.customer} ${invoice.email} ${invoice.orders.map((order) => `${order.number} ${order.title}`).join(" ")}`
          .toLowerCase()
          .includes(filters.q.trim().toLowerCase())
      );
    })
    .sort(
      (a, b) =>
        (filters.sort === "customer"
          ? collator.compare(a.customer, b.customer)
          : filters.sort === "customer-desc"
            ? collator.compare(b.customer, a.customer)
            : filters.sort === "oldest"
              ? a.created.localeCompare(b.created)
              : filters.sort === "due"
                ? (a.due || "9999").localeCompare(b.due || "9999")
                : filters.sort === "amount"
                  ? b.total - a.total
                  : b.created.localeCompare(a.created)) ||
        a.id.localeCompare(b.id),
    );
}
