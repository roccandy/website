import { NextResponse } from "next/server";
import { supabaseServerClient } from "@/lib/supabase/server";
import { refundSquarePayment, refundPayPalCapture } from "@/lib/refunds";
import { updateWooOrder } from "@/lib/woo";
import { sendCustomerRefundEmail } from "@/lib/email";

type RefundRequest = {
  orderId: string;
  amount?: number;
  reason?: string;
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

    const reason = body.reason?.toString().trim() || null;

    if (provider === "square") {
      const cents = Math.round(amount * 100);
      await refundSquarePayment(transactionId, cents, reason);
    } else if (provider === "paypal") {
      await refundPayPalCapture(transactionId, amount.toFixed(2), reason);
    } else {
      return NextResponse.json({ error: "Unsupported payment provider." }, { status: 400 });
    }

    const refundedAt = new Date().toISOString();
    await client
      .from("orders")
      .update({
        status: "refunded",
        refunded_at: refundedAt,
        refund_reason: reason,
        woo_order_status: "refunded",
      })
      .eq("id", order.id);

    if (order.woo_order_id) {
      await updateWooOrder(String(order.woo_order_id), { status: "refunded" });
    }

    if (order.customer_email) {
      await sendCustomerRefundEmail([order.customer_email], {
        orderNumber: order.order_number ?? null,
        amount,
        paymentMethod: order.payment_method ?? order.payment_provider ?? null,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Refund failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
