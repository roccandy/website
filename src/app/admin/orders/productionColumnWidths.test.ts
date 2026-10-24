import { describe, expect, it } from "vitest";
import { productionColumnWidths } from "./productionColumnWidths";

describe("productionColumnWidths", () => {
  it.each([320, 464, 478, 580, 699, 700, 798, 1100, 1920])("fits the table at %ipx", (width) => {
    const columns = productionColumnWidths(width);
    expect(columns).toHaveLength(7);
    expect(columns.every((column) => column > 0)).toBe(true);
    expect(columns.reduce((total, column) => total + column, 0)).toBeCloseTo(Math.max(464, width));
    expect(columns[6]).toBe(12);
  });
  it("shares wide list space between the information columns", () => {
    expect(productionColumnWidths(1000)).toEqual([140, 288, 160, 220, 100, 80, 12]);
  });
  it("retains readable minimums in the split panel", () => {
    expect(productionColumnWidths(500)).toEqual([88, 72, 96, 112, 64, 56, 12]);
  });
  it("handles an unavailable initial measurement", () => {
    expect(productionColumnWidths(NaN)).toEqual(productionColumnWidths(464));
  });
});
