import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CheckoutOrderPayload } from "@/lib/checkoutTypes";

const buildCheckoutOrderContext = vi.fn();
const buildAdminOrderSummaryEmailPayload = vi.fn();
const sendCustomerOrderSummaryEmail = vi.fn();
const sendAdminOrderSummaryEmail = vi.fn();
const sendPaidOrderSaveFailureEmail = vi.fn();
const getOrdersRecipients = vi.fn();
const isEmailConfigured = vi.fn();
const insert = vi.fn();
const select = vi.fn(() => ({
  eq: vi.fn(() => ({
    eq: vi.fn().mockResolvedValue({ data: [], error: null }),
  })),
}));
const from = vi.fn(() => ({ insert, select }));

vi.mock("@/lib/checkoutOrder", () => ({
  buildCheckoutOrderContext,
}));

vi.mock("@/lib/orderEmailSummary", () => ({
  buildAdminOrderSummaryEmailPayload,
}));

vi.mock("@/lib/email", () => ({
  sendCustomerOrderSummaryEmail,
  sendAdminOrderSummaryEmail,
  sendPaidOrderSaveFailureEmail,
  getOrdersRecipients,
  isEmailConfigured,
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdminClient: {
    from,
  },
}));

const baseOrder = {
  customer: {
    email: "customer@example.com",
  },
  customItems: [],
  premadeItems: [],
} as unknown as CheckoutOrderPayload;

describe("finalizePaidCheckoutOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    buildCheckoutOrderContext.mockResolvedValue({
      billing: { first_name: "Test", email: "customer@example.com" },
      dueDate: "2026-04-10",
      pickup: false,
      lineItems: [{ name: "Order item" }],
      orderPayloads: [{ id: "line-1", title: "Custom Order" }],
      orderNumbers: { baseOrderNumber: "000123" },
      totalAmount: 149.5,
      taxAmount: 13.59,
      shippingAmount: 0,
    });
    buildAdminOrderSummaryEmailPayload.mockResolvedValue({ subject: "Order 000123" });
    sendCustomerOrderSummaryEmail.mockResolvedValue(undefined);
    sendAdminOrderSummaryEmail.mockResolvedValue(undefined);
    sendPaidOrderSaveFailureEmail.mockResolvedValue({ success: true });
    getOrdersRecipients.mockReturnValue(["orders@roccandy.com.au"]);
    isEmailConfigured.mockReturnValue(true);
    insert.mockResolvedValue({ error: null });
  });

  it("inserts Supabase rows and sends both emails without creating a Woo order", async () => {
    const { finalizePaidCheckoutOrder } = await import("@/lib/checkoutFinalize");

    await expect(
      finalizePaidCheckoutOrder({
        order: baseOrder,
        paymentProvider: "square",
        paymentMethod: "square",
        paymentMethodTitle: "Credit Card",
        transactionId: "txn_123",
      }),
    ).resolves.toEqual({
      orderNumber: "000123",
      trackingTransactionId: "000123-txn_123",
      orderTotal: 149.5,
      tax: 13.59,
      shipping: 0,
      adminEmailWarning: null,
    });

    expect(from).toHaveBeenCalledWith("orders");
    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        payment_provider: "square",
        payment_method: "Credit Card",
        payment_transaction_id: "txn_123",
        status: "pending",
      }),
    ]);
    expect(buildAdminOrderSummaryEmailPayload).toHaveBeenCalledTimes(1);
    expect(sendCustomerOrderSummaryEmail).toHaveBeenCalledTimes(1);
    expect(sendAdminOrderSummaryEmail).toHaveBeenCalledTimes(1);
  });

  it("returns an admin warning when admin email is not configured", async () => {
    isEmailConfigured.mockReturnValue(false);
    getOrdersRecipients.mockReturnValue([]);

    const { finalizePaidCheckoutOrder } = await import("@/lib/checkoutFinalize");

    await expect(
      finalizePaidCheckoutOrder({
        order: baseOrder,
        paymentProvider: "paypal",
        paymentMethod: "paypal",
        paymentMethodTitle: "PayPal",
        transactionId: "capture_456",
      }),
    ).resolves.toEqual({
      orderNumber: "000123",
      trackingTransactionId: "000123-capture_456",
      orderTotal: 149.5,
      tax: 13.59,
      shipping: 0,
      adminEmailWarning: "Admin email not wired up.",
    });

    expect(sendCustomerOrderSummaryEmail).toHaveBeenCalledTimes(1);
    expect(sendAdminOrderSummaryEmail).not.toHaveBeenCalled();
  });

  it("does not report success or send emails when the order insert fails", async () => {
    insert.mockResolvedValue({ error: { message: "insert failed" } });

    const { finalizePaidCheckoutOrder } = await import("@/lib/checkoutFinalize");

    await expect(
      finalizePaidCheckoutOrder({
        order: baseOrder,
        paymentProvider: "square",
        paymentMethod: "square",
        paymentMethodTitle: "Credit Card",
        transactionId: "txn_789",
      }),
    ).rejects.toThrow("Order record could not be saved after payment.");

    expect(sendCustomerOrderSummaryEmail).not.toHaveBeenCalled();
    expect(sendAdminOrderSummaryEmail).not.toHaveBeenCalled();
    expect(sendPaidOrderSaveFailureEmail).toHaveBeenCalledWith(
      ["orders@roccandy.com.au"],
      expect.objectContaining({
        orderNumber: "000123",
        paymentProvider: "square",
        transactionId: "txn_789",
        orderTotal: 149.5,
        customerEmail: "customer@example.com",
        saveError: "insert failed",
        items: [expect.objectContaining({ title: "Custom Order" })],
      }),
    );
    expect(from).toHaveBeenCalledWith("payment_failures");
    expect(insert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        provider: "square",
        stage: "order_finalization",
        payment_transaction_id: "txn_789",
        order_number: "000123",
        checkout_snapshot: expect.objectContaining({ totalAmount: 149.5 }),
      }),
    );
  });

  it("alerts admin when the order insert throws a network error", async () => {
    insert.mockRejectedValue(new Error("database network unavailable"));

    const { finalizePaidCheckoutOrder } = await import("@/lib/checkoutFinalize");

    await expect(
      finalizePaidCheckoutOrder({
        order: baseOrder,
        paymentProvider: "paypal",
        paymentMethod: "paypal",
        paymentMethodTitle: "PayPal",
        transactionId: "capture_network_failure",
      }),
    ).rejects.toThrow("Order record could not be saved after payment.");

    expect(insert).toHaveBeenCalledTimes(4);
    expect(sendPaidOrderSaveFailureEmail).toHaveBeenCalledWith(
      ["orders@roccandy.com.au"],
      expect.objectContaining({
        paymentProvider: "paypal",
        transactionId: "capture_network_failure",
        saveError: "database network unavailable",
      }),
    );
    expect(sendCustomerOrderSummaryEmail).not.toHaveBeenCalled();
    expect(sendAdminOrderSummaryEmail).not.toHaveBeenCalled();
  });

  it("stores test promo orders without creating a Woo order", async () => {
    const { finalizePaidCheckoutOrder } = await import("@/lib/checkoutFinalize");

    await expect(
      finalizePaidCheckoutOrder({
        order: {
          ...baseOrder,
          promoCode: "FH*#HK@NXsh83D=-S",
        },
        paymentProvider: "square",
        paymentMethod: "square",
        paymentMethodTitle: "Credit Card",
        transactionId: "txn_test",
      }),
    ).resolves.toEqual({
      orderNumber: "000123",
      trackingTransactionId: "000123-txn_test",
      orderTotal: 149.5,
      tax: 13.59,
      shipping: 0,
      adminEmailWarning: null,
    });

    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        payment_provider: "square",
        payment_transaction_id: "txn_test",
        status: "test",
      }),
    ]);
    expect(sendCustomerOrderSummaryEmail).toHaveBeenCalledTimes(1);
    expect(sendAdminOrderSummaryEmail).toHaveBeenCalledTimes(1);
  });

  it("rebuilds the context and retries when an order number conflicts", async () => {
    buildCheckoutOrderContext
      .mockResolvedValueOnce({
        billing: { first_name: "Test", email: "customer@example.com" },
        dueDate: "2026-04-10",
        pickup: false,
        lineItems: [{ name: "Order item" }],
        orderPayloads: [{ id: "line-1", order_number: "000123", title: "Custom Order" }],
        orderNumbers: { baseOrderNumber: "000123" },
        totalAmount: 149.5,
        taxAmount: 13.59,
        shippingAmount: 0,
      })
      .mockResolvedValueOnce({
        billing: { first_name: "Test", email: "customer@example.com" },
        dueDate: "2026-04-10",
        pickup: false,
        lineItems: [{ name: "Order item" }],
        orderPayloads: [{ id: "line-1", order_number: "000124", title: "Custom Order" }],
        orderNumbers: { baseOrderNumber: "000124" },
        totalAmount: 149.5,
        taxAmount: 13.59,
        shippingAmount: 0,
      });
    insert
      .mockResolvedValueOnce({ error: { message: "duplicate key value violates unique constraint orders_order_number_unique_idx" } })
      .mockResolvedValueOnce({ error: null });

    const { finalizePaidCheckoutOrder } = await import("@/lib/checkoutFinalize");

    await expect(
      finalizePaidCheckoutOrder({
        order: baseOrder,
        paymentProvider: "square",
        paymentMethod: "square",
        paymentMethodTitle: "Credit Card",
        transactionId: "txn_retry",
      }),
    ).resolves.toEqual({
      orderNumber: "000124",
      trackingTransactionId: "000124-txn_retry",
      orderTotal: 149.5,
      tax: 13.59,
      shipping: 0,
      adminEmailWarning: null,
    });

    expect(buildCheckoutOrderContext).toHaveBeenCalledTimes(2);
    expect(insert).toHaveBeenCalledTimes(2);
  });

  it("returns the existing result without duplicating a captured payment", async () => {
    select.mockReturnValueOnce({
      eq: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ data: [{ order_number: "000123-a" }], error: null }),
      })),
    });
    const { finalizePaidCheckoutOrder } = await import("@/lib/checkoutFinalize");

    await expect(
      finalizePaidCheckoutOrder({
        order: baseOrder,
        paymentProvider: "square",
        paymentMethod: "square",
        paymentMethodTitle: "Credit Card",
        transactionId: "txn_existing",
      }),
    ).resolves.toMatchObject({
      orderNumber: "000123",
      trackingTransactionId: "000123-txn_existing",
    });

    expect(insert).not.toHaveBeenCalled();
    expect(sendCustomerOrderSummaryEmail).not.toHaveBeenCalled();
  });
});
