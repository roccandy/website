import { describe, expect, it } from "vitest";
import {
  defaultSquareInvoiceNumber,
  SQUARE_INVOICE_NUMBER_MAX_LENGTH,
  squareInvoiceNumberWithSuffix,
} from "@/lib/squareInvoiceNumbers";

describe("square invoice numbers", () => {
  it("uses the Roc order number for a single invoice", () => {
    expect(defaultSquareInvoiceNumber({ id: "order-id-123", order_number: "0078" })).toBe("0078");
  });

  it("falls back to the order id prefix when an order number is missing", () => {
    expect(defaultSquareInvoiceNumber({ id: "3a4f64a5-0000-4000-9000-000000000000", order_number: null })).toBe(
      "3a4f64a5",
    );
  });

  it("joins order numbers for combined invoices", () => {
    expect(
      defaultSquareInvoiceNumber({
        id: "primary-order",
        order_number: "0078",
        invoiceOrders: [
          { id: "primary-order", order_number: "0078" },
          { id: "second-order", order_number: "0079" },
        ],
      }),
    ).toBe("0078, 0079");
  });

  it("keeps fallback suffixes inside Square's invoice number limit", () => {
    const invoiceNumber = "1".repeat(SQUARE_INVOICE_NUMBER_MAX_LENGTH);
    const value = squareInvoiceNumberWithSuffix(invoiceNumber, "replace-123456789");
    expect(value).toHaveLength(SQUARE_INVOICE_NUMBER_MAX_LENGTH);
    expect(value.endsWith("-23456789")).toBe(true);
  });
});
