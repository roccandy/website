import { afterEach, expect, it, vi } from "vitest";
import { isCheckoutTestPromoCode } from "../checkoutPromo";
afterEach(() => vi.unstubAllEnvs());
it("accepts only the exact private test code (allowing pasted surrounding whitespace)", () => {
  expect(isCheckoutTestPromoCode("FH*#HK@NXsh83D=-S")).toBe(true);
  expect(isCheckoutTestPromoCode(" FH*#HK@NXsh83D=-S ")).toBe(true);
  for (const value of ["", null, true, {}, "FH*#HK@NXsh83D=-s", "FH*#HK@NXsh83D=-X", "x".repeat(1000)]) expect(isCheckoutTestPromoCode(value)).toBe(false);
});
it("can be disabled server-side without deploying a new client", () => {
  vi.stubEnv("CHECKOUT_TEST_CODE_ENABLED", "false");
  expect(isCheckoutTestPromoCode("FH*#HK@NXsh83D=-S")).toBe(false);
});
