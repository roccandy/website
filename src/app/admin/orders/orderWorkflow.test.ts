import { describe, expect, it } from "vitest";
import type { OrderRow, OrderSlot, ProductionSlot } from "@/lib/data";
import { orderWorkflow } from "./orderWorkflow";
import { orderDropPlan } from "./productionDrag";

const today = "2026-10-23";
const row = (changes: Partial<OrderRow> = {}) =>
  ({
    id: "order",
    status: "scheduled",
    total_price: 100,
    total_weight_kg: 10,
    admin_batch_weights_kg: [10],
    paid_at: "2026-10-01",
    design_type: "branded",
    made: false,
    ...changes,
  }) as OrderRow;
const slot = (id: string, date = "2026-10-26") =>
  ({ id, slot_date: date, slot_index: 1 }) as ProductionSlot;
const assignment = (id: string, slotId: string, kg = 10) =>
  ({ id, slot_id: slotId, order_id: "order", kg_assigned: kg }) as OrderSlot;

describe("Order status and useful actions", () => {
  it("explains ELEVATE's partial refund as an open review, not an unpaid debt", () => {
    const state = orderWorkflow(
      row({
        total_price: 670.5,
        refunded_amount: 660.11,
        refunded_at: "2026-07-27",
        due_date: "2026-08-10",
      }),
      [assignment("a", "old")],
      [slot("old", "2026-07-02")],
      today,
    );
    expect(state.label).toBe("Partially refunded — review");
    expect(state.paid).toBe(true);
    expect(state.totalCents - state.refundedCents).toBe(1039);
    expect(state.closed).toBe(false);
    expect(state.canComplete).toBe(false);
    expect(state.canDrag).toBe(false);
  });
  it("does not offer completion after just the first batch date has passed", () => {
    const order = row({
      total_weight_kg: 20,
      admin_batch_weights_kg: [10, 10],
    });
    expect(
      orderWorkflow(
        order,
        [assignment("a", "old")],
        [slot("old", "2026-10-20")],
        today,
      ).canComplete,
    ).toBe(false);
    expect(
      orderWorkflow(
        order,
        [assignment("a", "old"), assignment("b", "future")],
        [slot("old", "2026-10-20"), slot("future")],
        today,
      ).canComplete,
    ).toBe(false);
    expect(
      orderWorkflow(
        order,
        [assignment("a", "old"), assignment("b", "old2")],
        [slot("old", "2026-10-20"), slot("old2", "2026-10-21")],
        today,
      ).canComplete,
    ).toBe(true);
  });
  it("does not confuse a passed production date with an explicit made record", () => {
    const state = orderWorkflow(
      row(),
      [assignment("a", "old")],
      [slot("old", "2026-10-20")],
      today,
    );
    expect(state.recordedMade).toBe(false);
    expect(state.label).toBe("Production dates passed — review");
    expect(state.canComplete).toBe(true); // Manual, confirmed fulfilment action remains available.
  });
  it("requires payment and an active state for fulfilment", () => {
    for (const changes of [
      { paid_at: null },
      { status: "archived" },
      { shipped_at: "2026-10-20" },
      { status: "cancelled" },
      { status: "test" },
      { refunded_at: "2026-10-20", refunded_amount: 20 },
    ]) {
      expect(
        orderWorkflow(row({ made: true, ...changes }), [], [], today)
          .canComplete,
      ).toBe(false);
    }
    expect(
      orderWorkflow(
        row({ made: true, paid_at: null, square_invoice_status: "PAID" }),
        [],
        [],
        today,
      ).canComplete,
    ).toBe(true);
    expect(orderWorkflow(row({ made: true }), [], [], today).canComplete).toBe(
      true,
    );
  });
  it("recognises legacy full refunds without a stored amount", () => {
    expect(
      orderWorkflow(row({ refunded_at: "2026-10-20" }), [], [], today)
        .fullRefund,
    ).toBe(true);
    expect(
      orderWorkflow(row({ status: "refunded" }), [], [], today).refundedCents,
    ).toBe(10000);
  });
});

describe("Dragging orders into the production calendar", () => {
  it("allocates a new order's first batch, and only the next remaining batch for a partial order", () => {
    const order = row({
      total_weight_kg: 25,
      admin_batch_weights_kg: [10, 10, 5],
    });
    expect(orderDropPlan(order, [], [], today)).toEqual({
      kind: "assign",
      kg: 10,
    });
    expect(
      orderDropPlan(
        order,
        [assignment("a", "s"), assignment("b", "s2")],
        [slot("s"), slot("s2")],
        today,
      ),
    ).toEqual({ kind: "assign", kg: 5 });
  });
  it("moves the existing assignment for an allocated single-batch order, never creating a duplicate", () => {
    const a = assignment("existing", "s");
    expect(orderDropPlan(row(), [a], [slot("s")], today)).toEqual({
      kind: "move",
      assignment: a,
    });
  });
  it("asks which batch to move instead of moving an arbitrary batch", () => {
    const assigned = [assignment("a", "s"), assignment("b", "s2")];
    expect(
      orderDropPlan(
        row({ total_weight_kg: 20, admin_batch_weights_kg: [10, 10] }),
        assigned,
        [slot("s"), slot("s2")],
        today,
      ),
    ).toEqual({ kind: "choose", assignments: assigned });
  });
  it("never silently reschedules past, made, refunded, cancelled, or closed work", () => {
    expect(
      orderDropPlan(
        row(),
        [assignment("a", "s")],
        [slot("s", "2026-10-20")],
        today,
      ),
    ).toBe(null);
    for (const changes of [
      { made: true },
      { status: "archived" },
      { status: "cancelled" },
      { status: "test" },
      { status: "pending_payment" },
      { refunded_at: "2026-10-20", refunded_amount: 20 },
    ])
      expect(orderDropPlan(row(changes), [], [], today)).toBe(null);
  });
  it("clamps the next allocation to the remaining weight and excludes customer pre-made fulfilment", () => {
    expect(
      orderDropPlan(
        row({ total_weight_kg: 10, admin_batch_weights_kg: [5, 5] }),
        [assignment("a", "s", 9)],
        [slot("s")],
        today,
      ),
    ).toEqual({ kind: "assign", kg: 1 });
    expect(orderDropPlan(row({ design_type: "premade" }), [], [], today)).toBe(
      null,
    );
    expect(
      orderDropPlan(
        row({ design_type: "premade", title: "Premade stock - Lime" }),
        [],
        [],
        today,
      ),
    ).toEqual({ kind: "assign", kg: 10 });
  });
});
