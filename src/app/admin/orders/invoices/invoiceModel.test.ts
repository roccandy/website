import { describe, expect, it } from "vitest";
import {
  buildInvoices,
  buildInvoiceRecord,
  filterInvoices,
  parseInvoiceFilters,
  safeInvoiceUrl,
  type InvoiceOrder,
} from "./invoiceModel";

const now = "2026-10-24T02:00:00Z";
const row = (changes: Partial<InvoiceOrder> = {}) =>
  ({
    id: "a",
    order_number: "100",
    title: "Candy",
    customer_name: "Zoe",
    customer_email: "z@example.test",
    created_at: "2026-10-01T00:00:00Z",
    status: "scheduled",
    total_price: 110,
    square_invoice_id: "invoice",
    square_invoice_status: "DRAFT",
    ...changes,
  }) as InvoiceOrder;
describe("Invoice hub records", () => {
  it("offers bank-transfer reconciliation for unpaid Square payment-link invoices", () => {
    const result=buildInvoiceRecord([row({square_invoice_status:"UNPAID"})],now);
    expect(result.route).toBe("square");
    expect(result.canRecordPayment).toBe(true);
    expect(buildInvoiceRecord([row({square_invoice_status:"PARTIALLY_PAID"})],now).canRecordPayment).toBe(false);
    expect(buildInvoiceRecord([row({square_invoice_status:"UNPAID",square_invoice_error:"sync failed"})],now).canRecordPayment).toBe(false);
  });
  it("groups combined invoices without counting the shared invoice twice", () => {
    const result = buildInvoices(
      [
        row(),
        row({ id: "b", total_price: 55 }),
        row({ id: "web", square_invoice_id: null, payment_provider: "square" }),
      ],
      now,
    );
    expect(result).toHaveLength(1);
    expect(result[0].total).toBe(16500);
    expect(result[0].orders).toHaveLength(2);
  });
  it("keeps an unsent draft sendable and never mistakes the production date for payment due", () => {
    const result = buildInvoiceRecord([row({ due_date: "2020-01-01" })], now);
    expect(result.status).toBe("draft");
    expect(result.canSend).toBe(true);
    expect(result.due).toBeNull();
    expect(result.unpaid).toBe(0);
  });
  it("recognises a PDF sent while Square remains a draft", () => {
    const result = buildInvoiceRecord(
      [
        row({
          square_invoice_sent_at: "2026-10-02",
          payment_method: "Direct deposit",
          square_invoice_due_date: "2026-10-10",
        }),
      ],
      now,
    );
    expect(result.status).toBe("overdue");
    expect(result.route).toBe("pdf");
    expect(result.canSend).toBe(false);
    expect(result.canRecordPayment).toBe(true);
    expect(result.unpaid).toBe(11000);
  });
  it.each(["PAID", "PARTIALLY_PAID", "PAYMENT_PENDING", "CANCELED", "UNPAID"])(
    "does not send another invoice for %s",
    (state) => {
      expect(
        buildInvoiceRecord([row({ square_invoice_status: state })], now)
          .canSend,
      ).toBe(false);
    },
  );
  it("recognises recorded bank payment without relying on Square draft status", () => {
    const result = buildInvoiceRecord([row({ paid_at: "2026-10-10" })], now);
    expect(result.status).toBe("paid");
    expect(result.unpaid).toBe(0);
    expect(result.canSend).toBe(false);
  });
  it("does not invent balances for partial or in-flight payments", () => {
    for (const state of ["PARTIALLY_PAID", "PAYMENT_PENDING"])
      expect(
        buildInvoiceRecord([row({ square_invoice_status: state })], now).unpaid,
      ).toBeNull();
  });
  it("never treats retained refund money as new debt", () => {
    const result = buildInvoiceRecord(
      [
        row({
          total_price: 670.5,
          paid_at: "2026-10-01",
          refunded_at: "2026-10-10",
          refunded_amount: 660.11,
        }),
      ],
      now,
    );
    expect(result.status).toBe("partial-refund");
    expect(result.refunded).toBe(66011);
    expect(result.unpaid).toBe(0);
    expect(result.canSend).toBe(false);
  });
  it("surfaces creation failures with no invoice ID", () => {
    const result = buildInvoices(
      [row({ square_invoice_id: null, square_invoice_error: "Failed" })],
      now,
    )[0];
    expect(result.status).toBe("error");
    expect(result.canSend).toBe(false);
    expect(result.unpaid).toBeNull();
  });
  it("flags conflicting linked payment records", () => {
    const result = buildInvoiceRecord(
      [row({ paid_at: "2026-10-10" }), row({ id: "b" })],
      now,
    );
    expect(result.status).toBe("review");
    expect(result.canSend).toBe(false);
  });
  it("searches names, email, order number and title and sorts names or creation date", () => {
    const invoices = buildInvoices(
      [
        row(),
        row({
          id: "b",
          square_invoice_id: "other",
          customer_name: "Amy",
          customer_email: "amy@example.test",
          order_number: "200",
          created_at: "2026-10-20T00:00:00Z",
        }),
      ],
      now,
    );
    expect(
      filterInvoices(invoices, parseInvoiceFilters({ q: "200" }))[0].customer,
    ).toBe("Amy");
    expect(
      filterInvoices(invoices, parseInvoiceFilters({ sort: "customer" }))[0]
        .customer,
    ).toBe("Amy");
    expect(
      filterInvoices(invoices, parseInvoiceFilters({ sort: "oldest" }))[0]
        .customer,
    ).toBe("Zoe");
    expect(
      filterInvoices(
        invoices,
        parseInvoiceFilters({ from: "2026-10-10", to: "2026-10-21" }),
      ),
    ).toHaveLength(1);
    expect(
      filterInvoices(invoices, parseInvoiceFilters({ q: "z@example.test" })),
    ).toHaveLength(1);
  });
  it("uses Perth's creation date for date bounds", () => {
    const invoices = buildInvoices(
      [row({ created_at: "2026-10-23T17:00:00Z" })],
      now,
    );
    expect(
      filterInvoices(
        invoices,
        parseInvoiceFilters({ from: "2026-10-24", to: "2026-10-24" }),
      ),
    ).toHaveLength(1);
  });
  it("validates query options and rejects unsafe customer payment URLs", () => {
    expect(
      parseInvoiceFilters({ view: "oops", sort: [], from: "bad" }),
    ).toEqual({ view: "all", sort: "newest", q: "", from: "", to: "" });
    for (const value of [
      "javascript:alert(1)",
      "http://example.test",
      "data:text/html,x",
    ])
      expect(safeInvoiceUrl(value)).toBeNull();
    expect(safeInvoiceUrl("https://squareup.com/invoice")).toBe(
      "https://squareup.com/invoice",
    );
  });
});
