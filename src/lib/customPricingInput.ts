export type JacketExtraSelection = {
  jacket?: "rainbow" | "two_colour" | "pinstripe";
};

export type CustomPricingSource = {
  categoryId?: string | null;
  packagingOptionId?: string | null;
  quantity?: number | null;
  labelsCount?: number | null;
  ingredientLabelsCount?: number | null;
  ingredientLabelsOptIn?: boolean | null;
  notes?: string | null;
  dueDate?: string | null;
  jacket?: string | null;
  jacketExtras?: JacketExtraSelection[] | null;
};

export type CustomPricingInput = {
  categoryId: string;
  packaging: Array<{
    optionId: string;
    quantity: number;
  }>;
  labelsCount?: number;
  ingredientLabelsCount?: number;
  dueDate?: string;
  extras?: JacketExtraSelection[];
};

const INGREDIENT_LABELS_NOTE = "ingredient labels requested";

export function hasIngredientLabelsRequested(
  input: Pick<CustomPricingSource, "ingredientLabelsOptIn" | "notes">
) {
  if (input.ingredientLabelsOptIn === true) return true;
  if (input.ingredientLabelsOptIn === false) return false;
  return (input.notes ?? "").toLowerCase().includes(INGREDIENT_LABELS_NOTE);
}

export function buildJacketExtras(jacket: string | null | undefined): JacketExtraSelection[] {
  if (!jacket) return [];
  if (jacket === "two_colour_pinstripe") return [{ jacket: "two_colour" }, { jacket: "pinstripe" }];
  if (jacket === "two_colour") return [{ jacket: "two_colour" }];
  if (jacket === "pinstripe") return [{ jacket: "pinstripe" }];
  if (jacket === "rainbow") return [{ jacket: "rainbow" }];
  return [];
}

export function buildCustomPricingInput(source: CustomPricingSource): CustomPricingInput | null {
  const categoryId = source.categoryId?.trim();
  const packagingOptionId = source.packagingOptionId?.trim();
  const quantity = Number(source.quantity);

  if (!categoryId || !packagingOptionId || !Number.isFinite(quantity) || quantity <= 0) {
    return null;
  }

  const extras = source.jacketExtras?.length ? source.jacketExtras : buildJacketExtras(source.jacket);
  const ingredientLabelsCountRaw = Number(source.ingredientLabelsCount ?? 0);
  const ingredientLabelsCount =
    Number.isFinite(ingredientLabelsCountRaw) && ingredientLabelsCountRaw > 0
      ? Math.floor(ingredientLabelsCountRaw)
      : 0;

  return {
    categoryId,
    packaging: [{ optionId: packagingOptionId, quantity }],
    labelsCount: source.labelsCount ?? undefined,
    ingredientLabelsCount,
    dueDate: source.dueDate ?? undefined,
    extras: extras.length ? extras : undefined,
  };
}
