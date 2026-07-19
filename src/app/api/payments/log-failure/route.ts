import { NextResponse } from "next/server";
import { logPaymentFailure } from "@/lib/paymentFailures";
import { getClientIp, rateLimit } from "@/lib/rateLimit";

type LogFailureRequest = {
  provider: "square" | "paypal";
  stage: string;
  message: string;
  customerEmail?: string;
  orderTotal?: number;
};

export async function POST(request: Request) {
  try {
    const limit = rateLimit(`payment-failure:${getClientIp(request)}`, {
      windowMs: 10 * 60 * 1_000,
      max: 20,
    });
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many requests." },
        {
          status: 429,
          headers: { "Retry-After": String(limit.retryAfterSeconds) },
        },
      );
    }

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 10_000) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 413 });
    }

    const body = (await request.json()) as LogFailureRequest;
    const provider = body?.provider;
    const stage = typeof body?.stage === "string" ? body.stage.trim().slice(0, 80) : "";
    const message = typeof body?.message === "string" ? body.message.trim().slice(0, 1_000) : "";
    const customerEmail =
      typeof body?.customerEmail === "string" ? body.customerEmail.trim().slice(0, 254) : null;
    const orderTotal = Number(body?.orderTotal);

    if ((provider !== "square" && provider !== "paypal") || !stage || !message) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }
    await logPaymentFailure({
      provider,
      stage,
      message,
      customerEmail,
      orderTotal: Number.isFinite(orderTotal) && orderTotal >= 0 && orderTotal <= 1_000_000 ? orderTotal : null,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to log failure.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
