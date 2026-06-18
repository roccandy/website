export const CHECKOUT_TEST_PROMO_CODE = "FH*#HK@NXsh83D=-S";
export const CHECKOUT_TEST_PROMO_TOTAL = 0.01;

export function normalizeCheckoutPromoCode(code?: string | null) {
  return code?.trim() ?? "";
}

export function isCheckoutTestPromoCode(code?: string | null) {
  return normalizeCheckoutPromoCode(code) === CHECKOUT_TEST_PROMO_CODE;
}
