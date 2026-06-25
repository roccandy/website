import { NextResponse } from "next/server";
import { buildCheckoutOrderContext } from "@/lib/checkoutOrder";
import { createPayPalOrder } from "@/lib/paypal";
import { logPaymentFailure } from "@/lib/paymentFailures";
import { toPublicPaymentError } from "@/lib/publicErrorMessages";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import type { CheckoutOrderPayload } from "@/lib/checkoutTypes";

type PayPalCreateRequest = {
  order: CheckoutOrderPayload;
};

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = rateLimit(`payments:paypal:create:${ip}`, { windowMs: 5 * 60 * 1000, max: 30 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many payment attempts. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }
  try {
    const body = (await request.json()) as PayPalCreateRequest;
    if (!body?.order) {
      return NextResponse.json({ error: toPublicPaymentError("Order payload is required.") }, { status: 400 });
    }
    const { totalAmount, orderNumbers } = await buildCheckoutOrderContext(body.order);
    const created = await createPayPalOrder(totalAmount, "AUD", {
      customId: orderNumbers.baseOrderNumber,
      description: `Roc Candy order ${orderNumbers.baseOrderNumber}`,
    });
    return NextResponse.json({ orderId: created.id, orderNumber: orderNumbers.baseOrderNumber });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create PayPal order.";
    await logPaymentFailure({
      provider: "paypal",
      stage: "create",
      message,
    });
    return NextResponse.json({ error: toPublicPaymentError(message) }, { status: 400 });
  }
}
