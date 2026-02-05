import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { buildWooOrderContext } from "@/lib/checkoutOrder";
import { createWooOrder } from "@/lib/woo";
import { supabaseServerClient } from "@/lib/supabase/server";
import { logPaymentFailure } from "@/lib/paymentFailures";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import type { CheckoutOrderPayload } from "@/lib/checkoutTypes";

type SquarePaymentRequest = {
  order: CheckoutOrderPayload;
  sourceId: string;
  verificationToken?: string;
  paymentMethodTitle?: string;
};

type SquarePaymentResponse = {
  payment?: {
    id: string;
    status: string;
  };
  errors?: Array<{ detail?: string }>;
};

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = rateLimit(`payments:square:${ip}`, { windowMs: 5 * 60 * 1000, max: 20 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many payment attempts. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }
  try {
    const body = (await request.json()) as SquarePaymentRequest;
    if (!body?.order || !body.sourceId) {
      return NextResponse.json({ error: "Order payload and payment source are required." }, { status: 400 });
    }

    const accessToken = process.env.SQUARE_ACCESS_TOKEN?.trim();
    const locationId = process.env.SQUARE_LOCATION_ID?.trim();
    const apiBase = process.env.SQUARE_API_BASE?.trim() || "https://connect.squareup.com";
    if (!accessToken || !locationId) {
      return NextResponse.json({ error: "Square is not configured." }, { status: 500 });
    }

    const { billing, dueDate, pickup, lineItems, orderPayloads, totalAmount } = await buildWooOrderContext(body.order);
    const customerEmail = body.order.customer?.email ?? null;
    const amountCents = Math.round(totalAmount * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      await logPaymentFailure({
        provider: "square",
        stage: "amount",
        message: "Invalid order total.",
        customerEmail,
        orderTotal: totalAmount,
      });
      return NextResponse.json({ error: "Invalid order total." }, { status: 400 });
    }

    const charge = await fetch(`${apiBase}/v2/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        source_id: body.sourceId,
        idempotency_key: randomUUID(),
        amount_money: { amount: amountCents, currency: "AUD" },
        location_id: locationId,
        verification_token: body.verificationToken || undefined,
        autocomplete: true,
      }),
    });

    const paymentData = (await charge.json().catch(() => ({}))) as SquarePaymentResponse;
    if (!charge.ok || !paymentData.payment?.id) {
      const message = paymentData.errors?.[0]?.detail || "Square payment failed.";
      await logPaymentFailure({
        provider: "square",
        stage: "charge",
        message,
        customerEmail,
        orderTotal: totalAmount,
      });
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const paymentMethodTitle = body.paymentMethodTitle?.trim() || "Square";
    const wooOrder = await createWooOrder({
      status: "processing",
      set_paid: true,
      payment_method: "square",
      payment_method_title: paymentMethodTitle,
      transaction_id: paymentData.payment.id,
      billing,
      shipping: pickup ? billing : billing,
      customer_note: dueDate ? `Requested date: ${dueDate}` : undefined,
      line_items: lineItems,
      meta_data: [
        { key: "rc_source", value: "roccandy-next" },
        { key: "rc_due_date", value: dueDate ?? "" },
        { key: "rc_pickup", value: pickup ? "true" : "false" },
        { key: "rc_payment_provider", value: "square" },
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
    }));

    const { error: insertError } = await supabaseServerClient.from("orders").insert(enrichedPayloads);
    if (insertError) {
      console.error("Supabase order insert failed:", insertError);
    }

    return NextResponse.json({ ok: true, wooOrderId: wooOrder.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to process Square payment.";
    await logPaymentFailure({
      provider: "square",
      stage: "server",
      message,
    });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
