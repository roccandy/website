import {
  getCategories,
  getLabelRanges,
  getPackagingOptions,
  getSettings,
  getWeightTiers,
  type Category,
  type PackagingOption,
  type SettingsRow,
  type LabelRange,
  type WeightTier,
} from "@/lib/data";

type PackagingSelection = {
  optionId: string;
  quantity: number;
};

type ExtrasSelection = {
  jacket?: "rainbow" | "two_colour" | "pinstripe";
};

export type PricingInput = {
  categoryId: string;
  packaging: PackagingSelection[];
  labelsCount?: number;
  ingredientLabelsCount?: number;
  dueDate?: string; // ISO date string
  extras?: ExtrasSelection[];
};

export type PricingBreakdown = {
  basePrice: number;
  packagingPrice: number;
  labelsPrice: number;
  ingredientLabelsPrice: number;
  extrasPrice: number;
  urgencyFee: number;
  transactionFee: number;
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

function findTierForWeight(tiers: WeightTier[], weightKg: number) {
  return tiers.find((t) => weightKg >= Number(t.min_kg) && weightKg <= Number(t.max_kg));
}

function findLabelRange(labelRanges: LabelRange[], count: number) {
  const sorted = [...labelRanges].sort((a, b) => a.upper_bound - b.upper_bound);
  return sorted.find((r) => count <= r.upper_bound);
}

function calcTransactionFee(subtotal: number, percent: number) {
  return subtotal * (percent / 100);
}

export async function calculatePricing(input: PricingInput): Promise<PricingBreakdown> {
  const context = await buildPricingContext();
  return calculatePricingWithContext(input, context);
}

export async function buildPricingContext(): Promise<PricingContext> {
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

  const categoryTiers = tiers.filter((t) => t.category_id === category.id);
  const matchedTier = findTierForWeight(categoryTiers, totalWeightKg);
  if (!matchedTier) {
    throw new Error("No pricing tier matches weight");
  }

  // If tier is per_kg, apply previous flat tier (if any) plus per-kg for the weight above that tier's min.
  let basePrice = 0;
  if (matchedTier.per_kg) {
    const priorFlat = categoryTiers
      .filter((t) => !t.per_kg && Number(t.max_kg) <= Number(matchedTier.min_kg))
      .sort((a, b) => Number(b.max_kg) - Number(a.max_kg))[0];

    const spanKg = Math.min(totalWeightKg, Number(matchedTier.max_kg)) - Number(matchedTier.min_kg);
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

  const ingredientLabelsCount = Math.max(0, Number(input.ingredientLabelsCount ?? 0));
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

  const subtotal = subtotalBeforeUrgency + urgencyFee;
  const transactionFee = calcTransactionFee(subtotal, Number(settings.transaction_fee_percent));
  const total = subtotal + transactionFee;

  return {
    basePrice,
    packagingPrice,
    labelsPrice,
    ingredientLabelsPrice,
    extrasPrice,
    urgencyFee,
    transactionFee,
    total,
    totalWeightKg,
    items: [
      { label: "Base", amount: basePrice },
      { label: "Packaging", amount: packagingPrice },
      { label: "Labels", amount: labelsPrice },
      { label: "Ingredient labels", amount: ingredientLabelsPrice },
      { label: "Extras", amount: extrasPrice },
      { label: "Urgency", amount: urgencyFee },
      { label: "Transaction fee", amount: transactionFee },
    ],
  };
}
