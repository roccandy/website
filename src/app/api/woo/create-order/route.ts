import { NextResponse } from "next/server";
import { createWooOrder } from "@/lib/woo";
import { supabaseServerClient } from "@/lib/supabase/server";
import { buildWooOrderContext } from "@/lib/checkoutOrder";
import type { CheckoutOrderPayload } from "@/lib/checkoutTypes";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CheckoutOrderPayload;
    const { billing, dueDate, pickup, paymentPreference, lineItems, orderPayloads } =
      await buildWooOrderContext(body);

    const wooOrder = await createWooOrder({
      status: "pending",
      set_paid: false,
      billing,
      shipping: pickup ? billing : billing,
      customer_note: dueDate ? `Requested date: ${dueDate}` : undefined,
      line_items: lineItems,
      meta_data: [
        { key: "rc_source", value: "roccandy-next" },
        { key: "rc_due_date", value: dueDate ?? "" },
        { key: "rc_pickup", value: pickup ? "true" : "false" },
        ...(paymentPreference ? [{ key: "rc_payment_preference", value: paymentPreference }] : []),
      ],
    });

    if (!wooOrder?.payment_url) {
      return NextResponse.json({ error: "Woo payment URL missing." }, { status: 500 });
    }

    const enrichedPayloads = orderPayloads.map((payload) => ({
      ...payload,
      woo_order_id: String(wooOrder.id),
      woo_order_status: wooOrder.status ?? null,
      woo_order_key: wooOrder.order_key ?? null,
      woo_payment_url: wooOrder.payment_url ?? null,
    }));

    const { error: insertError } = await supabaseServerClient.from("orders").insert(enrichedPayloads);
    if (insertError) {
      console.error("Supabase order insert failed:", insertError);
    }

    return NextResponse.json({ paymentUrl: wooOrder.payment_url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create Woo order";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
