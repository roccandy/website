import type { OrderRow } from "@/lib/data";
import { isAdminPremadeOrder } from "@/lib/adminPremadeOrder";

export function orderSource(
  order: Pick<
    OrderRow,
    | "id"
    | "design_type"
    | "category_id"
    | "notes"
    | "title"
    | "square_invoice_id"
    | "payment_provider"
    | "woo_order_id"
    | "woo_payment_url"
  >,
) {
  if (isAdminPremadeOrder(order))
    return {
      key: "stock",
      label: "Internal stock",
      tone: "border-zinc-200 bg-zinc-100 text-zinc-600",
      invoiceHref: null,
    };
  if (order.square_invoice_id || order.payment_provider === "square_invoice")
    return {
      key: "invoice",
      label: "Invoice order",
      tone: "border-violet-200 bg-violet-50 text-violet-800",
      invoiceHref: order.square_invoice_id
        ? `/admin/orders/${encodeURIComponent(order.id)}/invoice`
        : null,
    };
  if (
    order.woo_order_id ||
    order.woo_payment_url ||
    ["square", "paypal", "woocommerce"].includes(order.payment_provider || "")
  )
    return {
      key: "website",
      label: "Website order",
      tone: "border-sky-200 bg-sky-50 text-sky-800",
      invoiceHref: null,
    };
  return {
    key: "manual",
    label: "Manual / legacy",
    tone: "border-amber-200 bg-amber-50 text-amber-800",
    invoiceHref: null,
  };
}
