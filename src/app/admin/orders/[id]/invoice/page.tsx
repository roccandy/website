import Link from "next/link";
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

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type Params = {
  params?: { id?: string } | Promise<{ id?: string }>;
};

export default async function AdminInvoiceReviewPage({ params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/admin/login");

  const resolvedParams = await Promise.resolve(params);
  const orderId = resolvedParams?.id?.trim() || "";
  if (!orderId) redirect("/admin/orders");

  const { data, error } = await supabaseAdminClient.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (error || !data) redirect("/admin/orders");

  const order = data as OrderRow;
  if (!isAdminManagedCustomOrder(order)) {
    redirect(`/admin/orders?selected=${encodeURIComponent(order.id)}`);
  }
  const invoiceTitle = order.square_invoice_title?.trim() || defaultAdminSquareInvoiceTitle(order);
  const totalPrice = Number(order.total_price);
  const gstIncluded = Number.isFinite(totalPrice) && totalPrice > 0 ? totalPrice / 11 : null;
  const isAlreadySent = Boolean(order.square_invoice_sent_at || order.square_invoice_status === "UNPAID" || order.square_invoice_status === "PAID");

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Admin / Invoice Review</p>
          <h2 className="admin-page-title">Square invoice draft</h2>
          <p className="text-sm text-zinc-600">
            {order.order_number ? `#${order.order_number}` : order.id.slice(0, 8)} · {order.customer_name ?? "No customer"}
          </p>
        </div>
        <Link
          href={`/admin/orders?selected=${encodeURIComponent(order.id)}`}
          className="rounded border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
        >
          Back to schedule
        </Link>
      </div>

      {order.square_invoice_error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
          {order.square_invoice_error}
        </p>
      ) : null}

      {isAlreadySent ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
          This invoice has already been sent in Square.
        </p>
      ) : null}

      <form action={sendAdminSquareInvoice} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <input type="hidden" name="order_id" value={order.id} />
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
                  defaultValue={order.first_name ?? ""}
                  disabled={isAlreadySent}
                  className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm normal-case tracking-normal text-zinc-900 disabled:bg-zinc-50 disabled:text-zinc-500"
                />
              </label>
              <label className="block text-xs uppercase tracking-[0.2em] text-zinc-500">
                Last name
                <input
                  name="last_name"
                  defaultValue={order.last_name ?? ""}
                  disabled={isAlreadySent}
                  className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm normal-case tracking-normal text-zinc-900 disabled:bg-zinc-50 disabled:text-zinc-500"
                />
              </label>
              <label className="block text-xs uppercase tracking-[0.2em] text-zinc-500">
                Customer name
                <input
                  name="customer_name"
                  defaultValue={order.customer_name ?? ""}
                  disabled={isAlreadySent}
                  className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm normal-case tracking-normal text-zinc-900 disabled:bg-zinc-50 disabled:text-zinc-500"
                />
              </label>
              <label className="block text-xs uppercase tracking-[0.2em] text-zinc-500">
                Customer email
                <input
                  name="customer_email"
                  type="email"
                  defaultValue={order.customer_email ?? ""}
                  disabled={isAlreadySent}
                  className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm normal-case tracking-normal text-zinc-900 disabled:bg-zinc-50 disabled:text-zinc-500"
                />
              </label>
              <label className="block text-xs uppercase tracking-[0.2em] text-zinc-500">
                Phone
                <input
                  name="phone"
                  defaultValue={order.phone ?? ""}
                  disabled={isAlreadySent}
                  className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm normal-case tracking-normal text-zinc-900 disabled:bg-zinc-50 disabled:text-zinc-500"
                />
              </label>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Due date</p>
                <p className="mt-2 text-sm font-semibold text-zinc-900">{formatDate(order.square_invoice_due_date ?? order.due_date)}</p>
              </div>
            </div>

            <label className="block text-xs uppercase tracking-[0.2em] text-zinc-500">
              Customer note
              <textarea
                name="customer_note"
                defaultValue={order.customer_note ?? ""}
                rows={7}
                disabled={isAlreadySent}
                className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm normal-case tracking-normal text-zinc-900 disabled:bg-zinc-50 disabled:text-zinc-500"
              />
            </label>
          </div>
        </div>

        <aside className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Invoice preview</p>
          <div className="mt-4 space-y-4">
            <div className="border-b border-zinc-200 pb-4">
              <p className="text-sm font-semibold text-zinc-900">{invoiceTitle}</p>
              <p className="mt-1 text-xs text-zinc-500">Draft in Square: {order.square_invoice_id ?? "-"}</p>
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-zinc-900">{invoiceTitle}</p>
                {order.order_description ? <p className="mt-1 text-xs text-zinc-500">{order.order_description}</p> : null}
              </div>
              <p className="text-sm font-semibold text-zinc-900">{formatMoney(order.total_price)}</p>
            </div>
            <div className="space-y-2 border-t border-zinc-200 pt-4 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-zinc-500">Total</span>
                <span className="font-semibold text-zinc-900">{formatMoney(order.total_price)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-zinc-500">GST included</span>
                <span className="font-semibold text-zinc-900">{gstIncluded === null ? "-" : formatMoney(gstIncluded)}</span>
              </div>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
              Pricing is locked from the create order screen and cannot be changed here.
            </div>
            <div className="flex justify-end">
              {isAlreadySent ? (
                <Link
                  href={order.square_invoice_url ?? `/admin/orders?selected=${encodeURIComponent(order.id)}`}
                  className="rounded border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-300"
                >
                  View invoice
                </Link>
              ) : (
                <SendInvoiceButton />
              )}
            </div>
          </div>
        </aside>
      </form>
    </section>
  );
}
