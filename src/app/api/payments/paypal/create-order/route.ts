import { NextResponse } from "next/server";
import { buildWooOrderContext } from "@/lib/checkoutOrder";
import { createPayPalOrder } from "@/lib/paypal";
import { logPaymentFailure } from "@/lib/paymentFailures";
import type { CheckoutOrderPayload } from "@/lib/checkoutTypes";

type PayPalCreateRequest = {
  order: CheckoutOrderPayload;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PayPalCreateRequest;
    if (!body?.order) {
      return NextResponse.json({ error: "Order payload is required." }, { status: 400 });
    }
    const { totalAmount } = await buildWooOrderContext(body.order);
    const created = await createPayPalOrder(totalAmount, "AUD");
    return NextResponse.json({ orderId: created.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create PayPal order.";
    await logPaymentFailure({
      provider: "paypal",
      stage: "create",
      message,
    });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
