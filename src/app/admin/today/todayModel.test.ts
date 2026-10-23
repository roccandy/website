import { describe, expect, it } from "vitest";
import { buildTodayHub, isOpenTodayOrder, type TodayOrder } from "./todayModel";

const now = "2026-10-23T04:00:00Z";
const row = (changes: Partial<TodayOrder> = {}): TodayOrder => ({
  id: "row-1",
  order_number: "0042",
  title: "Customer candy",
  customer_name: "Customer",
  first_name: null,
  last_name: null,
  created_at: "2026-10-01T00:00:00Z",
  due_date: "2026-11-10",
  design_type: "branded",
  category_id: "branded",
  notes: null,
  total_price: 100,
  total_weight_kg: 10,
  admin_batch_weights_kg: [10],
  made: false,
  pickup: false,
  status: "pending",
  paid_at: now,
  payment_provider: "square",
  payment_method: null,
  woo_order_id: null,
  woo_payment_url: null,
  square_invoice_id: null,
  square_invoice_status: null,
  square_invoice_sent_at: null,
  square_invoice_due_date: null,
  square_invoice_error: null,
  refunded_at: null,
  refunded_amount: null,
  archived_at: null,
  shipped_at: null,
  ...changes,
});
const hub = (rows: TodayOrder[]) => buildTodayHub(rows, [], [], [], now);
const labels = (data: ReturnType<typeof hub>) =>
  data.items.flatMap((item) => item.issues.map((issue) => issue.label));

describe("Today work queue", () => {
  it("excludes closed, cancelled, fully refunded and unconfirmed public checkouts", () => {
    for (const changes of [
      { status: "cancelled" },
      { shipped_at: now },
      { archived_at: now },
      { refunded_at: now, refunded_amount: 100 },
      { status: "pending_payment", paid_at: null },
    ]) {
      expect(isOpenTodayOrder(row(changes))).toBe(false);
    }
    expect(
      isOpenTodayOrder(
        row({
          status: "pending_payment",
          square_invoice_id: "invoice",
          paid_at: null,
        }),
      ),
    ).toBe(true);
  });

  it("keeps partial refunds actionable without linking into the schedule that hides them", () => {
    const data = hub([
      row({
        refunded_at: now,
        refunded_amount: 20,
        status: "partially-refunded",
      }),
    ]);
    expect(data.counts.active).toBe(1);
    expect(data.items[0].issues[0].href).toBe("/admin/orders/row-1");
  });

  it("groups split checkout items and counts the entire queue, not just six cards", () => {
    const data = hub([
      row({ order_number: "0042-a" }),
      row({ id: "second", order_number: "0042-b" }),
      ...Array.from({ length: 12 }, (_, i) =>
        row({ id: `extra-${i}`, order_number: String(100 + i) }),
      ),
    ]);
    expect(data.counts.attention).toBe(13);
    expect(data.counts.schedule).toBe(13);
    expect(data.items.find((item) => item.number === "0042")?.lines).toBe(2);
    expect(
      data.items.find((item) => item.number === "0042")?.issues[0].detail,
    ).toContain("2 order items");
  });

  it("uses invoice due dates, not customer required dates, for overdue payments", () => {
    const unpaid = row({
      paid_at: null,
      due_date: "2026-10-01",
      square_invoice_id: "invoice",
      square_invoice_status: "UNPAID",
      square_invoice_due_date: "2026-11-01",
    });
    expect(labels(hub([unpaid]))).not.toContain("Invoice overdue");
    const sentDraft = {
      ...unpaid,
      due_date: "2026-11-01",
      square_invoice_status: "DRAFT",
      square_invoice_sent_at: now,
      square_invoice_due_date: "2026-10-22",
    };
    expect(labels(hub([sentDraft]))).toContain("Invoice overdue");
    expect(labels(hub([sentDraft]))).not.toContain("Invoice not sent");
  });

  it("does not chase paid invoices or a payment already recorded", () => {
    for (const changes of [
      { paid_at: null, square_invoice_status: "PAID" },
      { paid_at: now, square_invoice_status: "UNPAID" },
    ]) {
      expect(
        hub([
          row({
            square_invoice_id: "invoice",
            square_invoice_due_date: "2026-10-01",
            ...changes,
          }),
        ]).counts.payments,
      ).toBe(0);
    }
  });

  it("deduplicates shared invoices and distinguishes cancelled invoices from drafts", () => {
    const unpaid = row({
      paid_at: null,
      square_invoice_id: "shared",
      square_invoice_status: "DRAFT",
    });
    expect(
      hub([unpaid, { ...unpaid, id: "other", order_number: "0099" }]).counts
        .payments,
    ).toBe(1);
    expect(
      labels(hub([{ ...unpaid, square_invoice_status: "CANCELED" }])),
    ).toContain("Invoice needs review");
    expect(labels(hub([unpaid]))).toContain("Invoice not sent");
  });

  it("flags partially scheduled multi-batch orders without losing the remaining weight", () => {
    const data = buildTodayHub(
      [
        row({
          total_weight_kg: 20,
          admin_batch_weights_kg: [10, 10],
          due_date: "2026-10-25",
        }),
      ],
      [{ id: "slot", slot_date: "2026-10-24", slot_index: 1 }],
      [
        {
          id: "assignment",
          order_id: "row-1",
          slot_id: "slot",
          kg_assigned: 10,
        },
      ],
      [],
      now,
    );
    expect(data.counts.urgent).toBe(1);
    expect(data.items[0].issues[0].label).toBe("Finish scheduling");
    expect(data.items[0].issues[0].detail).toContain("10.0 kg remaining");
    expect(data.items[0].issues[0].detail).toContain("1 of 2 batches");
  });

  it("does not infer physical completion from a past production date", () => {
    const data = buildTodayHub(
      [row()],
      [{ id: "slot", slot_date: "2026-10-22", slot_index: 1 }],
      [{ id: "a", order_id: "row-1", slot_id: "slot", kg_assigned: 10 }],
      [],
      now,
    );
    expect(labels(data)).toContain("Production dates passed");
    expect(data.counts.dispatch).toBe(0);
    expect(data.counts.schedule).toBe(0);
    expect(hub([row({ made: true })]).counts.dispatch).toBe(1);
    const stock = buildTodayHub(
      [row({ design_type: "premade", title: "Premade Stock - Lime" })],
      [{ id: "slot", slot_date: "2026-10-22", slot_index: 1 }],
      [{ id: "a", order_id: "row-1", slot_id: "slot", kg_assigned: 10 }],
      [],
      now,
    );
    expect(stock.counts.active).toBe(0);
  });

  it("does not ask for customer payment or dispatch for internal pre-made stock", () => {
    const data = hub([
      row({
        design_type: "premade",
        title: "Premade Stock - Lime",
        notes: "[admin-premade-stock]",
        paid_at: null,
      }),
    ]);
    expect(data.counts.payments).toBe(0);
    expect(data.counts.dispatch).toBe(0);
    expect(data.counts.schedule).toBe(1);
    expect(
      hub([
        row({
          design_type: "premade",
          title: "Premade Stock - Lime",
          notes: "[admin-premade-stock]",
          due_date: null,
        }),
      ]).counts.review,
    ).toBe(0);
    expect(
      hub([row({ design_type: "premade", made: true })]).counts.dispatch,
    ).toBe(1);
  });

  it("uses Perth's day boundary and includes only open assignments in the seven-day outlook", () => {
    const data = buildTodayHub(
      [row(), row({ id: "closed", status: "shipped" })],
      [{ id: "slot", slot_date: "2026-10-24", slot_index: 2 }],
      [
        { id: "active", order_id: "row-1", slot_id: "slot", kg_assigned: 10 },
        { id: "closed", order_id: "closed", slot_id: "slot", kg_assigned: 10 },
        {
          id: "orphan",
          order_id: "row-1",
          slot_id: "missing",
          kg_assigned: 10,
        },
      ],
      [{ note_date: "2026-10-24", note: "Morning delivery" }],
      "2026-10-23T16:01:00Z",
    );
    expect(data.today).toBe("2026-10-24");
    expect(data.agenda).toHaveLength(7);
    expect(data.agenda[0].batches.map((batch) => batch.id)).toEqual(["active"]);
    expect(data.agenda[0].note).toBe("Morning delivery");
  });
});
