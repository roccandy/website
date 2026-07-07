import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { getOrdersRecipients, sendOrderEmail } from "@/lib/email";

type SquareInvoiceWebhookPayload = {
  type?: string;
  created_at?: string;
  data?: {
    id?: string;
    type?: string;
    object?: {
      invoice?: {
        id?: string;
        version?: number;
        status?: string;
        public_url?: string;
        created_at?: string;
        updated_at?: string;
      };
    };
  };
};

function notificationUrl(request: Request) {
  return (
    process.env.SQUARE_INVOICE_WEBHOOK_URL?.trim() ||
    process.env.SQUARE_WEBHOOK_NOTIFICATION_URL?.trim() ||
    new URL(request.url).toString()
  );
}

function verifySquareSignature(input: {
  rawBody: string;
  signature: string | null;
  signatureKey: string;
  url: string;
}) {
  if (!input.signature) return false;
  const computed = createHmac("sha256", input.signatureKey)
    .update(`${input.url}${input.rawBody}`)
    .digest("base64");
  const computedBuffer = Buffer.from(computed);
  const signatureBuffer = Buffer.from(input.signature);
  if (computedBuffer.length !== signatureBuffer.length) return false;
  return timingSafeEqual(computedBuffer, signatureBuffer);
}

function invoiceFromPayload(payload: SquareInvoiceWebhookPayload) {
  const invoice = payload.data?.object?.invoice ?? {};
  return {
    id: invoice.id ?? payload.data?.id ?? null,
    version: Number.isFinite(Number(invoice.version)) ? Number(invoice.version) : null,
    status: invoice.status ?? null,
    publicUrl: invoice.public_url ?? null,
    createdAt: invoice.created_at ?? null,
    updatedAt: invoice.updated_at ?? null,
  };
}

export async function POST(request: Request) {
  const signatureKey =
    process.env.SQUARE_INVOICE_WEBHOOK_SIGNATURE_KEY?.trim() ||
    process.env.SQUARE_WEBHOOK_SIGNATURE_KEY?.trim();
  if (!signatureKey) {
    return NextResponse.json({ error: "Square webhook signature key is not configured." }, { status: 500 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-square-hmacsha256-signature");
  if (
    !verifySquareSignature({
      rawBody,
      signature,
      signatureKey,
      url: notificationUrl(request),
    })
  ) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let payload: SquareInvoiceWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as SquareInvoiceWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const eventType = payload.type ?? "";
  const invoice = invoiceFromPayload(payload);
  if (!invoice.id) {
    return NextResponse.json({ error: "Missing invoice id." }, { status: 400 });
  }

  const client = supabaseAdminClient;
  const { data: orders, error: fetchError } = await client
    .from("orders")
    .select("id,order_number,title,design_type,quantity,flavor,due_date,customer_name,customer_email,total_weight_kg,total_price,notes,paid_at")
    .eq("square_invoice_id", invoice.id);

  if (fetchError) {
    console.error("Square invoice webhook fetch failed:", fetchError);
    return NextResponse.json({ error: "Fetch failed." }, { status: 500 });
  }

  if (!orders || orders.length === 0) {
    return NextResponse.json({ ok: true });
  }
  const orderIds = orders.map((order) => order.id);

  const patch: Record<string, unknown> = {
    square_invoice_status: invoice.status,
    square_invoice_version: invoice.version,
    square_invoice_url: invoice.publicUrl,
    square_invoice_error: null,
  };

  if (eventType === "invoice.published") {
    patch.square_invoice_sent_at = invoice.updatedAt ?? payload.created_at ?? new Date().toISOString();
  }

  if (eventType === "invoice.payment_made") {
    patch.paid_at = payload.created_at ?? new Date().toISOString();
    patch.payment_provider = "square_invoice";
    patch.payment_transaction_id = invoice.id;
    patch.status = "pending";
  }

  const { error: updateError } = await client.from("orders").update(patch).in("id", orderIds);
  if (updateError) {
    console.error("Square invoice webhook update failed:", updateError);
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }

  if (eventType === "invoice.payment_made") {
    const unpaidOrders = orders.filter((order) => !order.paid_at);
    const recipients = getOrdersRecipients();
    if (recipients.length > 0) {
      for (const order of unpaidOrders) {
        try {
          await sendOrderEmail(recipients, {
            orderNumber: order.order_number ?? null,
            title: order.title ?? null,
            designType: order.design_type ?? null,
            quantity: order.quantity ?? null,
            flavor: order.flavor ?? null,
            dueDate: order.due_date ?? null,
            customerName: order.customer_name ?? null,
            customerEmail: order.customer_email ?? null,
            totalWeightKg: order.total_weight_kg ?? null,
            totalPrice: order.total_price ?? null,
            notes: ["Payment received via Square invoice.", order.notes].filter(Boolean).join("\n"),
          });
        } catch (error) {
          console.error("Square invoice paid email failed:", error);
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
