import type { OrderRow } from "@/lib/data";
import { batchWeightsForOrder } from "./productionScheduleShared";
import { orderSource } from "./orderSource";
export function requiredDateUrgency(required: string | null, today: string) {
  const date = required?.slice(0, 10);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const days = Math.round(
    (Date.parse(`${date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) /
      86400000,
  );
  if (!Number.isFinite(days)) return null;
  return {
    days,
    label:
      days < 0
        ? `${-days} day${days === -1 ? "" : "s"} ago`
        : days === 0
          ? "Today"
          : `In ${days} day${days === 1 ? "" : "s"}`,
    tone:
      days < 0
        ? "text-red-600"
        : days < 7
          ? "text-orange-600"
          : "text-zinc-400",
  };
}
export function compactKg(
  order: Pick<OrderRow, "admin_batch_weights_kg" | "total_weight_kg">,
) {
  const weights = batchWeightsForOrder(order);
  const format = (weight: number) => String(Math.round(weight * 100) / 100);
  if (!weights.length) return "—";
  const groups: { weight: number; count: number }[] = [];
  for (const weight of weights) {
    const group = groups.find(
      (group) => Math.abs(group.weight - weight) < 0.005,
    );
    if (group) group.count++;
    else groups.push({ weight, count: 1 });
  }
  return groups
    .map((group) =>
      group.count > 1
        ? `${group.count} × ${format(group.weight)}`
        : format(group.weight),
    )
    .join(" + ");
}
export function productionPaymentStrip(
  order: Parameters<typeof orderSource>[0] &
    Pick<
      OrderRow,
      "paid_at" | "square_invoice_status" | "square_invoice_sent_at"
    >,
) {
  const source = orderSource(order);
  const paid = Boolean(
    order.paid_at || order.square_invoice_status?.toUpperCase() === "PAID",
  );
  const label =
    source.key === "website"
      ? "Website order"
      : source.key === "stock"
        ? "Internal stock"
        : `${source.key === "invoice" ? "Invoice order" : "Manual order"} · ${paid ? "paid" : !order.square_invoice_sent_at && order.square_invoice_status === "DRAFT" ? "draft, not sent" : "payment not recorded"}`;
  return {
    ...source,
    label,
    colour:
      source.key === "website"
        ? "bg-blue-500"
        : source.key === "stock"
          ? "bg-zinc-300"
          : paid
            ? "bg-emerald-500"
            : "bg-red-500",
    href: source.invoiceHref || `/admin/orders/${encodeURIComponent(order.id)}`,
  };
}
