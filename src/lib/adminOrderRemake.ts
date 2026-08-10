import { isAdminPremadeOrder } from "@/lib/adminPremadeOrder";
import type { OrderRow } from "@/lib/data";

export function adminOrderRemakeHref(orderId: string) {
  return `/admin/orders/new?remake=${encodeURIComponent(orderId)}`;
}

export function adminOrderRemakeFormDefaults(order: OrderRow) {
  return {
    ...order,
    due_date: null,
  };
}

export function resolveAdminOrderRemakeSource(
  orders: OrderRow[],
  value: string | string[] | undefined,
) {
  const orderId = (Array.isArray(value) ? value[0] : value)?.trim();
  if (!orderId) return null;

  const order = orders.find((candidate) => candidate.id === orderId) ?? null;
  return order && !isAdminPremadeOrder(order) ? order : null;
}
