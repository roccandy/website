import { describe, expect, it } from "vitest";
import type { OrderRow } from "@/lib/data";
import {
  isAdminManagedCustomOrder,
  isAdminManagedCustomOrderUnpaid,
} from "./scheduleVisibility";
import {
  formatBatchBreakdown,
  formatScheduleStatusLabel,
  getMultiAssignmentScheduleStatus,
  productionCompletionActionLabel,
  statusBadge,
} from "./productionScheduleShared";

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
      status: "pending_payment",
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

  it("treats Square invoice admin orders as unpaid until the invoice is paid", () => {
    const order = makeOrder({
      design_type: "custom-1-6",
      woo_order_id: "123",
      woo_payment_url: null,
      payment_provider: "square_invoice",
      square_invoice_id: "inv:123",
      paid_at: null,
      status: "pending",
    });

    expect(isAdminManagedCustomOrder(order)).toBe(true);
    expect(isAdminManagedCustomOrderUnpaid(order)).toBe(true);
  });
});

describe("production completion labels", () => {
  it("shows completed delivery orders as shipped", () => {
    expect(productionCompletionActionLabel(makeOrder({ status: "archived", pickup: false }))).toBe("Shipped");
    expect(productionCompletionActionLabel(makeOrder({ status: "shipped", pickup: false }))).toBe("Shipped");
  });

  it("shows completed pickup orders as collected", () => {
    expect(productionCompletionActionLabel(makeOrder({ status: "archived", pickup: true }))).toBe("Collected");
    expect(productionCompletionActionLabel(makeOrder({ status: "shipped", pickup: true }))).toBe("Collected");
  });
});

describe("multi-batch schedule status labels", () => {
  it("labels fully past assigned batches as made", () => {
    const order = makeOrder({
      status: "scheduled",
      total_weight_kg: 16,
      admin_batch_weights_kg: [8, 8],
    });

    expect(getMultiAssignmentScheduleStatus(order, ["2026-06-01", "2026-06-02"], "2026-06-15")).toBe("made");
    expect(formatScheduleStatusLabel("pending completion")).toBe("made");
  });

  it("labels partly past split batches as partially made", () => {
    const order = makeOrder({
      status: "scheduled",
      total_weight_kg: 16,
      admin_batch_weights_kg: [8, 8],
    });

    expect(getMultiAssignmentScheduleStatus(order, ["2026-06-01", "2026-06-20"], "2026-06-15")).toBe("partially made");
  });

  it("labels partly assigned split batches as partially scheduled", () => {
    const order = makeOrder({
      status: "scheduled",
      total_weight_kg: 24,
      admin_batch_weights_kg: [8, 8, 8],
    });

    expect(getMultiAssignmentScheduleStatus(order, ["2026-06-20"], "2026-06-15")).toBe("partially scheduled");
  });

  it("keeps test orders labelled as Test with black badge styling", () => {
    const order = makeOrder({
      status: "test",
      total_weight_kg: 1,
    });

    expect(getMultiAssignmentScheduleStatus(order, [], "2026-06-15")).toBe("test");
    expect(formatScheduleStatusLabel("test")).toBe("Test");
    expect(statusBadge("test")).toContain("bg-zinc-950");
  });
});

describe("batch breakdown labels", () => {
  it("groups matching batch weights", () => {
    const order = makeOrder({
      total_weight_kg: 30,
      admin_batch_weights_kg: [7.5, 7.5, 7.5, 7.5],
    });

    expect(formatBatchBreakdown(order)).toBe("4 x 7.5kg");
  });

  it("keeps custom split groups in order", () => {
    const order = makeOrder({
      total_weight_kg: 30,
      admin_batch_weights_kg: [8, 8, 8, 6],
    });

    expect(formatBatchBreakdown(order)).toBe("3 x 8kg + 1 x 6kg");
  });
});
