import { describe, expect, it } from "vitest";
import { resolveCandyPreviewJacket } from "./orderColorUtils";

describe("resolveCandyPreviewJacket", () => {
  it("keeps two-colour pinstripe orders in two-colour mode and shows pinstripes", () => {
    expect(resolveCandyPreviewJacket({ jacket: "two_colour_pinstripe", jacket_type: "two_colour" })).toEqual({
      mode: "two_colour",
      showPinstripe: true,
    });
  });

  it("detects spaced pin stripe values", () => {
    expect(resolveCandyPreviewJacket({ jacket: "Pin Stripe Jacket", jacket_type: null })).toEqual({
      mode: "pinstripe",
      showPinstripe: true,
    });
  });

  it("detects legacy pinstriping values", () => {
    expect(resolveCandyPreviewJacket({ jacket: null, jacket_type: "pinstriping" })).toEqual({
      mode: "pinstripe",
      showPinstripe: true,
    });
  });

  it("does not show pinstripes for rainbow jackets", () => {
    expect(resolveCandyPreviewJacket({ jacket: "rainbow", jacket_type: "rainbow" })).toEqual({
      mode: "rainbow",
      showPinstripe: false,
    });
  });
});
