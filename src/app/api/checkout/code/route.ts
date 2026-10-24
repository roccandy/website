import { NextResponse } from "next/server";
import { isCheckoutTestPromoCode } from "@/lib/checkoutPromo";
import { getClientIp, rateLimit } from "@/lib/rateLimit";

export async function POST(request: Request) {
  const limit = rateLimit(`checkout-code:${getClientIp(request)}`, { windowMs: 5 * 60 * 1000, max: 10 });
  if (!limit.ok) return NextResponse.json({ error: "Too many code attempts. Please try again later." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds), "Cache-Control": "no-store" } });
  try {
    const body = await request.json();
    return NextResponse.json({ valid: isCheckoutTestPromoCode(body?.code) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to check this code." }, { status: 400 });
  }
}
