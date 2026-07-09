export type SquareInvoiceNumberOrder = {
  id: string;
  order_number?: string | null;
};

export const SQUARE_INVOICE_NUMBER_MAX_LENGTH = 255;

function orderInvoiceNumber(order: SquareInvoiceNumberOrder) {
  return order.order_number?.trim() || order.id.slice(0, 8);
}

function fitSquareInvoiceNumber(value: string) {
  return value.slice(0, SQUARE_INVOICE_NUMBER_MAX_LENGTH);
}

export function defaultSquareInvoiceNumber(
  order: SquareInvoiceNumberOrder & {
    invoiceOrders?: SquareInvoiceNumberOrder[];
  },
) {
  const invoiceOrders = order.invoiceOrders?.length ? order.invoiceOrders : [order];
  const references = Array.from(new Set(invoiceOrders.map(orderInvoiceNumber).filter(Boolean)));
  return fitSquareInvoiceNumber(references.join(", ") || orderInvoiceNumber(order));
}

export function squareInvoiceNumberWithSuffix(invoiceNumber: string, suffixSource: string) {
  const suffix = `-${suffixSource.replace(/[^a-z0-9]/gi, "").slice(-8)}`;
  if (suffix.length <= 1) return fitSquareInvoiceNumber(invoiceNumber);
  return `${invoiceNumber.slice(0, SQUARE_INVOICE_NUMBER_MAX_LENGTH - suffix.length)}${suffix}`;
}
