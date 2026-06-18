import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CheckoutOrderPayload } from "@/lib/checkoutTypes";

const buildWooOrderContext = vi.fn();
const createWooOrder = vi.fn();
const buildAdminOrderSummaryEmailPayload = vi.fn();
const sendCustomerOrderSummaryEmail = vi.fn();
const sendAdminOrderSummaryEmail = vi.fn();
const getOrdersRecipients = vi.fn();
const isEmailConfigured = vi.fn();
const insert = vi.fn();
const from = vi.fn(() => ({ insert }));

vi.mock("@/lib/checkoutOrder", () => ({
  buildWooOrderContext,
}));

vi.mock("@/lib/woo", () => ({
  createWooOrder,
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

    buildWooOrderContext.mockResolvedValue({
      billing: { first_name: "Test", email: "customer@example.com" },
      dueDate: "2026-04-10",
      pickup: false,
      lineItems: [{ name: "Order item" }],
      orderPayloads: [{ id: "line-1", title: "Custom Order" }],
      orderNumbers: { baseOrderNumber: "000123" },
      totalAmount: 149.5,
    });
    createWooOrder.mockResolvedValue({
      id: 456,
      status: "processing",
      order_key: "woo_key_123",
    });
    buildAdminOrderSummaryEmailPayload.mockResolvedValue({ subject: "Order 000123" });
    sendCustomerOrderSummaryEmail.mockResolvedValue(undefined);
    sendAdminOrderSummaryEmail.mockResolvedValue(undefined);
    getOrdersRecipients.mockReturnValue(["orders@roccandy.com.au"]);
    isEmailConfigured.mockReturnValue(true);
    insert.mockResolvedValue({ error: null });
  });

  it("creates the Woo order, inserts Supabase rows, and sends both emails", async () => {
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
      wooOrderId: 456,
      orderNumber: "000123",
      adminEmailWarning: null,
    });

    expect(createWooOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "processing",
        set_paid: true,
        payment_method: "square",
        payment_method_title: "Credit Card",
        transaction_id: "txn_123",
      }),
    );
    expect(from).toHaveBeenCalledWith("orders");
    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        woo_order_id: "456",
        woo_order_status: "processing",
        woo_order_key: "woo_key_123",
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
      wooOrderId: 456,
      orderNumber: "000123",
      adminEmailWarning: "Admin email not wired up.",
    });

    expect(sendCustomerOrderSummaryEmail).toHaveBeenCalledTimes(1);
    expect(sendAdminOrderSummaryEmail).not.toHaveBeenCalled();
  });

  it("returns a warning when the Woo order is created but Supabase insert fails", async () => {
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
      wooOrderId: 456,
      orderNumber: "000123",
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
      wooOrderId: null,
      orderNumber: "000123",
      adminEmailWarning: null,
    });

    expect(createWooOrder).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        woo_order_id: null,
        woo_order_status: null,
        woo_order_key: null,
        woo_payment_url: null,
        payment_provider: "square",
        payment_transaction_id: "txn_test",
        status: "test",
      }),
    ]);
    expect(sendCustomerOrderSummaryEmail).toHaveBeenCalledTimes(1);
    expect(sendAdminOrderSummaryEmail).toHaveBeenCalledTimes(1);
  });
});
