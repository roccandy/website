import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildDirectDepositInvoicePdf } from "@/lib/directDepositInvoicePdf";

describe("direct-deposit invoice PDF", () => {
  it("creates a valid tax invoice PDF", async () => {
    const pdf = await buildDirectDepositInvoicePdf({
      invoiceNumber: "RC-123",
      invoiceTitle: "Personalised candy order",
      customerName: "Example Customer",
      customerEmail: "customer@example.com",
      dueDate: "2026-08-25",
      orders: [
        {
          order_number: "RC-123",
          title: "Custom candy",
          order_description: "10 x Jar",
          quantity: 10,
          total_price: 120,
        },
      ],
    });

    expect(Buffer.from(pdf).subarray(0, 4).toString()).toBe("%PDF");
    await expect(PDFDocument.load(pdf)).resolves.toMatchObject({ getPageCount: expect.any(Function) });
    expect((await PDFDocument.load(pdf)).getPageCount()).toBe(1);
  });
});
