import { describe, expect, it } from "vitest";
import type { OrderRow } from "@/lib/data";
import { buildOrderActivityChanges } from "./orderActivityChanges";

const baseOrder = {
  id: "order-1",
  order_number: "0078",
  title: "Monash University",
  order_description: "Zip Bag - 12-15pc",
  customer_name: "Test Customer",
  customer_email: "test@example.com",
  category_id: "branded",
  packaging_option_id: "zip-bag",
  quantity: 230,
  jar_lid_color: null,
  labels_count: null,
  ingredient_labels_count: null,
  jacket: null,
  design_type: "branded",
  design_text: "Monash University",
  jacket_type: null,
  jacket_color_one: null,
  jacket_color_two: null,
  text_color: null,
  heart_color: null,
  flavor: "Watermelon",
  payment_method: "Square",
  logo_url: "https://example.com/logo.png",
  label_image_url: null,
  due_date: "2026-08-07",
  label_type_id: null,
  total_weight_kg: 7.82,
  total_price: 1234.5,
  status: "pending",
  notes: null,
  customer_note: null,
  made: false,
  pickup: false,
  state: "WA",
  location: null,
  first_name: "Test",
  last_name: "Customer",
  phone: "0400000000",
  organization_name: "Monash University",
  address_line1: "1 Test St",
  address_line2: null,
  suburb: "Perth",
  postcode: "6000",
  woo_order_id: null,
  woo_order_status: null,
  woo_order_key: null,
  woo_payment_url: null,
  paid_at: null,
  payment_provider: "square",
  payment_transaction_id: "txn-1",
  admin_batch_weights_kg: [7.8],
  admin_pricing_subtotal: null,
  admin_discount_type: null,
  admin_discount_value: null,
  admin_price_override: null,
  admin_price_locked_at: null,
  square_customer_id: null,
  square_order_id: null,
  square_invoice_id: null,
  square_invoice_title: null,
  square_invoice_version: null,
  square_invoice_status: null,
  square_invoice_url: null,
  square_invoice_due_date: null,
  square_invoice_created_at: null,
  square_invoice_sent_at: null,
  square_invoice_error: null,
  refunded_at: null,
  refund_reason: null,
  refunded_amount: null,
  archived_at: null,
  shipped_at: null,
  created_at: "2026-07-07T23:15:43.478251+00:00",
} as OrderRow;

describe("order activity changes", () => {
  it("records exact batch weight changes", () => {
    expect(
      buildOrderActivityChanges(baseOrder, {
        total_weight_kg: 7.82,
        admin_batch_weights_kg: [7.82],
      }),
    ).toEqual([{ field: "Batch weights", from: "7.8kg", to: "7.82kg" }]);
  });

  it("formats common order value changes for activity metadata", () => {
    expect(
      buildOrderActivityChanges(baseOrder, {
        total_price: 1300,
        pickup: true,
        due_date: "2026-08-08",
      }),
    ).toEqual([
      { field: "Total", from: "$1234.50", to: "$1300.00" },
      { field: "Due date", from: "2026-08-07", to: "2026-08-08" },
      { field: "Delivery mode", from: "Delivery", to: "Pickup" },
    ]);
  });

  it("does not store raw attachment data in activity details", () => {
    const changes = buildOrderActivityChanges(baseOrder, {
      logo_url: `data:image/png;base64,${"a".repeat(200)}`,
    });

    expect(changes).toEqual([{ field: "Logo", from: "Attached", to: "Changed" }]);
  });
});
