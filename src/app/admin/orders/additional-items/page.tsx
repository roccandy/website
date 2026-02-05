import { getOrders } from "@/lib/data";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { markAdditionalItemsPending, markAdditionalItemsShipped } from "../actions";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const formatDate = (iso: string | null) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
};

const formatQuantity = (quantity: number | null | undefined) => {
  if (!Number.isFinite(quantity ?? NaN) || Number(quantity) <= 0) return "-";
  const value = Number(quantity);
  return Number.isInteger(value) ? `${value}` : `${value.toFixed(2)}`;
};

const formatMoney = (amount: number | null | undefined) => {
  if (!Number.isFinite(amount ?? NaN)) return "-";
  return `$${Number(amount).toFixed(2)}`;
};

const statusBadge = (status: string) => {
  if (status === "shipped") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "pending") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-zinc-200 bg-zinc-50 text-zinc-600";
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const resolveShippedAt = (orders: { shipped_at: string | null; created_at: string }[]) => {
  const shippedTimes = orders
    .map((order) => (order.shipped_at ? new Date(order.shipped_at).getTime() : null))
    .filter((value): value is number => value !== null && Number.isFinite(value));
  if (shippedTimes.length > 0) return new Date(Math.max(...shippedTimes));
  return null;
};

const shouldShowPremade = (order: { status: string | null; shipped_at: string | null }) => {
  if (order.status !== "shipped") return true;
  if (!order.shipped_at) return true;
  const ageMs = Date.now() - new Date(order.shipped_at).getTime();
  return ageMs <= ONE_DAY_MS;
};

const renderCountdown = (shippedAt: Date | null) => {
  if (!shippedAt) return null;
  const elapsed = Math.max(0, Date.now() - shippedAt.getTime());
  const remaining = Math.max(0, ONE_DAY_MS - elapsed);
  const progress = Math.min(1, remaining / ONE_DAY_MS);
  const percent = Math.round(progress * 100);
  const angle = Math.round(progress * 360);
  return (
    <div className="flex items-center gap-2 text-xs text-zinc-500">
      <span
        className="relative inline-flex h-6 w-6 items-center justify-center rounded-full border border-zinc-200 bg-white"
        style={{ background: `conic-gradient(#10b981 ${angle}deg, #e4e4e7 0deg)` }}
        title={`${percent}% of 24h remaining`}
      >
        <span className="h-3 w-3 rounded-full bg-white" />
      </span>
      <span className="text-[11px] uppercase tracking-[0.2em]">{percent}% left</span>
    </div>
  );
};

export default async function AdditionalItemsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/admin/login");

  const orders = await getOrders();
  const additionalItems = orders
    .filter((order) => order.design_type === "premade")
    .filter((order) => shouldShowPremade(order))
    .sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    });
  const groupedItems = new Map<
    string,
    {
      orderNumber: string | null;
      orders: typeof additionalItems;
      latestDate: string | null;
    }
  >();
  additionalItems.forEach((order) => {
    const key = order.order_number ? `order:${order.order_number}` : `id:${order.id}`;
    const group = groupedItems.get(key) ?? { orderNumber: order.order_number ?? null, orders: [], latestDate: null };
    group.orders.push(order);
    if (order.created_at && (!group.latestDate || order.created_at > group.latestDate)) {
      group.latestDate = order.created_at;
    }
    groupedItems.set(key, group);
  });
  const groupedList = Array.from(groupedItems.values()).sort((a, b) => {
    const aTime = a.latestDate ? new Date(a.latestDate).getTime() : 0;
    const bTime = b.latestDate ? new Date(b.latestDate).getTime() : 0;
    return bTime - aTime;
  });
  const summaryLabel =
    groupedList.length === additionalItems.length
      ? `${additionalItems.length} items`
      : `${groupedList.length} orders / ${additionalItems.length} items`;

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Admin / Production</p>
        <h2 className="text-3xl font-semibold">Pre-made orders</h2>
        <p className="text-sm text-zinc-600">Premade candy orders that need shipping updates.</p>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-500">{summaryLabel}</span>
        <Link
          href="/admin/orders"
          className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
        >
          Back to schedule
        </Link>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 text-[11px] uppercase tracking-[0.2em] text-zinc-500">
            <tr>
              <th className="px-3 py-3 text-left">Order #</th>
              <th className="px-3 py-3 text-left">Premade item</th>
              <th className="px-3 py-3 text-left">Qty</th>
              <th className="px-3 py-3 text-left">Customer</th>
              <th className="px-3 py-3 text-left">Quote order</th>
              <th className="px-3 py-3 text-left">Ordered</th>
              <th className="px-3 py-3 text-left">Total</th>
              <th className="px-3 py-3 text-left">Status</th>
              <th className="px-3 py-3 text-left">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {groupedList.map((group) => {
              const groupOrders = group.orders;
              const firstOrder = groupOrders[0];
              const orderNumber = group.orderNumber
                ? `#${group.orderNumber}`
                : firstOrder?.id
                  ? `#${firstOrder.id.slice(0, 8)}`
                  : "-";
              const customerName =
                groupOrders
                  .map((order) => order.customer_name ?? [order.first_name, order.last_name].filter(Boolean).join(" "))
                  .find((name) => name && name.trim()) ?? "";
              const customer = customerName || "-";
              const statuses = groupOrders.map((order) => (order.status ?? "pending").toString());
              const isShipped = statuses.length > 0 && statuses.every((status) => status === "shipped");
              const status = isShipped
                ? "shipped"
                : statuses.includes("pending")
                  ? "pending"
                  : statuses[0] ?? "pending";
              const statusLabel = status.replace(/_/g, " ");
              const quoteOrders = groupOrders.map((order) => order.notes?.trim()).filter(Boolean);
              const quoteOrder = quoteOrders.length > 0 ? Array.from(new Set(quoteOrders)).join(" | ") : "-";
              const orderIds = groupOrders.map((order) => order.id).filter(Boolean).join(",");
              const quantityTotal = groupOrders.reduce((sum, order) => sum + Number(order.quantity || 0), 0);
              const totalQuantityLabel = quantityTotal > 0 ? formatQuantity(quantityTotal) : "-";
              const totals = groupOrders
                .map((order) => Number(order.total_price))
                .filter((value) => Number.isFinite(value));
              const totalPriceLabel =
                totals.length > 0 ? formatMoney(totals.reduce((sum, value) => sum + value, 0)) : "-";
              const orderedDate = group.latestDate ? formatDate(group.latestDate) : "";
              const shippedAt = isShipped ? resolveShippedAt(groupOrders) : null;

              return (
                <tr key={`${orderNumber}-${orderIds}`} className="bg-white">
                  <td className="px-3 py-2 font-semibold text-zinc-900">{orderNumber}</td>
                  <td className="px-3 py-2 text-zinc-800">
                    <div className="space-y-2">
                      {groupOrders.map((order) => {
                        const title = order.title?.trim() || order.order_description?.trim() || "Additional item";
                        const description = order.title?.trim() ? order.order_description?.trim() : "";
                        const qty = formatQuantity(order.quantity);
                        const qtyLabel = qty !== "-" ? `x ${qty}` : "";
                        return (
                          <div key={order.id} className="space-y-1">
                            <p className="font-semibold text-zinc-900">
                              {title}
                              {qtyLabel ? <span className="ml-2 text-xs font-semibold text-zinc-500">{qtyLabel}</span> : null}
                            </p>
                            {description ? <p className="text-xs text-zinc-500">{description}</p> : null}
                          </div>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-zinc-700">{totalQuantityLabel}</td>
                  <td className="px-3 py-2 text-zinc-700">{customer}</td>
                  <td className="px-3 py-2 text-zinc-700">{quoteOrder}</td>
                  <td className="px-3 py-2 text-zinc-700">{orderedDate}</td>
                  <td className="px-3 py-2 text-zinc-700">{totalPriceLabel}</td>
                  <td className="px-3 py-2 text-zinc-700">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusBadge(status)}`}>
                      {statusLabel}
                    </span>
                    {isShipped ? <div className="mt-2">{renderCountdown(shippedAt)}</div> : null}
                  </td>
                  <td className="px-3 py-2 text-zinc-700">
                    {isShipped ? (
                      <form action={markAdditionalItemsPending}>
                        <input type="hidden" name="order_ids" value={orderIds} />
                        <button
                          type="submit"
                          className="rounded border border-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-600 hover:border-zinc-300 hover:text-zinc-800"
                        >
                          Shipped
                        </button>
                      </form>
                    ) : (
                      <form action={markAdditionalItemsShipped}>
                        <input type="hidden" name="order_ids" value={orderIds} />
                        <button
                          type="submit"
                          className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
                        >
                          Mark shipped
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
            {groupedList.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-sm text-zinc-500">
                  No additional items yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
