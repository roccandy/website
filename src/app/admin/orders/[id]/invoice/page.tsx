import { AdminLink as Link } from "@/app/admin/AdminNavigationFeedback";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import type { OrderRow } from "@/lib/data";
import { defaultAdminSquareInvoiceTitle } from "@/lib/adminOrderIntegrations";
import { formatDate, formatMoney } from "../../productionScheduleShared";
import { isAdminManagedCustomOrder } from "../../scheduleVisibility";
import { sendAdminSquareInvoice } from "../../actions";
import { SendInvoiceButton } from "./SendInvoiceButton";
import {
  buildInvoiceRecord,
  invoiceStatusLabels,
} from "../../invoices/invoiceModel";
import {
  invoiceMoney,
  invoiceDate,
  invoiceTone,
} from "../../invoices/invoicePresentation";
import { OrderPaymentConfirmation } from "../../OrderPaymentConfirmation";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type Params = {
  params?: { id?: string } | Promise<{ id?: string }>;
  searchParams?: { edit?: string } | Promise<{ edit?: string }>;
};

export default async function AdminInvoiceReviewPage({
  params,
  searchParams,
}: Params) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/admin/login");

  const resolvedParams = await Promise.resolve(params);
  const orderId = resolvedParams?.id?.trim() || "";
  if (!orderId) redirect("/admin/orders");

  const { data, error } = await supabaseAdminClient
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (error || !data) redirect("/admin/orders");

  const order = data as OrderRow;
  if (!isAdminManagedCustomOrder(order)) {
    redirect(`/admin/orders?selected=${encodeURIComponent(order.id)}`);
  }
  const groupedInvoiceResult = order.square_invoice_id
    ? await supabaseAdminClient
        .from("orders")
        .select("*")
        .eq("square_invoice_id", order.square_invoice_id)
    : { data: [order], error: null };
  if (groupedInvoiceResult.error)
    redirect(`/admin/orders?selected=${encodeURIComponent(order.id)}`);
  const invoiceOrders = (groupedInvoiceResult.data ?? []) as OrderRow[];
  const groupedOrders = (
    invoiceOrders.length > 0 ? invoiceOrders : [order]
  ).sort((a, b) => {
    const aDate = a.due_date
      ? new Date(a.due_date).getTime()
      : Number.POSITIVE_INFINITY;
    const bDate = b.due_date
      ? new Date(b.due_date).getTime()
      : Number.POSITIVE_INFINITY;
    if (aDate !== bDate) return aDate - bDate;
    return (a.order_number ?? a.created_at ?? a.id).localeCompare(
      b.order_number ?? b.created_at ?? b.id,
    );
  });
  const primaryOrder = groupedOrders[0] ?? order;
  const record = buildInvoiceRecord(groupedOrders, new Date().toISOString());
  const canWrite = Boolean(session.user?.canWrite);
  const editing =
    (await Promise.resolve(searchParams))?.edit === "1" &&
    canWrite &&
    record.canSend;
  const invoiceTitle =
    primaryOrder.square_invoice_title?.trim() ||
    defaultAdminSquareInvoiceTitle({
      ...primaryOrder,
      invoiceOrders: groupedOrders,
    });
  const totalPrice = groupedOrders.reduce((sum, invoiceOrder) => {
    const amount = Number(invoiceOrder.total_price);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);
  const gstIncluded = totalPrice > 0 ? totalPrice / 11 : null;
  const isAlreadySent =
    !record.canSend ||
    groupedOrders.some((invoiceOrder) =>
      Boolean(
        invoiceOrder.square_invoice_sent_at ||
        invoiceOrder.square_invoice_status === "UNPAID" ||
        invoiceOrder.square_invoice_status === "PAID",
      ),
    );

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Admin / Invoice Review
          </p>
          <h2 className="admin-page-title">
            {editing ? "Review & send invoice" : "Invoice summary"}
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-600">
            <span>
              {primaryOrder.order_number
                ? `#${primaryOrder.order_number}`
                : primaryOrder.id.slice(0, 8)}{" "}
              · {primaryOrder.customer_name ?? "No customer"}
              {groupedOrders.length > 1
                ? ` · ${groupedOrders.length} orders`
                : ""}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${invoiceTone(record.status)}`}
            >
              {invoiceStatusLabels[record.status]}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {editing ? (
            <Link
              href={`/admin/orders/${order.id}/invoice`}
              className="rounded border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700"
            >
              Cancel editing
            </Link>
          ) : null}
          <Link
            href="/admin/orders/invoices"
            className="rounded border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
          >
            All invoices
          </Link>
          <Link
            href={`/admin/orders?selected=${encodeURIComponent(primaryOrder.id)}`}
            className="rounded border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
          >
            Back to schedule
          </Link>
        </div>
      </div>

      {primaryOrder.square_invoice_error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
          {primaryOrder.square_invoice_error}
        </p>
      ) : null}

      {record.sent ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
          A send is already recorded. This may be a PDF bank-transfer invoice
          rather than a published Square payment link.
        </p>
      ) : null}

      {!editing ? (
        <div className="space-y-5">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 space-y-2">
                <h3 className="break-words text-xl font-semibold">
                  {invoiceTitle}
                </h3>
                <span
                  className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${invoiceTone(record.status)}`}
                >
                  {invoiceStatusLabels[record.status]}
                </span>
                <p className="text-sm text-zinc-600">{record.routeLabel}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Recorded total</p>
                <p className="text-2xl font-semibold">
                  {invoiceMoney(record.total)}
                </p>
              </div>
            </div>
            <p className="mt-4 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700">
              {record.reason}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {canWrite && record.canSend ? (
                <Link
                  href={`/admin/orders/${order.id}/invoice?edit=1`}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
                >
                  Review &amp; send draft
                </Link>
              ) : null}
              {record.externalUrl ? (
                <a
                  href={record.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border px-4 py-2 text-sm font-semibold"
                >
                  Open Square invoice ↗
                </a>
              ) : null}
              {canWrite && record.canRecordPayment ? (
                <OrderPaymentConfirmation
                  id={primaryOrder.id}
                  combined={groupedOrders.length > 1}
                />
              ) : null}
            </div>
          </div>
          <div className="grid min-w-0 gap-5 lg:grid-cols-2">
            <section className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-5">
              <h3 className="font-semibold">Customer &amp; payment</h3>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <dt className="text-zinc-500">Customer</dt>
                <dd className="break-words">{record.customer}</dd>
                <dt className="text-zinc-500">Email</dt>
                <dd className="break-all">{record.email || "Not recorded"}</dd>
                <dt className="text-zinc-500">Phone</dt>
                <dd>{primaryOrder.phone || "Not recorded"}</dd>
                <dt className="text-zinc-500">Created</dt>
                <dd>{invoiceDate(record.created.slice(0, 10))}</dd>
                <dt className="text-zinc-500">Payment due</dt>
                <dd>{invoiceDate(record.due)}</dd>
                <dt className="text-zinc-500">Sent</dt>
                <dd>
                  {record.sent
                    ? formatDate(record.sent)
                    : "No send date recorded"}
                </dd>
                <dt className="text-zinc-500">Recorded unpaid</dt>
                <dd>
                  {record.unpaid === null
                    ? "Unknown · check payment records"
                    : invoiceMoney(record.unpaid)}
                </dd>
                {record.refunded > 0 ? (
                  <>
                    <dt className="text-zinc-500">Refunded</dt>
                    <dd>{invoiceMoney(record.refunded)}</dd>
                  </>
                ) : null}
              </dl>
              {primaryOrder.customer_note ? (
                <p className="mt-4 whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 text-sm">
                  {primaryOrder.customer_note}
                </p>
              ) : null}
            </section>
            <section className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-5">
              <h3 className="font-semibold">
                Linked orders ({groupedOrders.length})
              </h3>
              <div className="mt-3 divide-y divide-zinc-100">
                {groupedOrders.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-start justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/admin/orders/${row.id}`}
                        className="break-words text-sm font-semibold underline"
                      >
                        #{row.order_number || row.id.slice(0, 8)} ·{" "}
                        {row.title || "Custom candy order"}
                      </Link>
                      <p className="mt-1 text-xs text-zinc-500">
                        Required: {formatDate(row.due_date)}
                      </p>
                      {row.order_description ? (
                        <p className="mt-1 break-words text-xs text-zinc-600">
                          {row.order_description}
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-sm">
                      {formatMoney(row.total_price)}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-4 break-all text-xs text-zinc-500">
                Invoice reference:{" "}
                {record.invoiceId || "Missing — review the order"}
              </p>
            </section>
          </div>
          <p className="text-xs text-zinc-500">
            Saved website records, not a live bank or Square reconciliation.
            Check receipts before chasing or recording payment.
          </p>
        </div>
      ) : (
        <form
          action={sendAdminSquareInvoice}
          className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]"
        >
          <input type="hidden" name="order_id" value={primaryOrder.id} />
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="space-y-4">
              <label className="block text-xs uppercase tracking-[0.2em] text-zinc-500">
                Invoice title
                <input
                  name="square_invoice_title"
                  defaultValue={invoiceTitle}
                  disabled={isAlreadySent}
                  className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm normal-case tracking-normal text-zinc-900 disabled:bg-zinc-50 disabled:text-zinc-500"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-xs uppercase tracking-[0.2em] text-zinc-500">
                  First name
                  <input
                    name="first_name"
                    defaultValue={primaryOrder.first_name ?? ""}
                    disabled={isAlreadySent}
                    className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm normal-case tracking-normal text-zinc-900 disabled:bg-zinc-50 disabled:text-zinc-500"
                  />
                </label>
                <label className="block text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Last name
                  <input
                    name="last_name"
                    defaultValue={primaryOrder.last_name ?? ""}
                    disabled={isAlreadySent}
                    className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm normal-case tracking-normal text-zinc-900 disabled:bg-zinc-50 disabled:text-zinc-500"
                  />
                </label>
                <label className="block text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Customer name
                  <input
                    name="customer_name"
                    defaultValue={primaryOrder.customer_name ?? ""}
                    disabled={isAlreadySent}
                    className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm normal-case tracking-normal text-zinc-900 disabled:bg-zinc-50 disabled:text-zinc-500"
                  />
                </label>
                <label className="block text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Customer email
                  <input
                    name="customer_email"
                    type="email"
                    defaultValue={primaryOrder.customer_email ?? ""}
                    disabled={isAlreadySent}
                    className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm normal-case tracking-normal text-zinc-900 disabled:bg-zinc-50 disabled:text-zinc-500"
                  />
                </label>
                <label className="block text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Phone
                  <input
                    name="phone"
                    defaultValue={primaryOrder.phone ?? ""}
                    disabled={isAlreadySent}
                    className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm normal-case tracking-normal text-zinc-900 disabled:bg-zinc-50 disabled:text-zinc-500"
                  />
                </label>
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                    Due date
                  </p>
                  <p className="mt-2 text-sm font-semibold text-zinc-900">
                    {formatDate(primaryOrder.square_invoice_due_date)}
                  </p>
                </div>
              </div>

              <label className="block text-xs uppercase tracking-[0.2em] text-zinc-500">
                Customer note
                <textarea
                  name="customer_note"
                  defaultValue={primaryOrder.customer_note ?? ""}
                  rows={7}
                  disabled={isAlreadySent}
                  className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm normal-case tracking-normal text-zinc-900 disabled:bg-zinc-50 disabled:text-zinc-500"
                />
              </label>
              {!isAlreadySent ? (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-xs text-zinc-600">
                  <p className="font-semibold text-zinc-900">
                    Choose how to send this invoice
                  </p>
                  <p className="mt-1">
                    Send invoice publishes Square&apos;s hosted card-payment
                    invoice. Send PDF keeps the Square invoice as a draft and
                    emails the attached direct-deposit tax invoice to the
                    customer and the orders mailbox.
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <aside className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              Invoice preview
            </p>
            <div className="mt-4 space-y-4">
              <div className="border-b border-zinc-200 pb-4">
                <p className="text-sm font-semibold text-zinc-900">
                  {invoiceTitle}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Draft in Square: {primaryOrder.square_invoice_id ?? "-"}
                </p>
              </div>
              <div className="space-y-3">
                {groupedOrders.map((invoiceOrder) => (
                  <div
                    key={invoiceOrder.id}
                    className="flex items-start justify-between gap-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">
                        {invoiceOrder.order_number
                          ? `#${invoiceOrder.order_number} - `
                          : ""}
                        {invoiceOrder.title || "Custom candy order"}
                      </p>
                      {invoiceOrder.order_description ? (
                        <p className="mt-1 text-xs text-zinc-500">
                          {invoiceOrder.order_description}
                        </p>
                      ) : null}
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-zinc-900">
                      {formatMoney(invoiceOrder.total_price)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="space-y-2 border-t border-zinc-200 pt-4 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-zinc-500">Total</span>
                  <span className="font-semibold text-zinc-900">
                    {formatMoney(totalPrice)}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-zinc-500">GST included</span>
                  <span className="font-semibold text-zinc-900">
                    {gstIncluded === null ? "-" : formatMoney(gstIncluded)}
                  </span>
                </div>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                Pricing is locked from the create order screen and cannot be
                changed here.
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {isAlreadySent ? (
                  <Link
                    href={
                      primaryOrder.square_invoice_url ??
                      `/admin/orders?selected=${encodeURIComponent(primaryOrder.id)}`
                    }
                    className="rounded border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-300"
                  >
                    View invoice
                  </Link>
                ) : (
                  <>
                    <SendInvoiceButton delivery="pdf" />
                    <SendInvoiceButton delivery="invoice" />
                  </>
                )}
              </div>
            </div>
          </aside>
        </form>
      )}
    </section>
  );
}
