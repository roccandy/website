import { NextResponse } from "next/server";
import { finalizePaidCheckoutOrder } from "@/lib/checkoutFinalize";
import { buildCheckoutOrderContext } from "@/lib/checkoutOrder";
import { capturePayPalOrder, getPayPalOrder } from "@/lib/paypal";
import { logPaymentFailure } from "@/lib/paymentFailures";
import { toPublicPaymentError } from "@/lib/publicErrorMessages";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import type { CheckoutOrderPayload } from "@/lib/checkoutTypes";

type PayPalCaptureRequest = {
  orderId: string;
  order: CheckoutOrderPayload;
  orderNumber?: string | null;
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
    if (approvedPayPalOrder.status !== "APPROVED") {
      throw new Error("PayPal order has not been approved.");
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

    const capture = await capturePayPalOrder(body.orderId);
    const transactionId = capture.captureId || capture.id;

    const result = await finalizePaidCheckoutOrder({
      order: body.order,
      paymentProvider: "paypal",
      paymentMethod: "paypal",
      paymentMethodTitle: "PayPal",
      transactionId,
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
