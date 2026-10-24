import type { OrderRow } from "@/lib/data";
import { productionPaymentStrip } from "./productionRowPresentation";

/** Only a real shared invoice can join strips; matching colours alone cannot. */
function invoicePaymentKey(order: OrderRow): string | null {
  if (!order.square_invoice_id) return null;
  const strip = productionPaymentStrip(order);
  if (strip.key !== "invoice") return null;
  const refunded = Math.round(Number(order.refunded_amount ?? 0) * 100);
  const total = Math.round(Number(order.total_price ?? 0) * 100);
  const refundState = order.status === "partially-refunded" || (refunded > 0 && refunded < total)
    ? "partial"
    : order.refunded_at || refunded > 0 || order.status === "refunded" ? "refunded" : "none";
  return JSON.stringify([order.square_invoice_id, strip.colour, strip.label, refundState]);
}

export function consecutivePaymentGroups(orders: OrderRow[]): OrderRow[][] {
  const groups: OrderRow[][] = [];
  for (const order of orders) {
    const previous = groups.at(-1);
    const key = invoicePaymentKey(order);
    if (key && previous && invoicePaymentKey(previous[0]) === key) previous.push(order);
    else groups.push([order]);
  }
  return groups;
}

/** Match the final visible/sorted rows, never hidden orders or non-adjacent rows. */
export function paymentStripRowSpans(rows: OrderRow[][]): Array<{ rowSpan: number; orders: OrderRow[] } | null> {
  const spans: Array<{ rowSpan: number; orders: OrderRow[] } | null> = [];
  let previousKey: string | null = null;
  let start = 0;
  rows.forEach((orders, index) => {
    const key = orders.length ? invoicePaymentKey(orders[0]) : null;
    const uniformKey = key && orders.every((order) => invoicePaymentKey(order) === key) ? key : null;
    if (uniformKey && uniformKey === previousKey) {
      const span = spans[start]!;
      span.rowSpan++;
      span.orders.push(...orders);
      spans.push(null);
    } else {
      start = index;
      spans.push({ rowSpan: 1, orders: [...orders] });
    }
    previousKey = uniformKey;
  });
  return spans;
}
