import { splitWeddingDesign } from "@/app/quote/quoteBuilderShared";
import type { OrderRow, PackagingOption } from "@/lib/data";

export const WEDDING_HEART = "\u2764\ufe0f";

export function roundKg(value: number) {
  return Math.round(value * 100) / 100;
}

export function formatKgInput(value: number | null | undefined) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "";
  return roundKg(parsed).toFixed(2).replace(/\.?0+$/, "");
}

export function composeWeddingDesign(lineOne: string, lineTwo: string, initials: boolean) {
  const left = initials ? lineOne.trim().toUpperCase() : lineOne.trim();
  const right = initials ? lineTwo.trim().toUpperCase() : lineTwo.trim();
  if (!left && !right) return "";
  return `${left} ${WEDDING_HEART} ${right}`.trim();
}

export function splitWeddingOrderDesign(value?: string | null) {
  return splitWeddingDesign(value);
}

export function parseQuantityFromDescription(value?: string | null) {
  const text = value?.trim() ?? "";
  if (!text) return null;

  const leadingQuantity = text.match(/^(\d+(?:\.\d+)?)\s*x\s+/i);
  if (leadingQuantity) {
    const parsed = Number(leadingQuantity[1]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  const parenthesizedQuantity = text.match(/\bqty\s*:\s*(\d+(?:\.\d+)?)/i);
  if (parenthesizedQuantity) {
    const parsed = Number(parenthesizedQuantity[1]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

export function resolveOrderQuantity(order: Pick<OrderRow, "quantity" | "order_description">) {
  const describedQuantity = parseQuantityFromDescription(order.order_description);
  if (describedQuantity !== null) return describedQuantity;

  const storedQuantity = Number(order.quantity);
  return Number.isFinite(storedQuantity) && storedQuantity > 0 ? storedQuantity : null;
}

export function calculatePackagingWeightKg(
  packagingOption: Pick<PackagingOption, "candy_weight_g"> | null | undefined,
  quantity: number | string | null | undefined,
) {
  const quantityNumber = Number(quantity);
  const candyWeightG = Number(packagingOption?.candy_weight_g);
  if (!Number.isFinite(quantityNumber) || quantityNumber <= 0 || !Number.isFinite(candyWeightG) || candyWeightG <= 0) {
    return null;
  }
  return roundKg((candyWeightG * quantityNumber) / 1000);
}

export function batchWeightsMatchTotal(batchWeights: Array<number | string>, totalWeightKg: number | string | null | undefined) {
  const total = Number(totalWeightKg);
  if (!Number.isFinite(total) || total <= 0) return false;
  const allocated = batchWeights.reduce<number>((sum, weight) => {
    const parsed = Number(weight);
    return sum + (Number.isFinite(parsed) ? parsed : 0);
  }, 0);
  return Math.abs(roundKg(allocated) - roundKg(total)) <= 0.02;
}
