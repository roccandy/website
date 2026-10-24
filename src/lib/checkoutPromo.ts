// Node-only: never import this validator into a customer/client component.
import { createHash, timingSafeEqual } from "node:crypto";

export const CHECKOUT_TEST_PROMO_TOTAL = 0.01;
const CODE_DIGEST = "dc6b73d065f06cb53fe5b97d481f4649c2b466a7dba0b2f6027d5b7cbda1d733";

export function isCheckoutTestPromoCode(value: unknown) {
  if (process.env.CHECKOUT_TEST_CODE_ENABLED === "false" || typeof value !== "string" || value.length > 256) return false;
  const actual = createHash("sha256").update(value.trim()).digest();
  return timingSafeEqual(actual, Buffer.from(CODE_DIGEST, "hex"));
}
