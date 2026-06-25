import { buildCheckoutOrderContext, type CheckoutOrderContext } from "@/lib/checkoutOrder";
import { getOrdersRecipients, isEmailConfigured, sendAdminOrderSummaryEmail, sendCustomerOrderSummaryEmail } from "@/lib/email";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import type { CheckoutOrderPayload } from "@/lib/checkoutTypes";
import { isCheckoutTestPromoCode } from "@/lib/checkoutPromo";
import { buildAdminOrderSummaryEmailPayload } from "@/lib/orderEmailSummary";

const EMAIL_WAIT_MS = 4000;
const ORDER_INSERT_ATTEMPTS = 3;

type FinalizePaidCheckoutInput = {
  order: CheckoutOrderPayload;
  paymentProvider: string;
  paymentMethod: string;
  paymentMethodTitle: string;
  transactionId: string;
  checkoutContext?: CheckoutOrderContext;
  baseOrderNumber?: string | null;
};

export type FinalizePaidCheckoutResult = {
  orderNumber: string;
  trackingTransactionId: string;
  orderTotal: number;
  tax: number;
  shipping: number;
  adminEmailWarning: string | null;
};

const INTERNAL_ORDER_SAVE_WARNING =
  "Your payment was received, but we had trouble finalising the order record. Please keep your order number and contact us if you do not receive a confirmation email shortly.";

function isOrderNumberConflict(error: unknown) {
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";
  return message.toLowerCase().includes("order_number") && /duplicate|unique/i.test(message);
}

function buildTrackingTransactionId(orderNumber: string, transactionId: string) {
  const normalizedOrderNumber = orderNumber.trim();
  const normalizedTransactionId = transactionId.trim();
  return normalizedTransactionId
    ? `${normalizedOrderNumber}-${normalizedTransactionId}`
    : normalizedOrderNumber;
}

function buildPaidOrderPayloads({
  context,
  paymentProvider,
  paymentMethodTitle,
  transactionId,
  isTestOrder,
  paidAt,
}: {
  context: CheckoutOrderContext;
  paymentProvider: string;
  paymentMethodTitle: string;
  transactionId: string;
  isTestOrder: boolean;
  paidAt: string;
}) {
  return context.orderPayloads.map((payload) => ({
    ...payload,
    payment_method: paymentMethodTitle,
    status: isTestOrder ? "test" : "pending",
    paid_at: paidAt,
    payment_provider: paymentProvider,
    payment_transaction_id: transactionId,
  }));
}

export async function finalizePaidCheckoutOrder({
  order,
  paymentProvider,
  paymentMethodTitle,
  transactionId,
  checkoutContext,
  baseOrderNumber,
}: FinalizePaidCheckoutInput): Promise<FinalizePaidCheckoutResult> {
  let context =
    checkoutContext ??
    (await buildCheckoutOrderContext(order, {
      baseOrderNumber,
    }));
  const customerEmail = order.customer?.email?.trim() || null;
  const isTestOrder = isCheckoutTestPromoCode(order.promoCode);
  const paidAt = new Date().toISOString();

  let adminEmailWarning: string | null = null;
  for (let attempt = 1; attempt <= ORDER_INSERT_ATTEMPTS; attempt += 1) {
    const enrichedPayloads = buildPaidOrderPayloads({
      context,
      paymentProvider,
      paymentMethodTitle,
      transactionId,
      isTestOrder,
      paidAt,
    });
    const { error: insertError } = await supabaseAdminClient.from("orders").insert(enrichedPayloads);
    if (!insertError) {
      break;
    }
    if (attempt < ORDER_INSERT_ATTEMPTS && isOrderNumberConflict(insertError)) {
      context = await buildCheckoutOrderContext(order);
      continue;
    }
    console.error("Supabase order insert failed:", insertError);
    adminEmailWarning = INTERNAL_ORDER_SAVE_WARNING;
    break;
  }

  const recipients = getOrdersRecipients();
  const emailTasks: Array<Promise<unknown>> = [];
  const firstCustomItem = order.customItems?.[0];
  const customPreviews = (order.customItems ?? []).map((item, index) => ({
    orderNumber: context.orderNumbers.customOrderNumbers?.[index] ?? null,
    previewSvg: item.previewSvg ?? null,
    previewPngDataUrl: item.previewPngDataUrl ?? null,
  }));
  const summaryEmailPayloadPromise = buildAdminOrderSummaryEmailPayload({
    orderPayloads: context.orderPayloads,
    orderNumber: context.orderNumbers.baseOrderNumber,
    requestedDate: context.dueDate ?? null,
    billing: context.billing,
    pickup: context.pickup,
    paymentMethod: paymentMethodTitle,
    paymentAmount: context.totalAmount,
    customPreviewSvg: firstCustomItem?.previewSvg ?? null,
    customPreviewPngDataUrl: firstCustomItem?.previewPngDataUrl ?? null,
    customPreviews,
  });

  if (customerEmail) {
    emailTasks.push(
      summaryEmailPayloadPromise.then((summary) => sendCustomerOrderSummaryEmail([customerEmail], summary)),
    );
  }

  if (!isEmailConfigured() || recipients.length === 0) {
    adminEmailWarning = "Admin email not wired up.";
  } else {
    emailTasks.push(
      summaryEmailPayloadPromise.then((summary) => sendAdminOrderSummaryEmail(recipients, summary)),
    );
  }

  if (emailTasks.length > 0) {
    const emailResult = await Promise.race([
      Promise.allSettled(emailTasks).then((results) => ({ kind: "results" as const, results })),
      new Promise<{ kind: "timeout" }>((resolve) => setTimeout(() => resolve({ kind: "timeout" }), EMAIL_WAIT_MS)),
    ]);

    if (emailResult.kind === "timeout") {
      adminEmailWarning = adminEmailWarning ?? "Email sending timed out (order still placed).";
    } else if (emailResult.results.some((result) => result.status === "rejected")) {
      adminEmailWarning = "Some order emails failed to send.";
    }
  }

  return {
    orderNumber: context.orderNumbers.baseOrderNumber,
    trackingTransactionId: buildTrackingTransactionId(context.orderNumbers.baseOrderNumber, transactionId),
    orderTotal: context.totalAmount,
    tax: context.taxAmount,
    shipping: context.shippingAmount,
    adminEmailWarning,
  };
}
