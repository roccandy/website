import { describe, expect, it } from "vitest";
import type { OrderRow } from "@/lib/data";
import { orderRowPrimaryAction } from "./orderRowPrimaryAction";
const row = (values: Partial<OrderRow> = {}) =>
  ({
    id: "order",
    design_type: "branded",
    status: "unassigned",
    total_price: 110,
    total_weight_kg: 8,
    ...values,
  }) as OrderRow;
const action = (values: Partial<OrderRow>, canWrite = true) =>
  orderRowPrimaryAction(row(values), [], [], "2026-10-24", canWrite);
describe("Compact order next action", () => {
  it("prioritises payment over scheduling when payment is unconfirmed", () =>
    expect(action({ square_invoice_id: "invoice" })).toEqual({
      label: "Review payment",
      href: "/admin/orders/order/invoice",
    }));
  it("offers scheduling for paid unscheduled orders", () =>
    expect(action({ paid_at: "2026-10-01" })?.label).toBe(
      "Schedule production",
    ));
  it("does not label read-only access as an editing action", () =>
    expect(action({ paid_at: "2026-10-01" }, false)?.label).toBe(
      "Review production",
    ));
  it("keeps partial refunds as review rather than fulfilment or new debt", () =>
    expect(
      action({
        paid_at: "2026-10-01",
        refunded_at: "2026-10-10",
        refunded_amount: 100,
      }),
    ).toEqual({
      label: "Review refund",
      href: "/admin/orders/order#order-payment",
    }));
  it("does not suggest a new task for closed orders", () =>
    expect(action({ status: "archived", paid_at: "2026-10-01" })).toBeNull());
  it("links to review instead of completing an order from the row", () =>
    expect(action({ made: true, paid_at: "2026-10-01" })).toEqual({
      label: "Review fulfilment",
      href: "/admin/orders/order",
    }));
  it("routes pre-made fulfilment to the existing guarded flow", () =>
    expect(
      action({ design_type: "premade", paid_at: "2026-10-01" })?.label,
    ).toBe("Fulfil order"));
});
