import { NextResponse } from "next/server";
import { getAdminSession, READ_ONLY_MESSAGE } from "@/lib/adminAuth";
import { supabaseServerClient } from "@/lib/supabase/server";
import { refundSquarePayment, refundPayPalCapture } from "@/lib/refunds";
import { sendCustomerRefundEmail } from "@/lib/email";
import { persistOrderRefund } from "@/lib/orderRefunds";

type RefundRequest = {
  orderId: string;
  amount?: number;
  reason?: string;
};

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

    const orderAmount = Number(order.total_price);
    const amount = Number.isFinite(body.amount ?? NaN) ? Number(body.amount) : orderAmount;
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid refund amount." }, { status: 400 });
    }
    if (Number.isFinite(orderAmount) && Math.abs(amount - orderAmount) > 0.009) {
      return NextResponse.json(
        { error: "Custom refund amounts are not supported here. Refund the split order row separately instead." },
        { status: 400 }
      );
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

    await persistOrderRefund({
      client,
      order,
      refundReason: reason,
    });

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
