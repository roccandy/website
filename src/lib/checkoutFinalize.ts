import { buildWooOrderContext } from "@/lib/checkoutOrder";
import { getOrdersRecipients, isEmailConfigured, sendAdminOrderSummaryEmail, sendCustomerOrderSummaryEmail } from "@/lib/email";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import type { CheckoutOrderPayload } from "@/lib/checkoutTypes";
import { buildAdminOrderSummaryEmailPayload } from "@/lib/orderEmailSummary";
import { createWooOrder } from "@/lib/woo";

const EMAIL_WAIT_MS = 4000;

type FinalizePaidCheckoutInput = {
  order: CheckoutOrderPayload;
  paymentProvider: string;
  paymentMethod: string;
  paymentMethodTitle: string;
  transactionId: string;
};

export type FinalizePaidCheckoutResult = {
  wooOrderId: number;
  orderNumber: string;
  adminEmailWarning: string | null;
};

const INTERNAL_ORDER_SAVE_WARNING =
  "Your payment was received, but we had trouble finalising the order record. Please keep your order number and contact us if you do not receive a confirmation email shortly.";

export async function finalizePaidCheckoutOrder({
  order,
  paymentProvider,
  paymentMethod,
  paymentMethodTitle,
  transactionId,
}: FinalizePaidCheckoutInput): Promise<FinalizePaidCheckoutResult> {
  const { billing, dueDate, pickup, lineItems, feeLines, orderPayloads, orderNumbers, totalAmount } =
    await buildWooOrderContext(order);
  const customerEmail = order.customer?.email?.trim() || null;

  const wooOrder = await createWooOrder({
    status: "processing",
    set_paid: true,
    payment_method: paymentMethod,
    payment_method_title: paymentMethodTitle,
    transaction_id: transactionId,
    billing,
    shipping: pickup ? billing : billing,
    customer_note: dueDate ? `Requested date: ${dueDate}` : undefined,
    line_items: lineItems,
    fee_lines: feeLines,
    meta_data: [
      { key: "rc_source", value: "roccandy-next" },
      { key: "rc_due_date", value: dueDate ?? "" },
      { key: "rc_pickup", value: pickup ? "true" : "false" },
      { key: "rc_payment_provider", value: paymentProvider },
    ],
  });

  const paidAt = new Date().toISOString();
  const enrichedPayloads = orderPayloads.map((payload) => ({
    ...payload,
    woo_order_id: String(wooOrder.id),
    woo_order_status: wooOrder.status ?? null,
    woo_order_key: wooOrder.order_key ?? null,
    woo_payment_url: null,
    payment_method: paymentMethodTitle,
    status: "pending",
    paid_at: paidAt,
    payment_provider: paymentProvider,
    payment_transaction_id: transactionId,
  }));

  let adminEmailWarning: string | null = null;
  const { error: insertError } = await supabaseAdminClient.from("orders").insert(enrichedPayloads);
  if (insertError) {
    console.error("Supabase order insert failed:", insertError);
    adminEmailWarning = INTERNAL_ORDER_SAVE_WARNING;
  }

  const recipients = getOrdersRecipients();
  const emailTasks: Array<Promise<unknown>> = [];
  const firstCustomItem = order.customItems?.[0];
  const summaryEmailPayloadPromise = buildAdminOrderSummaryEmailPayload({
    orderPayloads,
    orderNumber: orderNumbers.baseOrderNumber,
    requestedDate: dueDate ?? null,
    billing,
    pickup,
    paymentMethod: paymentMethodTitle,
    paymentAmount: totalAmount,
    customPreviewSvg: firstCustomItem?.previewSvg ?? null,
    customPreviewPngDataUrl: firstCustomItem?.previewPngDataUrl ?? null,
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
    wooOrderId: wooOrder.id,
    orderNumber: orderNumbers.baseOrderNumber,
    adminEmailWarning,
  };
}
