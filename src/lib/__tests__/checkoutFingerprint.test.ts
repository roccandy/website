import { afterEach, describe, expect, it } from "vitest";
import { createCheckoutFingerprint, verifyCheckoutFingerprint } from "@/lib/checkoutFingerprint";
import type { CheckoutOrderPayload } from "@/lib/checkoutTypes";

const order: CheckoutOrderPayload = {
  dueDate: "2099-05-20",
  pickup: true,
  customer: { firstName: "Test", lastName: "Customer", email: "customer@example.com", phone: "0400000000" },
  customItems: [],
  premadeItems: [{ premadeId: "premade-1", quantity: 1 }],
};

describe("checkout fingerprint", () => {
  afterEach(() => {
    delete process.env.PAYPAL_SECRET;
  });

  it("only verifies the exact checkout snapshot and order number", () => {
    process.env.PAYPAL_SECRET = "test-secret";
    const fingerprint = createCheckoutFingerprint(order, "0008");

    expect(verifyCheckoutFingerprint(fingerprint, order, "0008")).toBe(true);
    expect(verifyCheckoutFingerprint(fingerprint, { ...order, pickup: false }, "0008")).toBe(false);
    expect(verifyCheckoutFingerprint(fingerprint, order, "0009")).toBe(false);
  });
});
