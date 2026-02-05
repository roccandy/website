import { getOrders, getOrderSlots, getProductionSlots } from "@/lib/data";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { refundOrder, unarchiveOrder } from "../actions";
import { RefundForm } from "../RefundForm";

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

const resolvePremadeStatus = (status: string | null | undefined) => (status === "shipped" ? "shipped" : "pending");
const formatStatusLabel = (status: string) => status.replace(/_/g, " ");
const getOrderSuffix = (orderNumber: string | null | undefined) => {
  const match = orderNumber?.match(/-(a|b)$/i);
  return match ? match[1].toLowerCase() : null;
};

const scheduleStatusBadge = (status: string) => {
  if (status === "archived") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "pending completion") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "scheduled") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-red-200 bg-red-50 text-red-700";
};

const premadeStatusBadge = (status: string) => {
  if (status === "shipped") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "pending") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-zinc-200 bg-zinc-50 text-zinc-600";
};

const resolveScheduleGroupStatus = (statuses: string[]) => {
  if (statuses.length === 0) return "pending";
  if (statuses.every((status) => status === "archived")) return "archived";
  if (statuses.includes("unassigned")) return "unassigned";
  if (statuses.includes("pending completion")) return "pending completion";
  if (statuses.includes("scheduled")) return "scheduled";
  return statuses[0] ?? "pending";
};

const normalizeOrderNumber = (value: string | null | undefined) => {
  if (!value) return null;
  return value.replace(/-(a|b)$/i, "");
};

const weightLabel = (kg: number | null | undefined) => {
  if (!kg || Number.isNaN(kg)) return "";
  return `${(Number(kg) * 1000).toFixed(0)} g`;
};

export default async function AllOrdersPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/admin/login");

  const [orders, slots, assignments] = await Promise.all([getOrders(), getProductionSlots(), getOrderSlots()]);
  const slotMap = new Map(slots.map((slot) => [slot.id, slot]));
  const assignmentByOrderId = new Map<string, (typeof assignments)[number]>();
  assignments.forEach((assignment) => {
    if (assignmentByOrderId.has(assignment.order_id)) return;
    assignmentByOrderId.set(assignment.order_id, assignment);
  });
  const todayKey = (() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = `${now.getMonth() + 1}`.padStart(2, "0");
    const day = `${now.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  })();
  const scheduleStatusById = new Map<string, string>();
  orders.forEach((order) => {
    if (order.status === "archived") {
      scheduleStatusById.set(order.id, "archived");
      return;
    }
    const assignment = assignmentByOrderId.get(order.id);
    if (!assignment) {
      scheduleStatusById.set(order.id, "unassigned");
      return;
    }
    const slotDate = slotMap.get(assignment.slot_id)?.slot_date;
    if (slotDate && slotDate < todayKey) {
      scheduleStatusById.set(order.id, "pending completion");
      return;
    }
    scheduleStatusById.set(order.id, "scheduled");
  });
  const allOrders = [...orders].sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bTime - aTime;
  });
  const groupedOrders = new Map<
    string,
    {
      baseOrderNumber: string | null;
      orders: typeof allOrders;
      latestDate: string | null;
    }
  >();
  allOrders.forEach((order) => {
    const baseNumber = normalizeOrderNumber(order.order_number);
    const key = baseNumber ? `order:${baseNumber}` : `id:${order.id}`;
    const group = groupedOrders.get(key) ?? { baseOrderNumber: baseNumber, orders: [], latestDate: null };
    group.orders.push(order);
    if (order.created_at && (!group.latestDate || order.created_at > group.latestDate)) {
      group.latestDate = order.created_at;
    }
    groupedOrders.set(key, group);
  });
  const groupedList = Array.from(groupedOrders.values()).sort((a, b) => {
    const aTime = a.latestDate ? new Date(a.latestDate).getTime() : 0;
    const bTime = b.latestDate ? new Date(b.latestDate).getTime() : 0;
    return bTime - aTime;
  });

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Admin / Production</p>
        <h2 className="text-3xl font-semibold">All Orders / Refunds</h2>
        <p className="text-sm text-zinc-600">Every order across custom and premade entries.</p>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-500">{groupedList.length} orders</span>
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
              <th className="px-3 py-3 text-left">Title</th>
              <th className="px-3 py-3 text-left">Date required</th>
              <th className="px-3 py-3 text-left">Order weight</th>
              <th className="px-3 py-3 text-left">Customer</th>
              <th className="px-3 py-3 text-left">Status</th>
              <th className="px-3 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {groupedList.flatMap((group, groupIndex) => {
              const groupOrders = group.orders;
              const firstOrder = groupOrders[0];
              const orderNumber = group.baseOrderNumber
                ? `#${group.baseOrderNumber}`
                : firstOrder?.id
                  ? `#${firstOrder.id.slice(0, 8)}`
                  : "";
              const customers = groupOrders
                .map((order) => order.customer_name ?? [order.first_name, order.last_name].filter(Boolean).join(" "))
                .filter((name) => name && name.trim());
              const uniqueCustomers = Array.from(new Set(customers));
              const customer = uniqueCustomers.length <= 1 ? uniqueCustomers[0] ?? "" : "Multiple";
              const dueDates = groupOrders.map((order) => order.due_date).filter(Boolean);
              const uniqueDueDates = Array.from(new Set(dueDates));
              const dueDate = uniqueDueDates.length <= 1 ? formatDate(uniqueDueDates[0] ?? null) : "Multiple";
              const totalWeight = groupOrders.reduce((sum, order) => sum + Number(order.total_weight_kg || 0), 0);
              const weight = totalWeight > 0 ? weightLabel(totalWeight) : "";
              const subgroupMap = new Map<string, { suffix: string | null; orders: typeof groupOrders }>();
              groupOrders.forEach((order) => {
                const suffix = getOrderSuffix(order.order_number);
                const key = suffix ?? "main";
                const subgroup = subgroupMap.get(key) ?? { suffix, orders: [] };
                subgroup.orders.push(order);
                subgroupMap.set(key, subgroup);
              });
              const subgroupList = Array.from(subgroupMap.values()).sort((a, b) => {
                const rank = (suffix: string | null) => (suffix === "a" ? 0 : suffix === "b" ? 1 : 2);
                return rank(a.suffix) - rank(b.suffix);
              });
                const subgroupSummaries = subgroupList.map((subgroup) => {
                  const isPremadeGroup = subgroup.orders.every((order) => order.design_type === "premade");
                  const statusList = subgroup.orders.map((order) =>
                    isPremadeGroup
                      ? resolvePremadeStatus(order.status)
                    : scheduleStatusById.get(order.id) ?? order.status ?? "pending"
                );
                const status = isPremadeGroup
                  ? statusList.every((value) => value === "shipped")
                    ? "shipped"
                    : "pending"
                  : resolveScheduleGroupStatus(statusList);
                const label = subgroup.suffix ? `-${subgroup.suffix}` : "order";
                  return {
                    ...subgroup,
                    isPremadeGroup,
                    status,
                    statusLabel: formatStatusLabel(status),
                    hasRefunded: subgroup.orders.some((order) => Boolean(order.refunded_at)),
                    label,
                  };
                });
              return subgroupSummaries.map((subgroup, subgroupIndex) => {
                const rowBorderClass =
                  groupIndex > 0 && subgroupIndex === 0
                    ? "border-t-2 border-zinc-200"
                    : subgroupIndex > 0
                      ? "border-t border-zinc-100"
                      : "";
                const showGroupCells = subgroupIndex === 0;
                const rowKey = `${orderNumber || firstOrder?.id || groupIndex}-${subgroup.label}`;
                const badge = subgroup.hasRefunded
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : subgroup.isPremadeGroup
                    ? premadeStatusBadge(subgroup.status)
                    : scheduleStatusBadge(subgroup.status);
                return (
                  <tr key={rowKey} className="bg-white">
                    <td className={`px-3 py-2 font-semibold text-zinc-900 ${rowBorderClass}`}>
                      {showGroupCells ? orderNumber : ""}
                    </td>
                    <td className={`px-3 py-2 text-zinc-800 ${rowBorderClass}`}>
                      <div className="space-y-2">
                        {subgroup.orders.map((order) => {
                          const title = order.title ?? "Untitled";
                          const lineNumber = order.order_number
                            ? `#${order.order_number}`
                            : order.id
                              ? `#${order.id.slice(0, 8)}`
                              : "";
                          return (
                            <div key={order.id} className="space-y-1">
                              <p className="font-semibold text-zinc-900">{title}</p>
                              <p className="text-xs text-zinc-500">{lineNumber}</p>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td className={`px-3 py-2 text-zinc-700 ${rowBorderClass}`}>{showGroupCells ? dueDate : ""}</td>
                    <td className={`px-3 py-2 text-zinc-700 ${rowBorderClass}`}>{showGroupCells ? weight : ""}</td>
                    <td className={`px-3 py-2 text-zinc-700 ${rowBorderClass}`}>{showGroupCells ? customer : ""}</td>
                    <td className={`px-3 py-2 text-zinc-700 ${rowBorderClass}`}>
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge}`}>
                        {subgroup.hasRefunded ? "Refunded" : subgroup.statusLabel}
                      </span>
                    </td>
                    <td className={`px-3 py-2 text-zinc-700 ${rowBorderClass}`}>
                      {showGroupCells ? (
                        <div className="space-y-2">
                          {groupOrders
                            .filter((order) => order.status === "archived")
                            .map((order) => (
                              <form key={`unarchive-${order.id}`} action={unarchiveOrder}>
                                <input type="hidden" name="order_id" value={order.id} />
                                <button
                                  type="submit"
                                  className="rounded border border-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                                >
                                  Unarchive {order.order_number ? `#${order.order_number}` : ""}
                                </button>
                              </form>
                            ))}
                          {groupOrders
                            .filter((order) => order.paid_at && order.payment_transaction_id && !order.refunded_at)
                            .map((order) => (
                              <RefundForm
                                key={`refund-${order.id}`}
                                orderId={order.id}
                                orderNumber={order.order_number}
                                action={refundOrder}
                                redirectTo="/admin/orders/archived"
                              />
                            ))}
                          {groupOrders.every(
                            (order) =>
                              order.status !== "archived" &&
                              !(order.paid_at && order.payment_transaction_id && !order.refunded_at)
                          ) ? (
                            <span className="text-xs text-zinc-400">-</span>
                          ) : null}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              });
            })}
            {groupedList.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-sm text-zinc-500">
                  No orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
