import type { OrderRow, OrderSlot, ProductionSlot } from "@/lib/data";
import { orderWorkflow } from "./orderWorkflow";
export function orderRowPrimaryAction(
  order: OrderRow,
  assignments: OrderSlot[],
  slots: ProductionSlot[],
  today: string,
  canWrite: boolean,
) {
  const state = orderWorkflow(order, assignments, slots, today);
  if (state.closed) return null;
  if (state.hasRefund)
    return { label: "Review refund", href: `${state.href}#order-payment` };
  if (!state.paid && !state.internal)
    return {
      label: "Review payment",
      href: order.square_invoice_id
        ? `${state.href}/invoice`
        : `${state.href}#order-payment`,
    };
  if (state.blocked) return null;
  if (state.premade)
    return { label: "Fulfil order", href: "/admin/orders/additional-items" };
  if (state.canComplete)
    return { label: "Review fulfilment", href: state.href };
  return {
    label:
      state.canDrag && canWrite ? "Schedule production" : "Review production",
    href: state.scheduleHref,
  };
}
