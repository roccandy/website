import { createHash, createHmac, timingSafeEqual } from "crypto";
import type { CheckoutOrderPayload } from "@/lib/checkoutTypes";

function stableOrderJson(order: CheckoutOrderPayload) {
  // Preserve the pre-removal signature shape so a PayPal order created just
  // before deployment can still be captured. This value has no pricing effect.
  const legacyPromoCode = (order as CheckoutOrderPayload & { promoCode?: unknown }).promoCode;
  return JSON.stringify({
    dueDate: order.dueDate ?? null,
    pickup: Boolean(order.pickup),
    paymentPreference: order.paymentPreference ?? null,
    promoCode: typeof legacyPromoCode === "string" ? legacyPromoCode : null,
    customer: order.customer,
    customItems: order.customItems,
    premadeItems: order.premadeItems,
  });
}

function signingSecret() {
  return process.env.PAYPAL_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim() || null;
}

export function createCheckoutFingerprint(order: CheckoutOrderPayload, orderNumber: string) {
  const secret = signingSecret();
  if (!secret) throw new Error("Checkout state signing is not configured.");
  const digest = createHash("sha256").update(stableOrderJson(order)).digest("hex");
  const payload = `${orderNumber}.${digest}`;
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyCheckoutFingerprint(
  token: string | null | undefined,
  order: CheckoutOrderPayload,
  expectedOrderNumber: string | null | undefined,
) {
  const secret = signingSecret();
  if (!secret || !token || !expectedOrderNumber) return false;
  const [orderNumber, digest, signature, extra] = token.split(".");
  if (extra || !orderNumber || !digest || !signature || orderNumber !== expectedOrderNumber) return false;
  const expectedDigest = createHash("sha256").update(stableOrderJson(order)).digest("hex");
  if (digest !== expectedDigest) return false;
  const expectedSignature = createHmac("sha256", secret).update(`${orderNumber}.${digest}`).digest("base64url");
  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
