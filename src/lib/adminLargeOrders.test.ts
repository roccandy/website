import { describe, expect, it } from "vitest";
import {
  MAX_ADMIN_BATCH_COUNT,
  calculateAdminLargeOrderPricingWithContext,
  suggestedAdminBatchWeights,
  validateAdminBatchWeights,
} from "./adminLargeOrders";
import type { PricingContext } from "./pricing";

const pricingContext = {
  categories: [{ id: "custom-1-6" }],
  packagingOptions: [
    {
      id: "bulk-bag",
      allowed_categories: ["custom-1-6"],
      candy_weight_g: 1000,
      unit_price: 1,
    },
  ],
  tiers: [
    { category_id: "custom-1-6", min_kg: 0, max_kg: 4, per_kg: false, price: 100 },
    { category_id: "custom-1-6", min_kg: 4, max_kg: 8.2, per_kg: true, price: 20 },
  ],
  labelRanges: [{ upper_bound: 1000, range_cost: 0 }],
  settings: {
    max_total_kg: 8.2,
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

describe("admin large order batching", () => {
  it("suggests enough batches without exceeding the configured max batch weight", () => {
    const weights = suggestedAdminBatchWeights(20, 8.2);

    expect(weights).toHaveLength(3);
    expect(weights.reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(20, 2);
    expect(weights.every((weight) => weight <= 8.2)).toBe(true);
  });

  it("rejects orders that need more than the admin batch limit", () => {
    const weights = Array.from({ length: MAX_ADMIN_BATCH_COUNT + 1 }, () => 1);

    expect(() =>
      validateAdminBatchWeights({
        weights,
        totalWeightKg: weights.length,
      }),
    ).toThrow(`at most ${MAX_ADMIN_BATCH_COUNT}`);
  });

  it("allows an admin batch over the configured max when the total allocation matches", () => {
    expect(() =>
      validateAdminBatchWeights({
        weights: [9],
        totalWeightKg: 9,
      }),
    ).not.toThrow();
  });

  it("requires an explicit override when production batch weights do not match order weight", () => {
    expect(() =>
      validateAdminBatchWeights({
        weights: [7.5, 7.5, 7.5, 7.5, 7.5, 7.5],
        totalWeightKg: 54,
      }),
    ).toThrow("must equal");

    expect(() =>
      validateAdminBatchWeights({
        weights: [7.5, 7.5, 7.5, 7.5, 7.5, 7.5],
        totalWeightKg: 54,
        allowWeightMismatch: true,
      }),
    ).not.toThrow();
  });

  it("prices large orders as the sum of selected batch prices", () => {
    const pricing = calculateAdminLargeOrderPricingWithContext(
      {
        categoryId: "custom-1-6",
        packagingOptionId: "bulk-bag",
        quantity: 20,
        batchWeightsKg: [8, 8, 4],
      },
      pricingContext,
    );

    expect(pricing.batchBasePrices.map((item) => item.amount)).toEqual([180, 180, 100]);
    expect(pricing.basePrice).toBe(460);
    expect(pricing.packagingPrice).toBe(20);
    expect(pricing.total).toBe(480);
  });

  it("prices approved mismatched batches from the production batch total while keeping the packaging weight", () => {
    const pricing = calculateAdminLargeOrderPricingWithContext(
      {
        categoryId: "custom-1-6",
        packagingOptionId: "bulk-bag",
        quantity: 54,
        batchWeightsKg: [7.5, 7.5, 7.5, 7.5, 7.5, 7.5],
        allowBatchWeightMismatch: true,
      },
      pricingContext,
    );

    expect(pricing.totalWeightKg).toBe(54);
    expect(pricing.batchWeightsKg).toEqual([7.5, 7.5, 7.5, 7.5, 7.5, 7.5]);
    expect(pricing.batchBasePrices.map((item) => item.amount)).toEqual([170, 170, 170, 170, 170, 170]);
    expect(pricing.basePrice).toBe(1020);
    expect(pricing.packagingPrice).toBe(54);
    expect(pricing.total).toBe(1074);
  });

  it("uses the configured max weight as the effective final pricing tier max", () => {
    const context = {
      ...pricingContext,
      settings: {
        ...pricingContext.settings,
        max_total_kg: 8.5,
      },
    } as PricingContext;
    const pricing = calculateAdminLargeOrderPricingWithContext(
      {
        categoryId: "custom-1-6",
        packagingOptionId: "bulk-bag",
        quantity: 10,
        batchWeightsKg: [8.5, 1.5],
      },
      context,
    );

    expect(pricing.batchBasePrices.map((item) => item.amount)).toEqual([190, 100]);
    expect(pricing.basePrice).toBe(290);
    expect(pricing.total).toBe(300);
  });

  it("prices an admin batch above the configured max using the final tier", () => {
    const context = {
      ...pricingContext,
      settings: {
        ...pricingContext.settings,
        max_total_kg: 8.5,
      },
    } as PricingContext;
    const pricing = calculateAdminLargeOrderPricingWithContext(
      {
        categoryId: "custom-1-6",
        packagingOptionId: "bulk-bag",
        quantity: 9,
        batchWeightsKg: [9],
      },
      context,
    );

    expect(pricing.batchBasePrices).toEqual([{ weightKg: 9, amount: 200 }]);
    expect(pricing.basePrice).toBe(200);
    expect(pricing.total).toBe(209);
  });

  it("rounds calculated packaging weight to 2 decimals before validating batch splits", () => {
    const context = {
      ...pricingContext,
      packagingOptions: [
        ...pricingContext.packagingOptions,
        {
          id: "small-jar",
          allowed_categories: ["custom-1-6"],
          candy_weight_g: 73.666,
          unit_price: 1,
        },
      ],
    } as PricingContext;
    const pricing = calculateAdminLargeOrderPricingWithContext(
      {
        categoryId: "custom-1-6",
        packagingOptionId: "small-jar",
        quantity: 30,
        batchWeightsKg: [2, 0.21],
      },
      context,
    );

    expect(pricing.totalWeightKg).toBe(2.21);
    expect(pricing.batchWeightsKg).toEqual([2, 0.21]);
  });
});
