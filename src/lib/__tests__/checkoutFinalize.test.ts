import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CheckoutOrderPayload } from "@/lib/checkoutTypes";

const buildCheckoutOrderContext = vi.fn();
const buildAdminOrderSummaryEmailPayload = vi.fn();
const sendCustomerOrderSummaryEmail = vi.fn();
const sendAdminOrderSummaryEmail = vi.fn();
const getOrdersRecipients = vi.fn();
const isEmailConfigured = vi.fn();
const insert = vi.fn();
const from = vi.fn(() => ({ insert }));

vi.mock("@/lib/checkoutOrder", () => ({
  buildCheckoutOrderContext,
}));

vi.mock("@/lib/orderEmailSummary", () => ({
  buildAdminOrderSummaryEmailPayload,
}));

vi.mock("@/lib/email", () => ({
  sendCustomerOrderSummaryEmail,
  sendAdminOrderSummaryEmail,
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

  it("returns a warning when the Supabase insert fails", async () => {
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
    ).resolves.toEqual({
      orderNumber: "000123",
      trackingTransactionId: "000123-txn_789",
      orderTotal: 149.5,
      tax: 13.59,
      shipping: 0,
      adminEmailWarning:
        "Your payment was received, but we had trouble finalising the order record. Please keep your order number and contact us if you do not receive a confirmation email shortly.",
    });

    expect(sendCustomerOrderSummaryEmail).toHaveBeenCalledTimes(1);
    expect(sendAdminOrderSummaryEmail).toHaveBeenCalledTimes(1);
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
});
