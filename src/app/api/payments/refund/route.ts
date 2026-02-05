import { NextResponse } from "next/server";
import { supabaseServerClient } from "@/lib/supabase/server";
import { refundSquarePayment, refundPayPalCapture } from "@/lib/refunds";
import { updateWooOrder } from "@/lib/woo";

type RefundRequest = {
  orderId: string;
  amount?: number;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RefundRequest;
    if (!body?.orderId) {
      return NextResponse.json({ error: "Order id is required." }, { status: 400 });
    }

    const client = supabaseServerClient;
    const { data: order, error } = await client.from("orders").select("*").eq("id", body.orderId).maybeSingle();
    if (error || !order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const provider = order.payment_provider;
    const transactionId = order.payment_transaction_id;
    if (!provider || !transactionId) {
      return NextResponse.json({ error: "Payment details missing." }, { status: 400 });
    }

    const amount = Number.isFinite(body.amount ?? NaN) ? Number(body.amount) : Number(order.total_price);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid refund amount." }, { status: 400 });
    }

    if (provider === "square") {
      const cents = Math.round(amount * 100);
      await refundSquarePayment(transactionId, cents);
    } else if (provider === "paypal") {
      await refundPayPalCapture(transactionId, amount.toFixed(2));
    } else {
      return NextResponse.json({ error: "Unsupported payment provider." }, { status: 400 });
    }

    const refundedAt = new Date().toISOString();
    await client
      .from("orders")
      .update({
        status: "refunded",
        refunded_at: refundedAt,
        woo_order_status: "refunded",
      })
      .eq("id", order.id);

    if (order.woo_order_id) {
      await updateWooOrder(String(order.woo_order_id), { status: "refunded" });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Refund failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
