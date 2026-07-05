import type { Category, LabelRange, PackagingOption, SettingsRow, WeightTier } from "@/lib/data";
import type { CustomPricingInput } from "@/lib/customPricingInput";
export {
  buildCustomPricingInput,
  buildJacketExtras,
  hasIngredientLabelsRequested,
} from "@/lib/customPricingInput";

export type PricingInput = CustomPricingInput;

export type PricingBreakdown = {
  basePrice: number;
  packagingPrice: number;
  labelsPrice: number;
  ingredientLabelsPrice: number;
  extrasPrice: number;
  urgencyFee: number;
  total: number;
  totalWeightKg: number;
  items: Array<{ label: string; amount: number }>;
};

export type PricingContext = {
  categories: Category[];
  tiers: WeightTier[];
  packagingOptions: PackagingOption[];
  labelRanges: LabelRange[];
  settings: SettingsRow;
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
  return sortedTiers.find((t) => {
    const minKg = Number(t.min_kg);
    const maxKg = effectiveTierMaxKg(sortedTiers, t, configuredMaxKg);
    return weightKg >= minKg && weightKg <= maxKg;
  });
}

function findLabelRange(labelRanges: LabelRange[], count: number) {
  const sorted = [...labelRanges].sort((a, b) => a.upper_bound - b.upper_bound);
  return sorted.find((r) => count <= r.upper_bound);
}

export async function calculatePricing(input: PricingInput): Promise<PricingBreakdown> {
  const context = await buildPricingContext();
  return calculatePricingWithContext(input, context);
}

export async function buildPricingContext(): Promise<PricingContext> {
  const { getCategories, getLabelRanges, getPackagingOptions, getSettings, getWeightTiers } = await import(
    "@/lib/data"
  );
  const [categories, tiers, packagingOptions, labelRanges, settings] = await Promise.all([
    getCategories(),
    getWeightTiers(),
    getPackagingOptions(),
    getLabelRanges(),
    getSettings(),
  ]);
  return { categories, tiers, packagingOptions, labelRanges, settings };
}

export function calculatePricingWithContext(input: PricingInput, context: PricingContext): PricingBreakdown {
  const { categories, tiers, packagingOptions, labelRanges, settings } = context;
  const category = categories.find((c) => c.id === input.categoryId);
  if (!category) {
    throw new Error("Invalid category");
  }

  const selectedPackaging = input.packaging.map((sel) => {
    const option = packagingOptions.find((p) => p.id === sel.optionId);
    if (!option) {
      throw new Error("Invalid packaging option");
    }
    if (!option.allowed_categories.includes(category.id)) {
      throw new Error("Packaging not allowed for this category");
    }
    if (sel.quantity < 0 || sel.quantity > option.max_packages) {
      throw new Error("Packaging quantity out of range");
    }
    return { option, quantity: sel.quantity };
  });

  const totalWeightG = selectedPackaging.reduce(
    (sum, sel) => sum + Number(sel.option.candy_weight_g) * sel.quantity,
    0
  );
  const totalWeightKg = totalWeightG / 1000;

  if (totalWeightKg > Number(settings.max_total_kg)) {
    throw new Error("Total weight exceeds limit");
  }

  const categoryTiers = sortTiersByRange(tiers.filter((t) => t.category_id === category.id));
  const matchedTier = findTierForWeight(categoryTiers, totalWeightKg, settings.max_total_kg);
  if (!matchedTier) {
    throw new Error("No pricing tier matches weight");
  }

  // If tier is per_kg, apply previous flat tier (if any) plus per-kg for the weight above that tier's min.
  let basePrice = 0;
  if (matchedTier.per_kg) {
    const priorFlat = categoryTiers
      .filter((t) => !t.per_kg && Number(t.max_kg) <= Number(matchedTier.min_kg))
      .sort((a, b) => Number(b.max_kg) - Number(a.max_kg))[0];

    const matchedMaxKg = effectiveTierMaxKg(categoryTiers, matchedTier, settings.max_total_kg);
    const spanKg = Math.min(totalWeightKg, matchedMaxKg) - Number(matchedTier.min_kg);
    const weightInTier = Math.max(0, spanKg); // use exact kg (can be fractional)
    basePrice = (priorFlat ? Number(priorFlat.price) : 0) + Number(matchedTier.price) * weightInTier;
  } else {
    basePrice = Number(matchedTier.price);
  }

  const packagingPrice = selectedPackaging.reduce(
    (sum, sel) => sum + Number(sel.option.unit_price) * sel.quantity,
    0
  );

  const labelsCount = input.labelsCount ?? 0;
  if (labelsCount > Number(settings.labels_max_bulk)) {
    throw new Error("Label count exceeds maximum");
  }
  let labelsPrice = 0;
  if (labelsCount > 0) {
    const sortedRanges = [...labelRanges].sort((a, b) => a.upper_bound - b.upper_bound);
    const range = findLabelRange(sortedRanges, labelsCount) ?? sortedRanges[sortedRanges.length - 1];
    if (!range) {
      throw new Error("Label count exceeds supported ranges");
    }
    labelsPrice =
      (labelsCount * Number(range.range_cost) + Number(settings.labels_supplier_shipping)) *
      Number(settings.labels_markup_multiplier);
  }

  const ingredientLabelsCountRaw = Number(input.ingredientLabelsCount ?? 0);
  const ingredientLabelsCount = Number.isFinite(ingredientLabelsCountRaw)
    ? Math.max(0, Math.floor(ingredientLabelsCountRaw))
    : 0;
  if (ingredientLabelsCount > Number(settings.labels_max_bulk)) {
    throw new Error("Ingredient label count exceeds maximum");
  }
  const ingredientLabelPrice = Number(settings.ingredient_label_price ?? 0);
  const ingredientLabelsPrice =
    ingredientLabelsCount > 0 && ingredientLabelPrice > 0
      ? ingredientLabelsCount * ingredientLabelPrice
      : 0;

  const extrasPrice = (input.extras ?? []).reduce((sum, extra) => {
    if (!extra.jacket) return sum;
    if (extra.jacket === "rainbow") return sum + Number(settings.jacket_rainbow);
    if (extra.jacket === "two_colour") return sum + Number(settings.jacket_two_colour);
    if (extra.jacket === "pinstripe") return sum + Number(settings.jacket_pinstripe);
    return sum;
  }, 0);

  const subtotalBeforeUrgency = basePrice + packagingPrice + labelsPrice + ingredientLabelsPrice + extrasPrice;
  const urgencyFee = (() => {
    if (!input.dueDate) return 0;
    const due = new Date(input.dueDate);
    const now = new Date();
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > settings.lead_time_days) return 0;
    return subtotalBeforeUrgency * (Number(settings.urgency_fee) / 100);
  })();

  const total = subtotalBeforeUrgency + urgencyFee;

  return {
    basePrice,
    packagingPrice,
    labelsPrice,
    ingredientLabelsPrice,
    extrasPrice,
    urgencyFee,
    total,
    totalWeightKg,
    items: [
      { label: "Base", amount: basePrice },
      {
        label: `Packaging (qty - ${selectedPackaging.reduce((sum, sel) => sum + sel.quantity, 0)})`,
        amount: packagingPrice,
      },
      { label: "Custom Labels", amount: labelsPrice },
      { label: "Ingredient labels", amount: ingredientLabelsPrice },
      { label: "Extras", amount: extrasPrice },
      { label: "Urgency", amount: urgencyFee },
    ],
  };
}
