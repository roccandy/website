import { describe, expect, it } from "vitest";
import type { OrderRow } from "@/lib/data";
import { adminOrderRemakeHref, resolveAdminOrderRemakeSource } from "@/lib/adminOrderRemake";

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
