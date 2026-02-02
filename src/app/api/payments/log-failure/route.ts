import { NextResponse } from "next/server";
import { logPaymentFailure } from "@/lib/paymentFailures";

type LogFailureRequest = {
  provider: "square" | "paypal";
  stage: string;
  message: string;
  customerEmail?: string;
  orderTotal?: number;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LogFailureRequest;
    if (!body?.provider || !body.stage || !body.message) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }
    await logPaymentFailure({
      provider: body.provider,
      stage: body.stage,
      message: body.message,
      customerEmail: body.customerEmail ?? null,
      orderTotal: Number.isFinite(body.orderTotal ?? NaN) ? body.orderTotal ?? null : null,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to log failure.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
