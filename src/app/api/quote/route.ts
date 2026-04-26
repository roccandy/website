import { NextResponse } from "next/server";
import { calculatePricing, type PricingInput } from "@/lib/pricing";
import { toPublicPricingError } from "@/lib/publicErrorMessages";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PricingInput;

    if (!body.categoryId || !Array.isArray(body.packaging)) {
      return NextResponse.json({ error: toPublicPricingError("Invalid payload") }, { status: 400 });
    }

    const result = await calculatePricing(body);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : null;
    return NextResponse.json({ error: toPublicPricingError(message) }, { status: 400 });
  }
}
