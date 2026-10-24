import type { OrderRow } from "@/lib/data";
import { AdminLink } from "../AdminNavigationFeedback";
import { productionPaymentStrip } from "./productionRowPresentation";

/** Grouped rows retain each item's own payment/source state and invoice link. */
export function OrderPaymentStrips({ orders }: { orders: OrderRow[] }) {
  return (
    <div className="absolute inset-0 flex flex-col gap-px" data-order-payment-strips>
      {orders.map((order) => {
        const strip = productionPaymentStrip(order);
        const label = `${order.order_number ? `#${order.order_number}` : order.title || "Order"} · ${strip.label}`;
        return <AdminLink key={order.id} href={strip.href} aria-label={label} title={label} className={`block min-h-0 flex-1 ${strip.colour} hover:brightness-90 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-zinc-900`} />;
      })}
    </div>
  );
}
