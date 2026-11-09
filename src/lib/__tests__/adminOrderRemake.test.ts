import { describe, expect, it } from "vitest";
import type { OrderRow } from "@/lib/data";
import {
  adminOrderRemakeFormDefaults,
  adminOrderRemakeHref,
  adminOrderRemakeInvoiceTabs,
  resolveAdminOrderRemakeSource,
} from "@/lib/adminOrderRemake";

const order = (values: Partial<OrderRow> & Pick<OrderRow, "id">) =>
  ({
    category_id: "custom-rock-candy",
    design_type: "text",
    notes: null,
    title: "Test order",
    ...values,
  }) as OrderRow;

describe("admin order re-make", () => {
  it("builds an encoded link to a new admin order", () => {
    expect(adminOrderRemakeHref("order/id 123")).toBe("/admin/orders/new?remake=order%2Fid%20123");
  });

  it("resolves the requested source order without changing it", () => {
    const source = order({ id: "source-order", quantity: 100 });
    const resolved = resolveAdminOrderRemakeSource([source], "source-order");

    expect(resolved).toBe(source);
    expect(resolved?.quantity).toBe(100);
  });

  it("clears the required date in re-make defaults without changing the source order", () => {
    const source = order({ id: "source-order", due_date: "2026-08-20" });

    expect(adminOrderRemakeFormDefaults(source).due_date).toBeNull();
    expect(source.due_date).toBe("2026-08-20");
  });

  it("keeps each combined-invoice design and its own price in a separate remake tab", () => {
    const tabs = adminOrderRemakeInvoiceTabs([
      order({
        id: "design-a",
        order_number: "0141-a",
        design_text: "Design A",
        quantity: 10,
        total_price: 25,
        total_weight_kg: 1,
        due_date: "2026-08-20",
        admin_batch_weights_kg: [1],
      }),
      order({
        id: "design-b",
        order_number: "0141-b",
        design_text: "Design B",
        quantity: 20,
        total_price: 50,
        total_weight_kg: 2,
        due_date: "2026-08-20",
        admin_batch_weights_kg: [2],
      }),
    ]);

    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toMatchObject({
      id: "remake-design-a",
      fields: { design_text: "Design A", total_price: "25", due_date: "", order_weight_g: "1000" },
      batchWeights: ["1"],
    });
    expect(tabs[1]).toMatchObject({
      id: "remake-design-b",
      fields: { design_text: "Design B", total_price: "50", due_date: "", order_weight_g: "2000" },
      batchWeights: ["2"],
    });
  });

  it("does not offer the customer order form for premade stock records", () => {
    const premade = order({
      id: "premade-order",
      category_id: "__admin_premade__",
      design_type: "premade",
      notes: "[admin-premade-stock]",
      title: "Premade stock - Watermelon",
    });

    expect(resolveAdminOrderRemakeSource([premade], "premade-order")).toBeNull();
  });

  it("uses only the first query value and rejects unknown orders", () => {
    const source = order({ id: "source-order" });

    expect(resolveAdminOrderRemakeSource([source], ["source-order", "other-order"])).toBe(source);
    expect(resolveAdminOrderRemakeSource([source], "missing-order")).toBeNull();
  });
});
