import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrders, type OrderRow } from "@/lib/data";
import { formatDate, formatMoney } from "../productionScheduleShared";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const sortInvoiceOrders = (orders: OrderRow[]) =>
  [...orders].sort((a, b) => {
    const aDate = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY;
    const bDate = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY;
    if (aDate !== bDate) return aDate - bDate;
    return (a.order_number ?? a.created_at ?? a.id).localeCompare(b.order_number ?? b.created_at ?? b.id);
  });

const invoiceStatusLabel = (orders: OrderRow[]) => {
  if (orders.every((order) => Boolean(order.paid_at)) || orders.some((order) => order.square_invoice_status === "PAID")) {
    return "Paid";
  }
  if (orders.some((order) => order.square_invoice_status === "UNPAID")) return "Unpaid";
  if (orders.some((order) => order.square_invoice_sent_at)) return "Sent";
  return "Not sent";
};

const statusClass = (label: string) => {
  if (label === "Paid") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (label === "Unpaid" || label === "Sent") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
};

export default async function AdminInvoicesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/admin/login");

  const orders = await getOrders();
  const groups = new Map<string, OrderRow[]>();
  orders.forEach((order) => {
    if (!order.square_invoice_id) return;
    const list = groups.get(order.square_invoice_id) ?? [];
    list.push(order);
    groups.set(order.square_invoice_id, list);
  });

  const invoices = Array.from(groups.entries())
    .map(([invoiceId, invoiceOrders]) => {
      const sortedOrders = sortInvoiceOrders(invoiceOrders);
      const primaryOrder = sortedOrders[0];
      const total = sortedOrders.reduce((sum, order) => {
        const amount = Number(order.total_price);
        return sum + (Number.isFinite(amount) ? amount : 0);
      }, 0);
      const sentAt = sortedOrders.map((order) => order.square_invoice_sent_at).find(Boolean) ?? null;
      const createdAt = sortedOrders.map((order) => order.square_invoice_created_at).find(Boolean) ?? primaryOrder?.created_at ?? null;
      return {
        invoiceId,
        orders: sortedOrders,
        primaryOrder,
        total,
        sentAt,
        createdAt,
        status: invoiceStatusLabel(sortedOrders),
      };
    })
    .filter((invoice) => invoice.primaryOrder)
    .sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Admin / Operations</p>
          <h2 className="admin-page-title">Invoices</h2>
          <p className="text-sm text-zinc-600">Square invoices created from admin orders.</p>
        </div>
        <Link
          href="/admin/orders"
          className="rounded border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
        >
          Back to schedule
        </Link>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 text-[11px] uppercase tracking-[0.2em] text-zinc-500">
            <tr>
              <th className="px-3 py-3 text-left">Invoice</th>
              <th className="px-3 py-3 text-left">Customer</th>
              <th className="px-3 py-3 text-left">Orders</th>
              <th className="px-3 py-3 text-left">Total</th>
              <th className="px-3 py-3 text-left">Status</th>
              <th className="px-3 py-3 text-left">Sent</th>
              <th className="px-3 py-3 text-left">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {invoices.map((invoice) => (
              <tr key={invoice.invoiceId} className="bg-white">
                <td className="px-3 py-3 font-semibold text-zinc-900">
                  <span className="block">{invoice.primaryOrder?.square_invoice_title || invoice.invoiceId}</span>
                  <span className="mt-1 block text-xs font-medium text-zinc-500">{invoice.invoiceId}</span>
                </td>
                <td className="px-3 py-3 text-zinc-700">
                  {invoice.primaryOrder?.customer_name || invoice.primaryOrder?.customer_email || "-"}
                </td>
                <td className="px-3 py-3 text-zinc-700">
                  {invoice.orders
                    .map((order) => (order.order_number ? `#${order.order_number}` : order.id.slice(0, 8)))
                    .join(", ")}
                </td>
                <td className="px-3 py-3 font-semibold text-zinc-900">{formatMoney(invoice.total)}</td>
                <td className="px-3 py-3">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClass(invoice.status)}`}>
                    {invoice.status}
                  </span>
                </td>
                <td className="px-3 py-3 text-zinc-700">{formatDate(invoice.sentAt)}</td>
                <td className="px-3 py-3">
                  {invoice.primaryOrder ? (
                    <Link
                      href={`/admin/orders/${invoice.primaryOrder.id}/invoice`}
                      className="rounded border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                    >
                      View
                    </Link>
                  ) : null}
                </td>
              </tr>
            ))}
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-zinc-500">
                  No Square invoices yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
