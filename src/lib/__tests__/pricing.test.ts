import { describe, expect, it } from "vitest";
import { buildCustomPricingInput, buildJacketExtras, hasIngredientLabelsRequested } from "@/lib/customPricingInput";

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
});
