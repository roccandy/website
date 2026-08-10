import { describe, expect, it } from "vitest";
import {
  FALLBACK_PACKAGING_LID_HEX,
  getPackagingLidColorHex,
  normalizePackagingLidColorHex,
  normalizePackagingLidColorName,
} from "@/lib/packagingLidColors";

describe("packaging lid colours", () => {
  it("normalizes names used by packaging options", () => {
    expect(normalizePackagingLidColorName("  Rose   Gold ")).toBe("rose gold");
  });

  it("accepts six-digit hex colours and rejects unsafe CSS values", () => {
    expect(normalizePackagingLidColorHex(" #AABBCC ")).toBe("#aabbcc");
    expect(normalizePackagingLidColorHex("red")).toBeNull();
    expect(normalizePackagingLidColorHex("url(example.com)")).toBeNull();
  });

  it("finds colours case-insensitively and safely falls back", () => {
    const colors = [{ name: "Rose Gold", hex: "#B76E79" }];
    expect(getPackagingLidColorHex(colors, "rose gold")).toBe("#b76e79");
    expect(getPackagingLidColorHex(colors, "unknown")).toBe(FALLBACK_PACKAGING_LID_HEX);
  });
});
