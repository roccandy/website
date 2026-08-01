import { NextResponse } from "next/server";
import { finalizePaidCheckoutOrder } from "@/lib/checkoutFinalize";
import { buildCheckoutOrderContext } from "@/lib/checkoutOrder";
import { capturePayPalOrder, getPayPalOrder } from "@/lib/paypal";
import { logPaymentFailure } from "@/lib/paymentFailures";
import { toPublicPaymentError } from "@/lib/publicErrorMessages";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { verifyCheckoutFingerprint } from "@/lib/checkoutFingerprint";
import type { CheckoutOrderPayload } from "@/lib/checkoutTypes";

type PayPalCaptureRequest = {
  orderId: string;
  order: CheckoutOrderPayload;
  orderNumber?: string | null;
  checkoutState?: string | null;
};

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = rateLimit(`payments:paypal:capture:${ip}`, { windowMs: 5 * 60 * 1000, max: 20 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many payment attempts. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }
  try {
    const body = (await request.json()) as PayPalCaptureRequest;
    if (!body?.order || !body.orderId) {
      return NextResponse.json(
        { error: toPublicPaymentError("Order payload and PayPal order ID are required.") },
        { status: 400 },
      );
    }

    const approvedPayPalOrder = await getPayPalOrder(body.orderId);
    if (approvedPayPalOrder.status !== "APPROVED" && approvedPayPalOrder.status !== "COMPLETED") {
      throw new Error("PayPal order has not been approved.");
    }
    const paypalOrderNumber = approvedPayPalOrder.purchase_units?.[0]?.custom_id?.trim() || null;
    if (
      paypalOrderNumber !== body.orderNumber?.trim() ||
      !verifyCheckoutFingerprint(body.checkoutState, body.order, paypalOrderNumber)
    ) {
      throw new Error("PayPal checkout details could not be verified.");
    }
    const validatedContext = await buildCheckoutOrderContext(body.order, {
      baseOrderNumber: body.orderNumber ?? null,
    });
    const approvedAmount = Number(approvedPayPalOrder.purchase_units?.[0]?.amount?.value);
    const approvedCurrency = approvedPayPalOrder.purchase_units?.[0]?.amount?.currency_code;
    if (
      !Number.isFinite(approvedAmount) ||
      Math.abs(approvedAmount - validatedContext.totalAmount) > 0.001 ||
      approvedCurrency !== "AUD"
    ) {
      throw new Error("PayPal order amount could not be verified.");
    }

    const transactionId =
      approvedPayPalOrder.status === "COMPLETED"
        ? approvedPayPalOrder.purchase_units?.[0]?.payments?.captures?.[0]?.id
        : null;
    const capture = transactionId ? null : await capturePayPalOrder(body.orderId);
    const resolvedTransactionId = transactionId || capture?.captureId || capture?.id;
    if (!resolvedTransactionId) {
      throw new Error("PayPal payment transaction could not be verified.");
    }

    const result = await finalizePaidCheckoutOrder({
      order: body.order,
      paymentProvider: "paypal",
      paymentMethod: "paypal",
      paymentMethodTitle: "PayPal",
      transactionId: resolvedTransactionId,
      checkoutContext: validatedContext,
      baseOrderNumber: body.orderNumber ?? null,
    });

    return NextResponse.json({
      ok: true,
      ...result,
      customer: body.order.customer,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to capture PayPal order.";
    await logPaymentFailure({
      provider: "paypal",
      stage: "capture",
      message,
    });
    return NextResponse.json({ error: toPublicPaymentError(message) }, { status: 400 });
  }
}
