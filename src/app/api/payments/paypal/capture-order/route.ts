import { NextResponse } from "next/server";
import { buildWooOrderContext } from "@/lib/checkoutOrder";
import { capturePayPalOrder } from "@/lib/paypal";
import { createWooOrder } from "@/lib/woo";
import { supabaseServerClient } from "@/lib/supabase/server";
import { logPaymentFailure } from "@/lib/paymentFailures";
import { getOrdersRecipients, isEmailConfigured, sendCustomerOrderEmail, sendOrderEmail } from "@/lib/email";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import type { CheckoutOrderPayload } from "@/lib/checkoutTypes";

type PayPalCaptureRequest = {
  orderId: string;
  order: CheckoutOrderPayload;
};

const EMAIL_WAIT_MS = 4000;

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = rateLimit(`payments:paypal:capture:${ip}`, { windowMs: 5 * 60 * 1000, max: 20 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many payment attempts. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }
  try {
    const body = (await request.json()) as PayPalCaptureRequest;
    if (!body?.order || !body.orderId) {
      return NextResponse.json({ error: "Order payload and PayPal order ID are required." }, { status: 400 });
    }

    const capture = await capturePayPalOrder(body.orderId);
    const transactionId = capture.captureId || capture.id;

    const { billing, dueDate, pickup, lineItems, feeLines, orderPayloads, orderNumbers, totalAmount } = await buildWooOrderContext(body.order);
    const customerEmail = body.order.customer?.email?.trim() || null;

    const wooOrder = await createWooOrder({
      status: "processing",
      set_paid: true,
      payment_method: "paypal",
      payment_method_title: "PayPal",
      transaction_id: transactionId,
      billing,
      shipping: pickup ? billing : billing,
      customer_note: dueDate ? `Requested date: ${dueDate}` : undefined,
      line_items: lineItems,
      fee_lines: feeLines,
      meta_data: [
        { key: "rc_source", value: "roccandy-next" },
        { key: "rc_due_date", value: dueDate ?? "" },
        { key: "rc_pickup", value: pickup ? "true" : "false" },
        { key: "rc_payment_provider", value: "paypal" },
      ],
    });

    const paidAt = new Date().toISOString();
    const enrichedPayloads = orderPayloads.map((payload) => ({
      ...payload,
      woo_order_id: String(wooOrder.id),
      woo_order_status: wooOrder.status ?? null,
      woo_order_key: wooOrder.order_key ?? null,
      woo_payment_url: null,
      payment_method: "PayPal",
      status: "pending",
      paid_at: paidAt,
      payment_provider: "paypal",
      payment_transaction_id: transactionId ?? null,
    }));

    const { error: insertError } = await supabaseServerClient.from("orders").insert(enrichedPayloads);
    if (insertError) {
      console.error("Supabase order insert failed:", insertError);
    }

    const recipients = getOrdersRecipients();
    let adminEmailWarning: string | null = null;
    const emailTasks: Array<Promise<unknown>> = [];

    if (customerEmail) {
      emailTasks.push(
        sendCustomerOrderEmail([customerEmail], {
          orderNumber: orderNumbers.baseOrderNumber,
          items: orderPayloads.map((item) => ({
            title: String(item.title ?? "Order item"),
            quantity: Number(item.quantity ?? 1),
          })),
          dueDate: dueDate ?? null,
          paymentMethod: "PayPal",
          pickup,
          addressLine1: billing.address_1 || null,
          addressLine2: billing.address_2 || null,
          suburb: billing.city || null,
          state: billing.state || null,
          postcode: billing.postcode || null,
          totalPrice: totalAmount,
        })
      );
    }

    if (!isEmailConfigured() || recipients.length === 0) {
      adminEmailWarning = "Admin email not wired up.";
    } else {
      emailTasks.push(
        ...orderPayloads.map((payload) =>
          sendOrderEmail(recipients, {
            orderNumber: payload.order_number as string | null,
            title: payload.title as string | null,
            designType: payload.design_type as string | null,
            quantity: payload.quantity as number | null,
            dueDate: payload.due_date as string | null,
            customerName: payload.customer_name as string | null,
            customerEmail: customerEmail ?? null,
            totalWeightKg: payload.total_weight_kg as number | null,
            totalPrice: payload.total_price as number | null,
            notes: payload.notes as string | null,
          })
        )
      );
    }

    if (emailTasks.length > 0) {
      const emailResult = await Promise.race([
        Promise.allSettled(emailTasks).then((results) => ({ kind: "results" as const, results })),
        new Promise<{ kind: "timeout" }>((resolve) =>
          setTimeout(() => resolve({ kind: "timeout" }), EMAIL_WAIT_MS)
        ),
      ]);

      if (emailResult.kind === "timeout") {
        adminEmailWarning = adminEmailWarning ?? "Email sending timed out (order still placed).";
      } else if (emailResult.results.some((result) => result.status === "rejected")) {
        adminEmailWarning = "Some order emails failed to send.";
      }
    }

    return NextResponse.json({ ok: true, wooOrderId: wooOrder.id, adminEmailWarning });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to capture PayPal order.";
    await logPaymentFailure({
      provider: "paypal",
      stage: "capture",
      message,
    });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
