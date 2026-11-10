import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { legacyCandyPreviewPng } from "@/lib/candyPreviewEmail";

describe("legacy email candy preview", () => {
  it("rasterizes the faceted site candy preview for a legacy custom-text order", async () => {
    const image = await legacyCandyPreviewPng({
      category_id: "custom-1-6",
      design_text: "SETS",
      jacket: "two_colour_pinstripe",
      jacket_color_one: "#ff0000",
      jacket_color_two: "#ffffff",
      candy_fill_color: "#ffffff",
      pinstripe_color: "#000000",
      text_color: "#000000",
    });

    expect(image).not.toBeNull();
    await expect(sharp(image!).metadata()).resolves.toMatchObject({ format: "png", width: 1418, height: 1040 });
  });

  it("leaves branded artwork to its existing logo-preview path", async () => {
    await expect(legacyCandyPreviewPng({ category_id: "branded" })).resolves.toBeNull();
  });
});
