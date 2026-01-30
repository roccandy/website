import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseServerClient } from "@/lib/supabase/server";
import { getOrdersRecipients, sendOrderEmail } from "@/lib/email";

type WooWebhookPayload = {
  id?: number;
  status?: string;
  date_paid?: string | null;
  payment_method_title?: string | null;
};

function verifySignature(rawBody: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const computed = createHmac("sha256", secret).update(rawBody).digest("base64");
  const computedBuf = Buffer.from(computed);
  const signatureBuf = Buffer.from(signature);
  if (computedBuf.length !== signatureBuf.length) return false;
  return timingSafeEqual(computedBuf, signatureBuf);
}

export async function POST(request: Request) {
  const secret = process.env.WOO_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "Webhook secret is not configured." }, { status: 500 });
  }
  const rawBody = await request.text();
  const signature = request.headers.get("x-wc-webhook-signature");

  if (secret && !verifySignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let payload: WooWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WooWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  if (!payload?.id) {
    return NextResponse.json({ error: "Missing Woo order id." }, { status: 400 });
  }

  const status = payload.status ?? null;
  const paidAt = payload.date_paid ? new Date(payload.date_paid).toISOString() : null;
  const paid = status === "processing" || status === "completed";

  const client = supabaseServerClient;
  const { data: orders, error: fetchError } = await client
    .from("orders")
    .select("*")
    .eq("woo_order_id", String(payload.id));

  if (fetchError) {
    console.error("Woo webhook fetch failed:", fetchError);
    return NextResponse.json({ error: "Fetch failed." }, { status: 500 });
  }

  if (!orders || orders.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const unpaidOrders = orders.filter((order) => !order.paid_at);
  const updates: Record<string, unknown> = {
    woo_order_status: status,
  };
  if (paid && paidAt) {
    updates.paid_at = paidAt;
    updates.status = "pending";
  }
  if (payload.payment_method_title) {
    updates.payment_method = payload.payment_method_title;
  }

  const { error: updateError } = await client
    .from("orders")
    .update(updates)
    .eq("woo_order_id", String(payload.id));

  if (updateError) {
    console.error("Woo webhook update failed:", updateError);
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }

  if (paid && paidAt && unpaidOrders.length > 0) {
    const recipients = getOrdersRecipients();
    if (recipients.length > 0) {
      for (const order of unpaidOrders) {
        try {
          await sendOrderEmail(recipients, {
            orderNumber: order.order_number ?? null,
            title: order.title ?? null,
            designType: order.design_type ?? null,
            quantity: order.quantity ?? null,
            dueDate: order.due_date ?? null,
            customerName: order.customer_name ?? null,
            customerEmail: order.customer_email ?? null,
            totalWeightKg: order.total_weight_kg ?? null,
            totalPrice: order.total_price ?? null,
            notes: order.notes ?? null,
          });
        } catch (error) {
          console.error("Woo payment email failed:", error);
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}
