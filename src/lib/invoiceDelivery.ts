export const DIRECT_DEPOSIT_PDF_PAYMENT_METHOD_LABEL = "Direct deposit PDF via Square";

export function isDirectDepositPdfInvoicePaymentMethod(value: string | null | undefined) {
  return value?.trim().toLowerCase() === DIRECT_DEPOSIT_PDF_PAYMENT_METHOD_LABEL.toLowerCase();
}
