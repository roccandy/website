import { NextResponse } from "next/server";
import { getAdminSession, READ_ONLY_MESSAGE } from "@/lib/adminAuth";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { refundSquarePayment, refundPayPalCapture } from "@/lib/refunds";
import { sendCustomerRefundEmail } from "@/lib/email";
import { persistOrderRefund } from "@/lib/orderRefunds";

type RefundRequest = {
  orderId: string;
  amount?: number;
  reason?: string;
};

const toMoneyCents = (value: number) => Math.round(value * 100);

export async function POST(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (!session.user.canWrite) {
      return NextResponse.json({ error: READ_ONLY_MESSAGE }, { status: 403 });
    }

    const body = (await request.json()) as RefundRequest;
    if (!body?.orderId) {
      return NextResponse.json({ error: "Order id is required." }, { status: 400 });
    }

    const client = supabaseAdminClient;
    const { data: order, error } = await client.from("orders").select("*").eq("id", body.orderId).maybeSingle();
    if (error || !order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const provider = order.payment_provider;
    const transactionId = order.payment_transaction_id;
    if (!provider || !transactionId) {
      return NextResponse.json({ error: "Payment details missing." }, { status: 400 });
    }

    const orderAmount = Number(order.total_price);
    const orderAmountCents = toMoneyCents(orderAmount);
    const amount = Number.isFinite(body.amount ?? NaN) ? Number(body.amount) : orderAmount;
    const amountCents = toMoneyCents(amount);
    if (!Number.isFinite(amount) || !Number.isFinite(orderAmount) || amountCents <= 0) {
      return NextResponse.json({ error: "Invalid refund amount." }, { status: 400 });
    }
    if (amountCents > orderAmountCents) {
      return NextResponse.json(
        { error: "Refund amount cannot be higher than the order total." },
        { status: 400 }
      );
    }
    const refundAmount = amountCents / 100;
    const isPartialRefund = amountCents < orderAmountCents;

    const reason = body.reason?.toString().trim() || null;

    if (provider === "square") {
      await refundSquarePayment(transactionId, amountCents, reason);
    } else if (provider === "paypal") {
      await refundPayPalCapture(transactionId, refundAmount.toFixed(2), reason);
    } else {
      return NextResponse.json({ error: "Unsupported payment provider." }, { status: 400 });
    }

    await persistOrderRefund({
      client,
      order,
      refundReason: reason,
      isPartialRefund,
    });

    if (order.customer_email) {
      await sendCustomerRefundEmail([order.customer_email], {
        orderNumber: order.order_number ?? null,
        amount: refundAmount,
        paymentMethod: order.payment_method ?? order.payment_provider ?? null,
        reason,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Refund failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
