import { NextResponse } from "next/server";
import { finalizePaidCheckoutOrder } from "@/lib/checkoutFinalize";
import { toPublicCheckoutError } from "@/lib/publicErrorMessages";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import type { CheckoutOrderPayload } from "@/lib/checkoutTypes";

type PaidOrderRequest = {
  order: CheckoutOrderPayload;
  paymentMethod: string;
  paymentMethodTitle: string;
  transactionId: string;
};

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = rateLimit(`payments:woo:paid:${ip}`, { windowMs: 5 * 60 * 1000, max: 10 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many payment attempts. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }
  try {
    const body = (await request.json()) as PaidOrderRequest;
    if (!body?.order) {
      return NextResponse.json({ error: toPublicCheckoutError("Order payload is required.") }, { status: 400 });
    }
    if (!body.paymentMethod || !body.transactionId) {
      return NextResponse.json({ error: toPublicCheckoutError("Payment details are required.") }, { status: 400 });
    }

    const paymentMethodTitle = body.paymentMethodTitle || body.paymentMethod;
    const result = await finalizePaidCheckoutOrder({
      order: body.order,
      paymentProvider: body.paymentMethod,
      paymentMethod: body.paymentMethod,
      paymentMethodTitle,
      transactionId: body.transactionId,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create paid Woo order";
    return NextResponse.json({ error: toPublicCheckoutError(message) }, { status: 400 });
  }
}
