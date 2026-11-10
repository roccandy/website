import { isAdminPremadeOrder } from "@/lib/adminPremadeOrder";
import type { DraftOrderTab } from "@/lib/adminOrderDrafts";
import type { OrderRow } from "@/lib/data";

export function adminOrderRemakeHref(orderId: string) {
  return `/admin/orders/new?remake=${encodeURIComponent(orderId)}`;
}

export function adminOrderRemakeFormDefaults(order: OrderRow, { combinedInvoice = false } = {}) {
  return {
    ...order,
    due_date: null,
    // Combined-invoice adjustments are stored on one row, but apply to the
    // whole invoice. The row totals already contain the allocated result.
    ...(combinedInvoice
      ? {
          admin_discount_type: "none",
          admin_discount_value: null,
          admin_price_override: null,
        }
      : {}),
  };
}

const fieldValue = (value: string | number | null | undefined) =>
  value === null || value === undefined ? "" : String(value);

/**
 * A combined invoice is stored as one order row per design. Re-create those
 * rows as the invoice form's separate tabs, rather than flattening them into
 * the first design (and its price).
 */
export function adminOrderRemakeInvoiceTabs(orders: OrderRow[]): DraftOrderTab[] {
  const combinedInvoice = orders.length > 1;
  return orders
    .filter((order) => !isAdminPremadeOrder(order))
    .map((order) => ({
      id: `remake-${order.id}`,
      fields: {
        title: fieldValue(order.title),
        order_description: fieldValue(order.order_description),
        category_id: fieldValue(order.category_id),
        packaging_option_id: fieldValue(order.packaging_option_id),
        quantity: fieldValue(order.quantity),
        labels_count: fieldValue(order.labels_count),
        labels_opt_in: Number(order.labels_count) > 0 ? "on" : "off",
        jar_lid_color: fieldValue(order.jar_lid_color),
        // A remake must be scheduled afresh.
        due_date: "",
        total_price: fieldValue(order.total_price),
        order_weight_g: fieldValue(Number(order.total_weight_kg) * 1000),
        // The final line totals are authoritative for a combined remake.
        // Invoice-wide adjustments are stored on the first source row, so
        // copying them onto a tab would apply them a second time.
        admin_discount_type: combinedInvoice ? "none" : fieldValue(order.admin_discount_type || "none"),
        admin_discount_value: combinedInvoice ? "" : fieldValue(order.admin_discount_value),
        admin_price_override: combinedInvoice ? "" : fieldValue(order.admin_price_override),
        ingredient_labels_opt_in: Number(order.ingredient_labels_count) > 0 ? "on" : "off",
        ingredient_labels_count: fieldValue(order.ingredient_labels_count),
        design_type: fieldValue(order.design_type || order.category_id),
        design_text: fieldValue(order.design_text),
        jacket: fieldValue(order.jacket),
        jacket_type: fieldValue(order.jacket_type),
        jacket_color_one: fieldValue(order.jacket_color_one),
        jacket_color_two: fieldValue(order.jacket_color_two),
        candy_fill_color: fieldValue(order.candy_fill_color),
        pinstripe_color: fieldValue(order.pinstripe_color),
        text_color: fieldValue(order.text_color),
        heart_color: fieldValue(order.heart_color),
        flavor: fieldValue(order.flavor),
        logo_url: fieldValue(order.logo_url),
        label_image_url: fieldValue(order.label_image_url),
        label_type_id: fieldValue(order.label_type_id),
        notes: fieldValue(order.notes),
        candy_design: order.candy_design ? JSON.stringify(order.candy_design) : "",
        production_slot_date: "",
      },
      batchWeights: (order.admin_batch_weights_kg ?? []).map(String),
    }));
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
