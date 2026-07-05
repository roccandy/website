import { describe, expect, it } from "vitest";
import {
  WEDDING_HEART,
  batchWeightsMatchTotal,
  calculatePackagingWeightKg,
  composeWeddingDesign,
  formatKgInput,
  parseQuantityFromDescription,
  resolveOrderQuantity,
  splitWeddingOrderDesign,
} from "./[id]/orderDetailCalculations";

describe("admin order detail calculations", () => {
  it("uses the red heart emoji for wedding design text", () => {
    expect(composeWeddingDesign("r", "s", true)).toBe(`R ${WEDDING_HEART} S`);
    expect(composeWeddingDesign("Rose", "Sam", false)).toBe(`Rose ${WEDDING_HEART} Sam`);
  });

  it("splits existing black-heart and red-heart wedding text", () => {
    expect(splitWeddingOrderDesign("R ♥ S")).toEqual({ lineOne: "R", lineTwo: "S" });
    expect(splitWeddingOrderDesign(`Rose ${WEDDING_HEART} Sam`)).toEqual({ lineOne: "Rose", lineTwo: "Sam" });
  });

  it("resolves quantity from saved quantity unless the description has an explicit package count", () => {
    expect(resolveOrderQuantity({ quantity: 30, order_description: "Jar - Small" })).toBe(30);
    expect(resolveOrderQuantity({ quantity: 3, order_description: "30 x Small Jars" })).toBe(30);
    expect(resolveOrderQuantity({ quantity: 3, order_description: "Jar - Small (Qty: 30)" })).toBe(30);
  });

  it("parses package counts from common order description formats", () => {
    expect(parseQuantityFromDescription("30 x Small Jars")).toBe(30);
    expect(parseQuantityFromDescription("Clear Bag - 8-10pc (Qty:100)")).toBe(100);
    expect(parseQuantityFromDescription("Jar - Small")).toBeNull();
  });

  it("calculates total weight from packaging weight and quantity rounded to 2dp", () => {
    expect(calculatePackagingWeightKg({ candy_weight_g: 73.666 }, 30)).toBe(2.21);
    expect(formatKgInput(2.21)).toBe("2.21");
  });

  it("matches split batches against the rounded calculated weight", () => {
    expect(batchWeightsMatchTotal(["2.00", "0.21"], 2.21)).toBe(true);
    expect(batchWeightsMatchTotal(["2.00", "0.20"], 2.21)).toBe(true);
    expect(batchWeightsMatchTotal(["2.00", "0.18"], 2.21)).toBe(false);
  });
});
