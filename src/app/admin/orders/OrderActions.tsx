import type { OrderRow, OrderSlot, ProductionSlot } from "@/lib/data";
import { AdminLink } from "../AdminNavigationFeedback";
import { adminOrderRemakeHref } from "@/lib/adminOrderRemake";
import { orderWorkflow } from "./orderWorkflow";
import {
  getPremadeSiblingMeta,
  productionCompletionActionLabel,
} from "./productionScheduleShared";
import { archiveOrderInline } from "./actions";
import SplitAwareActionForm from "./SplitAwareActionForm";

export function CloseRefundedOrderAction({ orderId }: { orderId: string }) {
  return (
    <SplitAwareActionForm
      action={archiveOrderInline}
      hiddenFields={[{ name: "order_id", value: orderId }]}
      buttonLabel="Close resolved order"
      buttonClassName="inline-flex items-center rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-emerald-600"
      confirmMessage="Only close this partially refunded order if no production or fulfilment remains. This archives the order; it does not issue another refund, charge the customer, or mark a shipment as sent."
    />
  );
}

export function OrderActions({
  order,
  orders,
  assignments,
  slots,
  today,
  canWrite,
  summary = false,
  menu = false,
  showView = true,
}: {
  order: OrderRow;
  orders: OrderRow[];
  assignments: OrderSlot[];
  slots: ProductionSlot[];
  today: string;
  canWrite: boolean;
  summary?: boolean;
  menu?: boolean;
  showView?: boolean;
}) {
  const state = orderWorkflow(order, assignments, slots, today);
  const style =
    "inline-flex items-center rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:border-emerald-600 hover:text-emerald-800";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {!summary && showView && (
          <AdminLink
            href={state.href}
            className={`${style} !border-emerald-200 !bg-emerald-50 !text-emerald-900`}
          >
            View order
          </AdminLink>
        )}
        {canWrite && (
          <AdminLink href={`${state.href}?edit=1`} className={style}>
            Edit details
          </AdminLink>
        )}
        {order.square_invoice_id && (
          <AdminLink href={`${state.href}/invoice`} className={style}>
            {state.paid
              ? "View invoice"
              : order.square_invoice_sent_at
                ? "Review payment"
                : "Review invoice"}
          </AdminLink>
        )}
        {!state.closed && state.hasRefund && (
          <AdminLink href={`${state.href}#order-payment`} className={style}>
            Review refund
          </AdminLink>
        )}
        {!state.closed &&
          !state.hasRefund &&
          !state.internal &&
          !state.paid &&
          !order.square_invoice_id && (
            <AdminLink href={`${state.href}#order-payment`} className={style}>
              Check payment
            </AdminLink>
          )}
        {!state.blocked && !state.premade && (
          <AdminLink href={state.scheduleHref} className={style}>
            {state.canDrag ? "Schedule production" : "Review production"}
          </AdminLink>
        )}
        {!state.blocked && state.premade && (
          <AdminLink href="/admin/orders/additional-items" className={style}>
            Fulfil pre-made order
          </AdminLink>
        )}
        {summary && canWrite && state.canComplete && !state.premade && (
          <SplitAwareActionForm
            action={archiveOrderInline}
            hiddenFields={[{ name: "order_id", value: order.id }]}
            buttonLabel={productionCompletionActionLabel(order)}
            buttonClassName={`${style} !border-emerald-300 !text-emerald-800`}
            confirmMessage="Confirm the goods are actually made and fulfilment is complete. A past production date alone does not confirm this."
            companionMeta={getPremadeSiblingMeta(orders, order)}
          />
        )}
        {!summary && canWrite && !state.closed && state.partialRefund && (
          <CloseRefundedOrderAction orderId={order.id} />
        )}
        {menu ? (
          <>
            {canWrite && !state.internal ? (
              <AdminLink
                href={adminOrderRemakeHref(order.id)}
                className={style}
              >
                Re-make
              </AdminLink>
            ) : null}
            <AdminLink
              href={`${state.href}/print?id=${encodeURIComponent(order.id)}`}
              target="_blank"
              rel="noreferrer"
              className={style}
            >
              Print order
            </AdminLink>
          </>
        ) : (
          <details className="group">
            <summary className={`${style} cursor-pointer list-none`}>
              More actions
            </summary>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {canWrite && !state.internal && (
                <AdminLink
                  href={adminOrderRemakeHref(order.id)}
                  className={style}
                >
                  Re-make
                </AdminLink>
              )}
              <AdminLink
                href={`${state.href}/print?id=${encodeURIComponent(order.id)}`}
                target="_blank"
                rel="noreferrer"
                className={style}
              >
                Print order
              </AdminLink>
            </div>
          </details>
        )}
      </div>
      {!summary && !menu && (
        <p className="text-[10px] leading-4 text-zinc-500">{state.label}</p>
      )}
    </div>
  );
}
