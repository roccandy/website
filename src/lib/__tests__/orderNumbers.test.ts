import { describe, expect, it } from "vitest";
import { buildSplitOrderNumber, normalizeBaseOrderNumber, orderNumberSuffixForIndex } from "@/lib/orderNumbers";

describe("orderNumbers", () => {
  it("normalizes split suffixes beyond b back to the base order number", () => {
    expect(normalizeBaseOrderNumber("0001-a")).toBe("0001");
    expect(normalizeBaseOrderNumber("0001-b")).toBe("0001");
    expect(normalizeBaseOrderNumber("0001-c")).toBe("0001");
    expect(normalizeBaseOrderNumber("#0001-aa")).toBe("0001");
  });

  it("builds alphabetic split order numbers", () => {
    expect(orderNumberSuffixForIndex(0)).toBe("a");
    expect(orderNumberSuffixForIndex(1)).toBe("b");
    expect(orderNumberSuffixForIndex(25)).toBe("z");
    expect(orderNumberSuffixForIndex(26)).toBe("aa");
    expect(buildSplitOrderNumber("0001", 2)).toBe("0001-c");
  });
});
