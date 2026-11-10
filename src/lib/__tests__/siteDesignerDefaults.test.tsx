import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CandyPreview } from "@/app/quote/CandyPreview";
import {
  DESIGN_FONTS,
  designFromOrder,
  emptyCandyDesign,
  newDesignLayer,
  parseCandyDesign,
  resetDesignLayerDefaults,
} from "@/lib/candyDesign";
import {
  resolveSiteDesignerDefaults,
  SITE_DESIGNER_DEFAULTS as SITE,
} from "@/lib/siteDesignerDefaults";
import { candyDesignSvg } from "@/lib/candyDesignExport";

const pixels = (percent: number) => (percent * SITE.faceDiameter) / 100;
describe("public designer defaults in Design Studio", () => {
  it("starts with the configured public neutral palette and a plain jacket", () => {
    const defaults = resolveSiteDesignerDefaults([
      { category: "grey", shade: "light", hex: "#aabbcc" },
    ]);
    const design = emptyCandyDesign(undefined, defaults);
    expect(design.jacket).toEqual({
      mode: "solid",
      colours: Array(4).fill("#aabbcc"),
      fill: "#ffffff",
      pinstripe: "#ffffff",
      showPinstripe: false,
    });
    const layer = newDesignLayer("text", "new", defaults);
    expect(layer).toMatchObject({
      font: "site",
      colour: "#aabbcc",
      bold: true,
      italic: false,
      rotation: 0,
      curve: "straight",
      x: 50,
      y: 50,
    });
    expect(DESIGN_FONTS.site.family).toBe("Arimo, Arial, sans-serif");
    expect(resolveSiteDesignerDefaults()).toEqual({
      jacketColour: "#d1d5db",
      textColour: "#b7b7b7",
    });
  });

  it.each([
    ["A", 251],
    ["ABC", 205],
    ["CANDY", 172],
    ["SWEETS", 132],
  ] as const)(
    "imports %s at the public designer's %ipx short-text size and spacing",
    (text, fontSize) => {
      const layer = designFromOrder({
        category_id: "custom-1-6",
        design_text: text,
      }).layers[0];
      expect(pixels(layer.size)).toBeCloseTo(fontSize, 2);
      expect(layer.spacing).toBeCloseTo(fontSize * 0.03, 3);
      const publicSvg = renderToStaticMarkup(
        <CandyPreview
          mode=""
          colorOne="#d1d5db"
          colorTwo="#d1d5db"
          designText={text}
          customTextVariant="short"
        />,
      );
      expect(publicSvg).toContain(`font-size="${fontSize}"`);
      expect(publicSvg).toContain('letter-spacing="0.03em"');
      expect(publicSvg).toContain("Helvetica, Arial, sans-serif");
    },
  );

  it("keeps the normal stacked and curved layouts when expanding long-text orders", () => {
    const stacked = designFromOrder({
      category_id: "custom-7-14",
      design_text: "THANK YOU",
    });
    expect(stacked.layers.map((l) => l.text)).toEqual(["THANK", "YOU"]);
    expect(stacked.layers.map((l) => l.curve)).toEqual([
      "straight",
      "straight",
    ]);
    expect(pixels(stacked.layers[0].y - 50)).toBeCloseTo(-105, 2);
    expect(pixels(stacked.layers[1].y - 50)).toBeCloseTo(105, 2);
    const arcs = designFromOrder({
      category_id: "custom-7-14",
      design_text: "ELEPHANT ROCKS",
    });
    expect(arcs.layers.map((l) => l.curve)).toEqual(["up", "down"]);
    expect(arcs.layers.map((l) => l.text)).toEqual(["ELEPHANT", "ROCKS"]);
    expect(pixels(arcs.layers[1].y - 50)).toBeCloseTo(24, 2);
  });

  it("uses the public wedding names, heart and initials sizing, positions and tracking", () => {
    const names = designFromOrder({
      category_id: "weddings-both-names",
      design_text: "ALICE ❤️ BOB",
    });
    expect(pixels(names.layers[0].size)).toBeCloseTo(130, 2);
    expect(names.layers[0].spacing).toBe(10.4);
    expect(pixels(names.layers[1].size)).toBeCloseTo(24 * 9.49, 2);
    expect(pixels(names.layers[2].y - 50)).toBeCloseTo(24, 2);
    const initials = designFromOrder({
      category_id: "weddings-initials",
      design_text: "A ❤️ B",
    });
    expect(pixels(initials.layers[0].size)).toBeCloseTo(180, 2);
    expect(pixels(50 - initials.layers[0].x)).toBeCloseTo(230, 2);
    expect(initials.layers[0].spacing).toBe(36);
    expect(parseCandyDesign(initials)?.layers[0].spacing).toBe(36);
  });

  it("uses the normal site's artwork footprint", () => {
    const layer = newDesignLayer("image", "logo");
    const publicSvg = renderToStaticMarkup(
      <CandyPreview
        mode=""
        colorOne="#d1d5db"
        colorTwo="#d1d5db"
        logoUrl="https://example.test/logo.png"
      />,
    );
    const size = Number(publicSvg.match(/<image[^>]*width="([^"]+)"/)?.[1]);
    expect(pixels(layer.size)).toBeCloseTo(size, 2);
  });

  it("preserves saved artwork and existing order colours rather than applying new defaults over them", () => {
    const saved = emptyCandyDesign();
    saved.layers[0] = {
      ...saved.layers[0],
      font: "serif",
      colour: "#123456",
      size: 31,
      spacing: 9,
      rotation: 20,
    };
    saved.jacket.colours = ["#112233", "#445566"];
    expect(
      designFromOrder(
        { candy_design: saved },
        { textColour: "#999999", jacketColour: "#aaaaaa" },
      ),
    ).toEqual(saved);
    const imported = designFromOrder({
      category_id: "custom-1-6",
      design_text: "ABC",
      text_color: "#112233",
      jacket_color_one: "#445566",
    });
    expect(imported.layers[0].colour).toBe("#112233");
    expect(imported.jacket.colours[0]).toBe("#445566");
  });

  it("allows explicit reset without losing the text, artwork, layer identity or visibility", () => {
    const original = {
      ...newDesignLayer("text", "identity"),
      text: "ABC",
      colour: "#123456",
      font: "serif" as const,
      visible: false,
      rotation: 30,
    };
    const reset = resetDesignLayerDefaults(original);
    expect(reset).toMatchObject({
      id: "identity",
      text: "ABC",
      font: "site",
      colour: "#b7b7b7",
      visible: false,
      rotation: 0,
    });
    expect(pixels(reset.size)).toBeCloseTo(205, 2);
  });

  it("exports the default font as portable outlines", async () => {
    const svg = await candyDesignSvg(emptyCandyDesign());
    expect(svg).toContain(
      'data-outlined-font="Site default (Helvetica / Arial)"',
    );
    expect(svg).not.toContain("<text");
  });
});
