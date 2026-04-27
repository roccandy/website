import { describe, expect, it } from "vitest";
import {
  toPublicCheckoutError,
  toPublicPaymentError,
  toPublicPricingError,
} from "@/lib/publicErrorMessages";

describe("public error messages", () => {
  it("maps pricing configuration errors to customer-safe wording", () => {
    expect(toPublicPricingError("Invalid packaging option")).toBe(
      "That candy or packaging option is no longer available. Please refresh the page and choose again.",
    );
  });

  it("maps pricing weight-limit errors to actionable wording", () => {
    expect(toPublicPricingError("Total weight exceeds limit")).toBe(
      "This combination is too large for one order. Please reduce the quantity or split it into multiple orders.",
    );
  });

  it("maps ingredient label limit errors to actionable wording", () => {
    expect(toPublicPricingError("Ingredient label count exceeds maximum")).toBe(
      "The selected label quantity is too high for this order. Please reduce it and try again.",
    );
  });

  it("maps checkout cart refresh failures to a review message", () => {
    expect(toPublicCheckoutError("Custom item pricing failed.")).toBe(
      "One or more custom items need to be refreshed. Please review your cart and try again.",
    );
  });

  it("maps unavailable dates to a clearer checkout message", () => {
    expect(toPublicCheckoutError("Selected date is unavailable.")).toBe(
      "That requested date is no longer available. Please choose another date.",
    );
  });

  it("maps max-weight failures to a split-order message", () => {
    expect(toPublicCheckoutError("Max total kg is 18.")).toBe(
      "This order is too large for one checkout. Please reduce the quantity or split it into multiple orders.",
    );
  });

  it("maps ingredient label limit checkout failures to actionable wording", () => {
    expect(toPublicCheckoutError("Ingredient label count exceeds maximum")).toBe(
      "The selected ingredient label quantity is too high for this order. Please reduce it and try again.",
    );
  });

  it("maps order record save failures to a clearer payment message", () => {
    expect(toPublicPaymentError("Supabase order insert failed: column \"ingredient_labels_count\" does not exist")).toBe(
      "Your payment was received, but we couldn't save the order record. Please keep your order number and contact us if you do not receive a confirmation email shortly.",
    );
  });

  it("maps provider setup failures to a temporary-unavailable message", () => {
    expect(toPublicPaymentError("PayPal is not configured (missing PAYPAL_SECRET).")).toBe(
      "This payment method is temporarily unavailable. Please choose another payment option or contact us.",
    );
  });

  it("maps script loader failures to a generic secure-form message", () => {
    expect(toPublicPaymentError("Failed to load https://www.paypal.com/sdk/js")).toBe(
      "We couldn't load the secure payment form. Please refresh the page and try again.",
    );
  });

  it("maps declines to a clearer payment message", () => {
    expect(toPublicPaymentError("Card declined")).toBe(
      "Your payment was declined. Please check your details or use another payment method.",
    );
  });

  it("maps generic provider payment failures to a more specific message", () => {
    expect(toPublicPaymentError("Square payment failed")).toBe(
      "We couldn't process your payment because the payment provider returned an error. Please try again or use another payment method.",
    );
  });
});
