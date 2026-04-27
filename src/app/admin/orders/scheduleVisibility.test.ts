import { describe, expect, it } from "vitest";
import type { OrderRow } from "@/lib/data";
import {
  isAdminManagedCustomOrder,
  isAdminManagedCustomOrderUnpaid,
} from "./scheduleVisibility";

const makeOrder = (input: Partial<OrderRow>) => input as OrderRow;

describe("admin custom order payment helpers", () => {
  it("treats backend custom orders as unpaid when they have no Woo payment metadata", () => {
    const order = makeOrder({
      design_type: "custom-1-6",
      woo_order_id: null,
      woo_payment_url: null,
      payment_provider: null,
      paid_at: null,
    });

    expect(isAdminManagedCustomOrder(order)).toBe(true);
    expect(isAdminManagedCustomOrderUnpaid(order)).toBe(true);
  });

  it("does not treat frontend Woo orders as admin-managed custom orders", () => {
    const order = makeOrder({
      design_type: "custom-1-6",
      woo_order_id: "123",
      woo_payment_url: "https://example.com/pay",
      payment_provider: null,
      paid_at: null,
    });

    expect(isAdminManagedCustomOrder(order)).toBe(false);
    expect(isAdminManagedCustomOrderUnpaid(order)).toBe(false);
  });

  it("stops treating backend custom orders as unpaid once they are marked paid", () => {
    const order = makeOrder({
      design_type: "custom-1-6",
      woo_order_id: null,
      woo_payment_url: null,
      payment_provider: null,
      paid_at: "2026-04-27T08:00:00.000Z",
    });

    expect(isAdminManagedCustomOrder(order)).toBe(true);
    expect(isAdminManagedCustomOrderUnpaid(order)).toBe(false);
  });
});
