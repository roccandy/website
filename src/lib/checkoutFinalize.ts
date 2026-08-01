import { buildCheckoutOrderContext, type CheckoutOrderContext } from "@/lib/checkoutOrder";
import {
  getOrdersRecipients,
  isEmailConfigured,
  sendAdminOrderSummaryEmail,
  sendCustomerOrderSummaryEmail,
  sendPaidOrderSaveFailureEmail,
} from "@/lib/email";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import type { CheckoutOrderPayload } from "@/lib/checkoutTypes";
import { isCheckoutTestPromoCode } from "@/lib/checkoutPromo";
import { buildAdminOrderSummaryEmailPayload } from "@/lib/orderEmailSummary";
import { normalizeBaseOrderNumber } from "@/lib/orderNumbers";
import { logPaymentFailure } from "@/lib/paymentFailures";

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

async function findExistingPaymentOrder(paymentProvider: string, transactionId: string) {
  const { data, error } = await supabaseAdminClient
    .from("orders")
    .select("order_number")
    .eq("payment_provider", paymentProvider)
    .eq("payment_transaction_id", transactionId);
  if (error) throw new Error("Unable to verify an existing payment order.");
  return data ?? [];
}

function waitForRetry(attempt: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, attempt * 150));
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
}): Array<Record<string, unknown>> {
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

  const existingOrders = await findExistingPaymentOrder(paymentProvider, transactionId).catch(() => []);
  if (existingOrders?.length) {
    const existingOrderNumber = normalizeBaseOrderNumber(existingOrders[0]?.order_number) ?? context.orderNumbers.baseOrderNumber;
    return {
      orderNumber: existingOrderNumber,
      trackingTransactionId: buildTrackingTransactionId(existingOrderNumber, transactionId),
      orderTotal: context.totalAmount,
      tax: context.taxAmount,
      shipping: context.shippingAmount,
      adminEmailWarning: null,
    };
  }

  let adminEmailWarning: string | null = null;
  let orderSaved = false;
  let lastInsertError: string | null = null;
  for (let attempt = 1; attempt <= ORDER_INSERT_ATTEMPTS; attempt += 1) {
    const enrichedPayloads = buildPaidOrderPayloads({
      context,
      paymentProvider,
      paymentMethodTitle,
      transactionId,
      isTestOrder,
      paidAt,
    });
    let insertError: { message?: string } | null = null;
    try {
      const result = await supabaseAdminClient.from("orders").insert(enrichedPayloads);
      insertError = result.error;
    } catch (error) {
      insertError = {
        message: error instanceof Error ? error.message : String(error),
      };
    }
    if (!insertError) {
      orderSaved = true;
      break;
    }
    lastInsertError = insertError.message || String(insertError);
    const concurrentOrders = await findExistingPaymentOrder(paymentProvider, transactionId).catch(() => []);
    if (concurrentOrders.length) {
      const existingOrderNumber =
        normalizeBaseOrderNumber(concurrentOrders[0]?.order_number) ?? context.orderNumbers.baseOrderNumber;
      return {
        orderNumber: existingOrderNumber,
        trackingTransactionId: buildTrackingTransactionId(existingOrderNumber, transactionId),
        orderTotal: context.totalAmount,
        tax: context.taxAmount,
        shipping: context.shippingAmount,
        adminEmailWarning: null,
      };
    }
    if (attempt < ORDER_INSERT_ATTEMPTS && isOrderNumberConflict(insertError)) {
      context = await buildCheckoutOrderContext(order);
      await waitForRetry(attempt);
      continue;
    }
    if (attempt < ORDER_INSERT_ATTEMPTS) {
      await waitForRetry(attempt);
      continue;
    }
    console.error("Supabase order insert failed:", insertError);
    break;
  }

  if (!orderSaved) {
    const recoveryPayloads = buildPaidOrderPayloads({
      context,
      paymentProvider,
      paymentMethodTitle,
      transactionId,
      isTestOrder,
      paidAt,
    });
    await logPaymentFailure({
      provider: paymentProvider === "paypal" ? "paypal" : "square",
      stage: "order_finalization",
      message: [
        `Payment ${transactionId} succeeded for order ${context.orderNumbers.baseOrderNumber}, but the order record could not be saved.`,
        lastInsertError,
      ]
        .filter(Boolean)
        .join(" "),
      customerEmail,
      orderTotal: context.totalAmount,
      transactionId,
      orderNumber: context.orderNumbers.baseOrderNumber,
      checkoutSnapshot: {
        orderPayloads: recoveryPayloads,
        billing: context.billing,
        dueDate: context.dueDate,
        pickup: context.pickup,
        totalAmount: context.totalAmount,
      },
    });
    const alertRecipients = getOrdersRecipients();
    if (isEmailConfigured() && alertRecipients.length > 0) {
      const deliveryAddress = context.pickup
        ? "Pickup"
        : [
            context.billing.address_1,
            context.billing.address_2,
            context.billing.city,
            context.billing.state,
            context.billing.postcode,
          ]
            .filter((part) => part?.trim())
            .join(", ") || "Delivery address missing";
      try {
        await sendPaidOrderSaveFailureEmail(alertRecipients, {
          orderNumber: context.orderNumbers.baseOrderNumber,
          paymentProvider,
          paymentMethod: paymentMethodTitle,
          transactionId,
          paidAt,
          orderTotal: context.totalAmount,
          saveError: lastInsertError,
          customerName: `${context.billing.first_name} ${context.billing.last_name}`.trim(),
          customerEmail,
          customerPhone: context.billing.phone || null,
          requestedDate: context.dueDate,
          deliveryAddress,
          items: recoveryPayloads.map((payload) => {
            const quantity = Number(payload.quantity ?? 1);
            const totalPrice = Number(payload.total_price);
            return {
              orderNumber: String(payload.order_number ?? context.orderNumbers.baseOrderNumber),
              title: String(payload.title ?? "Order item"),
              description:
                typeof payload.order_description === "string" && payload.order_description.trim()
                  ? payload.order_description.trim()
                  : null,
              flavor: typeof payload.flavor === "string" && payload.flavor.trim() ? payload.flavor.trim() : null,
              quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
              totalPrice: Number.isFinite(totalPrice) ? totalPrice : null,
            };
          }),
        });
      } catch (alertError) {
        console.error("Paid order recovery alert email failed:", alertError);
      }
    } else {
      console.error("Paid order recovery alert email is not configured.");
    }
    throw new Error("Order record could not be saved after payment.");
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
