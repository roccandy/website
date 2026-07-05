import { describe, expect, it } from "vitest";
import { buildCustomPricingInput, buildJacketExtras, hasIngredientLabelsRequested } from "@/lib/customPricingInput";
import { calculatePricingWithContext, type PricingContext } from "@/lib/pricing";

describe("pricing helpers", () => {
  it("keeps ingredient label quantity empty unless explicitly set", () => {
    expect(
      buildCustomPricingInput({
        categoryId: "custom-1-6",
        packagingOptionId: "jar-small",
        quantity: 24,
        ingredientLabelsOptIn: true,
      })
    ).toMatchObject({
      ingredientLabelsCount: 0,
    });

    expect(
      buildCustomPricingInput({
        categoryId: "custom-1-6",
        packagingOptionId: "jar-small",
        quantity: 24,
        ingredientLabelsCount: 7,
        ingredientLabelsOptIn: true,
      })
    ).toMatchObject({
      ingredientLabelsCount: 7,
    });

    expect(
      buildCustomPricingInput({
        categoryId: "custom-1-6",
        packagingOptionId: "jar-small",
        quantity: 24,
        ingredientLabelsOptIn: false,
      })
    ).toMatchObject({
      ingredientLabelsCount: 0,
    });
  });

  it("can recover ingredient label state from saved order notes", () => {
    expect(hasIngredientLabelsRequested({ notes: "Ingredient labels requested." })).toBe(true);
    expect(hasIngredientLabelsRequested({ notes: "Customer note only." })).toBe(false);

    expect(
      buildCustomPricingInput({
        categoryId: "custom-1-6",
        packagingOptionId: "jar-small",
        quantity: 12,
        notes: "Ingredient labels requested.",
      })
    ).toMatchObject({
      ingredientLabelsCount: 0,
    });
  });

  it("expands combined jacket selections into pricing extras", () => {
    expect(buildJacketExtras("two_colour_pinstripe")).toEqual([
      { jacket: "two_colour" },
      { jacket: "pinstripe" },
    ]);
  });

  it("uses the configured max weight as the effective final pricing tier max", () => {
    const context = {
      categories: [{ id: "custom-1-6" }],
      packagingOptions: [
        {
          id: "bulk-bag",
          allowed_categories: ["custom-1-6"],
          candy_weight_g: 8500,
          max_packages: 1,
          unit_price: 0,
        },
      ],
      tiers: [
        { category_id: "custom-1-6", min_kg: 0, max_kg: 4, per_kg: false, price: 100 },
        { category_id: "custom-1-6", min_kg: 4, max_kg: 8.2, per_kg: true, price: 20 },
      ],
      labelRanges: [],
      settings: {
        max_total_kg: 8.5,
        labels_max_bulk: 1000,
        labels_supplier_shipping: 0,
        labels_markup_multiplier: 1,
        ingredient_label_price: 0,
        jacket_rainbow: 0,
        jacket_two_colour: 0,
        jacket_pinstripe: 0,
        lead_time_days: 0,
        urgency_fee: 0,
      },
    } as unknown as PricingContext;
    const pricing = calculatePricingWithContext(
      {
        categoryId: "custom-1-6",
        packaging: [{ optionId: "bulk-bag", quantity: 1 }],
        labelsCount: 0,
      },
      context,
    );

    expect(pricing.totalWeightKg).toBe(8.5);
    expect(pricing.basePrice).toBe(190);
  });
});
