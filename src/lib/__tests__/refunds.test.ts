import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Square refunds", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.env = {
      ...originalEnv,
      SQUARE_ACCESS_TOKEN: "square-token",
      SQUARE_LOCATION_ID: "square-location",
      SQUARE_API_BASE: "https://square.test",
      SQUARE_API_VERSION: "2026-05-20",
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  it("resolves a Square invoice payment id through the invoice order tender", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ invoice: { id: "inv_123", order_id: "order_123" } }))
      .mockResolvedValueOnce(
        jsonResponse({
          order: {
            id: "order_123",
            tenders: [{ payment_id: "pay_123", amount_money: { amount: 78200 } }],
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { resolveSquareInvoicePaymentId } = await import("@/lib/refunds");

    await expect(resolveSquareInvoicePaymentId("inv_123", 78200)).resolves.toEqual({
      paymentId: "pay_123",
      orderId: "order_123",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://square.test/v2/invoices/inv_123",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://square.test/v2/orders/order_123",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("refunds a Square invoice using the underlying payment id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ invoice: { id: "inv_123", order_id: "order_123" } }))
      .mockResolvedValueOnce(
        jsonResponse({
          order: {
            id: "order_123",
            tenders: [{ payment_id: "pay_123", amount_money: { amount: 78200 } }],
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ refund: { id: "refund_123", status: "PENDING" } }));
    vi.stubGlobal("fetch", fetchMock);

    const { refundSquareInvoicePayment } = await import("@/lib/refunds");

    await expect(refundSquareInvoicePayment("inv_123", 78200, "Customer requested")).resolves.toEqual({
      id: "refund_123",
      status: "PENDING",
    });

    const refundRequest = fetchMock.mock.calls[2];
    expect(refundRequest?.[0]).toBe("https://square.test/v2/refunds");
    expect(JSON.parse(String(refundRequest?.[1]?.body))).toEqual(
      expect.objectContaining({
        payment_id: "pay_123",
        amount_money: { amount: 78200, currency: "AUD" },
        reason: "Customer requested",
      }),
    );
  });

  it("rejects invoice refunds that would need multiple Square payments", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ invoice: { id: "inv_123", order_id: "order_123" } }))
      .mockResolvedValueOnce(
        jsonResponse({
          order: {
            id: "order_123",
            tenders: [
              { payment_id: "pay_1", amount_money: { amount: 5000 } },
              { payment_id: "pay_2", amount_money: { amount: 5000 } },
            ],
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { refundSquareInvoicePayment } = await import("@/lib/refunds");

    await expect(refundSquareInvoicePayment("inv_123", 10000, null)).rejects.toThrow(
      "Square invoice has multiple payments",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
