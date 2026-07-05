import type { PricingContext, PricingBreakdown } from "@/lib/pricing";
import type { WeightTier } from "@/lib/data";
import { buildJacketExtras, type JacketExtraSelection } from "@/lib/customPricingInput";

export const MAX_ADMIN_BATCH_COUNT = 20;
const KG_TOLERANCE = 0.02;

export type AdminDiscountType = "none" | "percent" | "fixed";

export type AdminLargeOrderPricingInput = {
  categoryId: string;
  packagingOptionId: string;
  quantity: number;
  labelsCount?: number | null;
  ingredientLabelsCount?: number | null;
  dueDate?: string | null;
  jacket?: string | null;
  jacketExtras?: JacketExtraSelection[] | null;
  batchWeightsKg?: number[] | null;
  discountType?: AdminDiscountType | string | null;
  discountValue?: number | null;
  priceOverride?: number | null;
};

export type AdminLargeOrderPricingBreakdown = PricingBreakdown & {
  batchWeightsKg: number[];
  batchBasePrices: Array<{ weightKg: number; amount: number }>;
  discountType: AdminDiscountType;
  discountAmount: number;
  priceOverride: number | null;
  subtotalBeforeDiscount: number;
};

function sortTiersByRange(tiers: WeightTier[]) {
  return [...tiers].sort((a, b) => Number(a.min_kg) - Number(b.min_kg) || Number(a.max_kg) - Number(b.max_kg));
}

function effectiveTierMaxKg(sortedTiers: WeightTier[], tier: WeightTier, configuredMaxKg?: number | null) {
  const savedMax = Number(tier.max_kg);
  const configuredMax = Number(configuredMaxKg);
  const lastTier = sortedTiers[sortedTiers.length - 1] ?? null;

  if (lastTier === tier && Number.isFinite(configuredMax) && configuredMax > savedMax) {
    return configuredMax;
  }

  return savedMax;
}

function findTierForWeight(tiers: WeightTier[], weightKg: number, configuredMaxKg?: number | null) {
  const sortedTiers = sortTiersByRange(tiers);
  return sortedTiers.find((tier) => {
    const minKg = Number(tier.min_kg);
    const maxKg = effectiveTierMaxKg(sortedTiers, tier, configuredMaxKg);
    const isFinalTier = sortedTiers[sortedTiers.length - 1] === tier;
    return weightKg >= minKg && (weightKg <= maxKg || isFinalTier);
  });
}

function basePriceForBatch(tiers: WeightTier[], weightKg: number, configuredMaxKg?: number | null) {
  const sortedTiers = sortTiersByRange(tiers);
  const matchedTier = findTierForWeight(sortedTiers, weightKg, configuredMaxKg);
  if (!matchedTier) {
    throw new Error(`No pricing tier matches ${formatKg(weightKg)} batch weight.`);
  }

  if (!matchedTier.per_kg) {
    return Number(matchedTier.price);
  }

  const priorFlat = sortedTiers
    .filter((tier) => !tier.per_kg && Number(tier.max_kg) <= Number(matchedTier.min_kg))
    .sort((a, b) => Number(b.max_kg) - Number(a.max_kg))[0];
  const isFinalTier = sortedTiers[sortedTiers.length - 1] === matchedTier;
  const matchedMaxKg = isFinalTier
    ? Math.max(effectiveTierMaxKg(sortedTiers, matchedTier, configuredMaxKg), weightKg)
    : effectiveTierMaxKg(sortedTiers, matchedTier, configuredMaxKg);
  const spanKg = Math.min(weightKg, matchedMaxKg) - Number(matchedTier.min_kg);
  return (priorFlat ? Number(priorFlat.price) : 0) + Number(matchedTier.price) * Math.max(0, spanKg);
}

function findLabelRange(context: PricingContext, count: number) {
  const sorted = [...context.labelRanges].sort((a, b) => a.upper_bound - b.upper_bound);
  return sorted.find((range) => count <= range.upper_bound) ?? sorted[sorted.length - 1] ?? null;
}

function formatKg(value: number) {
  return `${Number(value).toFixed(2).replace(/\.?0+$/, "")}kg`;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function roundKg(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeDiscountType(value: AdminLargeOrderPricingInput["discountType"]): AdminDiscountType {
  if (value === "percent" || value === "fixed") return value;
  return "none";
}

export function normalizeAdminBatchWeights(values: Array<number | string | null | undefined>) {
  return values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0)
    .map(roundKg);
}

export function suggestedAdminBatchWeights(totalWeightKg: number, maxBatchKg: number) {
  if (!Number.isFinite(totalWeightKg) || totalWeightKg <= 0) return [];
  const safeMax = Number.isFinite(maxBatchKg) && maxBatchKg > 0 ? maxBatchKg : totalWeightKg;
  const count = Math.max(1, Math.ceil(totalWeightKg / safeMax));
  if (count > MAX_ADMIN_BATCH_COUNT) {
    return [];
  }

  const base = Math.floor((totalWeightKg / count) * 100) / 100;
  const weights = Array.from({ length: count }, () => base);
  const allocatedBeforeLast = weights.slice(0, -1).reduce((sum, weight) => sum + weight, 0);
  weights[weights.length - 1] = roundKg(totalWeightKg - allocatedBeforeLast);
  return weights;
}

export function validateAdminBatchWeights({
  weights,
  totalWeightKg,
}: {
  weights: number[];
  totalWeightKg: number;
}) {
  if (weights.length === 0) {
    throw new Error("At least one production batch is required.");
  }
  if (weights.length > MAX_ADMIN_BATCH_COUNT) {
    throw new Error(`A single order can have at most ${MAX_ADMIN_BATCH_COUNT} production batches.`);
  }
  const invalid = weights.find((weight) => !Number.isFinite(weight) || weight <= 0);
  if (invalid !== undefined) {
    throw new Error("Every production batch must be greater than zero.");
  }
  const allocated = weights.reduce((sum, weight) => sum + weight, 0);
  if (Math.abs(allocated - totalWeightKg) > KG_TOLERANCE) {
    throw new Error("Production batch weights must equal the order's total weight.");
  }
}

export function calculateAdminLargeOrderPricingWithContext(
  input: AdminLargeOrderPricingInput,
  context: PricingContext,
): AdminLargeOrderPricingBreakdown {
  const category = context.categories.find((item) => item.id === input.categoryId);
  if (!category) {
    throw new Error("Invalid category");
  }

  const option = context.packagingOptions.find((item) => item.id === input.packagingOptionId);
  if (!option) {
    throw new Error("Invalid packaging option");
  }
  if (!option.allowed_categories.includes(category.id)) {
    throw new Error("Packaging not allowed for this category");
  }

  const quantity = Number(input.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Packaging quantity is required.");
  }

  const totalWeightKg = roundKg((Number(option.candy_weight_g) * quantity) / 1000);
  if (!Number.isFinite(totalWeightKg) || totalWeightKg <= 0) {
    throw new Error("Order weight is required.");
  }

  const maxBatchKg = Number(context.settings.max_total_kg);
  const submittedBatchWeights = normalizeAdminBatchWeights(input.batchWeightsKg ?? []);
  const suggestedBatchWeights = suggestedAdminBatchWeights(totalWeightKg, maxBatchKg);
  const batchWeightsKg =
    submittedBatchWeights.length > 0
      ? submittedBatchWeights
      : suggestedBatchWeights.length > 0
        ? suggestedBatchWeights
        : [totalWeightKg];
  validateAdminBatchWeights({ weights: batchWeightsKg, totalWeightKg });

  const categoryTiers = sortTiersByRange(context.tiers.filter((tier) => tier.category_id === category.id));
  const batchBasePrices = batchWeightsKg.map((weightKg) => ({
    weightKg,
    amount: basePriceForBatch(categoryTiers, weightKg, maxBatchKg),
  }));
  const basePrice = batchBasePrices.reduce((sum, item) => sum + item.amount, 0);
  const packagingPrice = Number(option.unit_price) * quantity;

  const labelsCountRaw = Number(input.labelsCount ?? 0);
  const labelsCount = Number.isFinite(labelsCountRaw) && labelsCountRaw > 0 ? Math.floor(labelsCountRaw) : 0;
  if (labelsCount > Number(context.settings.labels_max_bulk)) {
    throw new Error("Label count exceeds maximum");
  }
  const labelRange = labelsCount > 0 ? findLabelRange(context, labelsCount) : null;
  const labelsPrice =
    labelsCount > 0 && labelRange
      ? (labelsCount * Number(labelRange.range_cost) + Number(context.settings.labels_supplier_shipping)) *
        Number(context.settings.labels_markup_multiplier)
      : 0;

  const ingredientLabelsCountRaw = Number(input.ingredientLabelsCount ?? 0);
  const ingredientLabelsCount =
    Number.isFinite(ingredientLabelsCountRaw) && ingredientLabelsCountRaw > 0
      ? Math.floor(ingredientLabelsCountRaw)
      : 0;
  if (ingredientLabelsCount > Number(context.settings.labels_max_bulk)) {
    throw new Error("Ingredient label count exceeds maximum");
  }
  const ingredientLabelPrice = Number(context.settings.ingredient_label_price ?? 0);
  const ingredientLabelsPrice =
    ingredientLabelsCount > 0 && ingredientLabelPrice > 0 ? ingredientLabelsCount * ingredientLabelPrice : 0;

  const extras = input.jacketExtras?.length ? input.jacketExtras : buildJacketExtras(input.jacket);
  const perBatchExtrasPrice = extras.reduce((sum, extra) => {
    if (extra.jacket === "rainbow") return sum + Number(context.settings.jacket_rainbow);
    if (extra.jacket === "two_colour") return sum + Number(context.settings.jacket_two_colour);
    if (extra.jacket === "pinstripe") return sum + Number(context.settings.jacket_pinstripe);
    return sum;
  }, 0);
  const extrasPrice = perBatchExtrasPrice * batchWeightsKg.length;

  const subtotalBeforeUrgency = basePrice + packagingPrice + labelsPrice + ingredientLabelsPrice + extrasPrice;
  const urgencyFee = (() => {
    if (!input.dueDate) return 0;
    const due = new Date(input.dueDate);
    const now = new Date();
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > Number(context.settings.lead_time_days)) return 0;
    return subtotalBeforeUrgency * (Number(context.settings.urgency_fee) / 100);
  })();
  const subtotalBeforeDiscount = subtotalBeforeUrgency + urgencyFee;

  const discountType = normalizeDiscountType(input.discountType);
  const rawDiscountValue = Number(input.discountValue ?? 0);
  const discountValue = Number.isFinite(rawDiscountValue) && rawDiscountValue > 0 ? rawDiscountValue : 0;
  const discountAmount =
    discountType === "percent"
      ? Math.min(subtotalBeforeDiscount, subtotalBeforeDiscount * (Math.min(discountValue, 100) / 100))
      : discountType === "fixed"
        ? Math.min(subtotalBeforeDiscount, discountValue)
        : 0;

  const overrideRaw = Number(input.priceOverride ?? NaN);
  const priceOverride = Number.isFinite(overrideRaw) && overrideRaw >= 0 ? overrideRaw : null;
  const total = priceOverride ?? Math.max(0, subtotalBeforeDiscount - discountAmount);

  return {
    basePrice: roundMoney(basePrice),
    packagingPrice: roundMoney(packagingPrice),
    labelsPrice: roundMoney(labelsPrice),
    ingredientLabelsPrice: roundMoney(ingredientLabelsPrice),
    extrasPrice: roundMoney(extrasPrice),
    urgencyFee: roundMoney(urgencyFee),
    total: roundMoney(total),
    totalWeightKg,
    items: [
      { label: "Batch candy", amount: roundMoney(basePrice) },
      { label: "Packaging", amount: roundMoney(packagingPrice) },
      { label: "Labels", amount: roundMoney(labelsPrice) },
      { label: "Ingredient labels", amount: roundMoney(ingredientLabelsPrice) },
      { label: "Extras", amount: roundMoney(extrasPrice) },
      { label: "Urgency", amount: roundMoney(urgencyFee) },
      { label: "Admin discount", amount: -roundMoney(discountAmount) },
    ].filter((item) => item.amount !== 0),
    batchWeightsKg,
    batchBasePrices: batchBasePrices.map((item) => ({ ...item, amount: roundMoney(item.amount) })),
    discountType,
    discountAmount: roundMoney(discountAmount),
    priceOverride,
    subtotalBeforeDiscount: roundMoney(subtotalBeforeDiscount),
  };
}
