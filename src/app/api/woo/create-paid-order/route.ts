import { NextResponse } from "next/server";
import { supabaseServerClient } from "@/lib/supabase/server";
import { buildWooOrderContext } from "@/lib/checkoutOrder";
import { createWooOrder } from "@/lib/woo";
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
      return NextResponse.json({ error: "Order payload is required." }, { status: 400 });
    }
    if (!body.paymentMethod || !body.transactionId) {
      return NextResponse.json({ error: "Payment details are required." }, { status: 400 });
    }

    const { billing, dueDate, pickup, lineItems, orderPayloads } = await buildWooOrderContext(body.order);
    const paymentMethodTitle = body.paymentMethodTitle || body.paymentMethod;

    const wooOrder = await createWooOrder({
      status: "processing",
      set_paid: true,
      payment_method: body.paymentMethod,
      payment_method_title: paymentMethodTitle,
      transaction_id: body.transactionId,
      billing,
      shipping: pickup ? billing : billing,
      customer_note: dueDate ? `Requested date: ${dueDate}` : undefined,
      line_items: lineItems,
      meta_data: [
        { key: "rc_source", value: "roccandy-next" },
        { key: "rc_due_date", value: dueDate ?? "" },
        { key: "rc_pickup", value: pickup ? "true" : "false" },
        { key: "rc_payment_provider", value: body.paymentMethod },
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
    const message = error instanceof Error ? error.message : "Unable to create paid Woo order";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
