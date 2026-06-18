import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminAuth";
import { buildPricingContext } from "@/lib/pricing";
import {
  calculateAdminLargeOrderPricingWithContext,
  normalizeAdminBatchWeights,
  type AdminDiscountType,
} from "@/lib/adminLargeOrders";

type AdminQuoteRequest = {
  categoryId?: string;
  packagingOptionId?: string;
  quantity?: number;
  labelsCount?: number;
  ingredientLabelsCount?: number;
  dueDate?: string;
  jacket?: string | null;
  batchWeightsKg?: Array<number | string>;
  discountType?: AdminDiscountType | string | null;
  discountValue?: number | null;
  priceOverride?: number | null;
};

export async function POST(request: Request) {
  try {
    await requireAdminSession();
    const body = (await request.json()) as AdminQuoteRequest;
    const categoryId = body.categoryId?.trim();
    const packagingOptionId = body.packagingOptionId?.trim();
    const quantity = Number(body.quantity);

    if (!categoryId || !packagingOptionId || !Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json({ error: "Order type, packaging, and quantity are required." }, { status: 400 });
    }

    const context = await buildPricingContext();
    const pricing = calculateAdminLargeOrderPricingWithContext(
      {
        categoryId,
        packagingOptionId,
        quantity,
        labelsCount: body.labelsCount ?? null,
        ingredientLabelsCount: body.ingredientLabelsCount ?? null,
        dueDate: body.dueDate || null,
        jacket: body.jacket ?? null,
        batchWeightsKg: normalizeAdminBatchWeights(body.batchWeightsKg ?? []),
        discountType: body.discountType ?? null,
        discountValue: body.discountValue ?? null,
        priceOverride: body.priceOverride ?? null,
      },
      context,
    );

    return NextResponse.json(pricing);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to calculate admin price." },
      { status: 400 },
    );
  }
}
