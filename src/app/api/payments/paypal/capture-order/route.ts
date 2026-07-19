import { NextResponse } from "next/server";
import { finalizePaidCheckoutOrder } from "@/lib/checkoutFinalize";
import { buildCheckoutOrderContext } from "@/lib/checkoutOrder";
import { capturePayPalOrder, getPayPalOrder, type PayPalOrderDetails } from "@/lib/paypal";
import { logPaymentFailure } from "@/lib/paymentFailures";
import { toPublicPaymentError } from "@/lib/publicErrorMessages";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import type { CheckoutOrderPayload } from "@/lib/checkoutTypes";

type PayPalCaptureRequest = {
  orderId: string;
  order: CheckoutOrderPayload;
  orderNumber?: string | null;
};

function splitFullName(value?: string) {
  const parts = (value ?? "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

function hydrateOrderWithPayPalCustomer(
  order: CheckoutOrderPayload,
  paypalOrder: PayPalOrderDetails,
): CheckoutOrderPayload {
  const shipping = paypalOrder.purchase_units?.[0]?.shipping;
  const shippingName = splitFullName(shipping?.name?.full_name);
  const payer = paypalOrder.payer;
  const address = shipping?.address;
  const pickup = Boolean(order.pickup);

  return {
    ...order,
    customer: {
      ...order.customer,
      firstName: order.customer.firstName?.trim() || payer?.name?.given_name?.trim() || shippingName.firstName,
      lastName: order.customer.lastName?.trim() || payer?.name?.surname?.trim() || shippingName.lastName,
      email: order.customer.email?.trim() || payer?.email_address?.trim() || "",
      addressLine1: pickup
        ? order.customer.addressLine1
        : address?.address_line_1?.trim() || order.customer.addressLine1?.trim() || "",
      addressLine2: pickup
        ? order.customer.addressLine2
        : address?.address_line_2?.trim() || order.customer.addressLine2?.trim() || "",
      suburb: pickup
        ? order.customer.suburb
        : address?.admin_area_2?.trim() || order.customer.suburb?.trim() || "",
      state: pickup
        ? order.customer.state
        : address?.admin_area_1?.trim() || order.customer.state?.trim() || "",
      postcode: pickup
        ? order.customer.postcode
        : address?.postal_code?.trim() || order.customer.postcode?.trim() || "",
    },
  };
}

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
      return NextResponse.json(
        { error: toPublicPaymentError("Order payload and PayPal order ID are required.") },
        { status: 400 },
      );
    }

    const approvedPayPalOrder = await getPayPalOrder(body.orderId);
    if (approvedPayPalOrder.status !== "APPROVED") {
      throw new Error("PayPal order has not been approved.");
    }
    const hydratedOrder = hydrateOrderWithPayPalCustomer(body.order, approvedPayPalOrder);
    const validatedContext = await buildCheckoutOrderContext(hydratedOrder, {
      baseOrderNumber: body.orderNumber ?? null,
    });
    const approvedAmount = Number(approvedPayPalOrder.purchase_units?.[0]?.amount?.value);
    const approvedCurrency = approvedPayPalOrder.purchase_units?.[0]?.amount?.currency_code;
    const deliveryCountry = approvedPayPalOrder.purchase_units?.[0]?.shipping?.address?.country_code;
    if (!hydratedOrder.pickup && deliveryCountry !== "AU") {
      throw new Error("PayPal delivery address must be in Australia.");
    }
    if (
      !Number.isFinite(approvedAmount) ||
      Math.abs(approvedAmount - validatedContext.totalAmount) > 0.001 ||
      approvedCurrency !== "AUD"
    ) {
      throw new Error("PayPal order amount could not be verified.");
    }

    const capture = await capturePayPalOrder(body.orderId);
    const transactionId = capture.captureId || capture.id;

    const result = await finalizePaidCheckoutOrder({
      order: hydratedOrder,
      paymentProvider: "paypal",
      paymentMethod: "paypal",
      paymentMethodTitle: "PayPal",
      transactionId,
      baseOrderNumber: body.orderNumber ?? null,
    });

    return NextResponse.json({
      ok: true,
      ...result,
      customer: hydratedOrder.customer,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to capture PayPal order.";
    await logPaymentFailure({
      provider: "paypal",
      stage: "capture",
      message,
    });
    return NextResponse.json({ error: toPublicPaymentError(message) }, { status: 400 });
  }
}
