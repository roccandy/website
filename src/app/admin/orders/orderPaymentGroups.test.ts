import { describe, expect, it } from "vitest";
import type { OrderRow } from "@/lib/data";
import { consecutivePaymentGroups, paymentStripRowSpans } from "./orderPaymentGroups";
const row = (id: string, values: Partial<OrderRow> = {}) => ({ id, design_type: "branded", square_invoice_id: "invoice", paid_at: "2026-10-01", ...values }) as OrderRow;
describe("shared invoice payment strips", () => {
  it("joins adjacent split rows with the same invoice and payment state", () => {
    const a = row("a"), b = row("b"), c = row("c");
    expect(paymentStripRowSpans([[a], [b], [c]])).toEqual([{ rowSpan: 3, orders: [a, b, c] }, null, null]);
    expect(consecutivePaymentGroups([a, b])).toEqual([[a, b]]);
  });
  it("keeps different invoices and different payment states separate", () => {
    for (const other of [row("b", { square_invoice_id: "different" }), row("b", { paid_at: null }), row("b", { status: "partially-refunded" }), row("b", { refunded_at: "2026-10-02" })]) {
      expect(paymentStripRowSpans([[row("a")], [other]]).map((span) => span?.rowSpan)).toEqual([1, 1]);
      expect(consecutivePaymentGroups([row("a"), other])).toHaveLength(2);
    }
  });
  it("does not merge unrelated website, manual or stock orders merely because colours match", () => {
    for (const values of [{ square_invoice_id: null, payment_provider: "square" }, { square_invoice_id: null }, { design_type: "premade", notes: "[admin-premade-stock]" }]) {
      expect(paymentStripRowSpans([[row("a", values)], [row("b", values)]])[1]?.rowSpan).toBe(1);
    }
  });
  it("does not span intervening or mixed-invoice rows after sorting/filtering", () => {
    const a = row("a"), b = row("b", { square_invoice_id: "different" }), c = row("c");
    expect(paymentStripRowSpans([[a], [b], [c]]).map((span) => span?.rowSpan)).toEqual([1, 1, 1]);
    expect(paymentStripRowSpans([[a, b], [c]]).map((span) => span?.rowSpan)).toEqual([1, 1]);
  });
  it("combines matching multi-item rows without mutating input arrays", () => {
    const first = [row("a"), row("b")], second = [row("c")];
    expect(paymentStripRowSpans([first, second])[0]?.orders).toHaveLength(3);
    expect(first).toHaveLength(2);
  });
  it("distinguishes partial and full refunds even after an order has been archived", () => {
    const partial = row("partial", { status: "archived", refunded_at: "2026-10-02", refunded_amount: 50, total_price: 100 });
    const full = row("full", { status: "archived", refunded_at: "2026-10-02", refunded_amount: 100, total_price: 100 });
    expect(paymentStripRowSpans([[partial], [full]])[1]?.rowSpan).toBe(1);
  });
});
