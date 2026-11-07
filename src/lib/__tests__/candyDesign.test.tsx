import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { renderToStaticMarkup } from "react-dom/server";
import {
  emptyCandyDesign,
  parseCandyDesign,
  designFromOrder,
  designLegacyFields,
  designSummary,
  newDesignLayer,
} from "@/lib/candyDesign";
import {
  candyDesignPng,
  candyDesignSvg,
  validateDesignImages,
} from "@/lib/candyDesignExport";
import { CandyPreview } from "@/app/quote/CandyPreview";
import { buildOrderActivityChanges } from "@/app/admin/orders/orderActivityChanges";
import type { OrderRow } from "@/lib/data";

describe("versioned candy designs", () => {
  it("rejects unsupported versions and executable/remote image sources", () => {
    expect(() =>
      parseCandyDesign({ ...emptyCandyDesign(), schemaVersion: 2 }),
    ).toThrow("Unsupported");
    for (const image of [
      "javascript:alert(1)",
      "http://localhost/private",
      "data:image/svg+xml;base64,PHN2Zz4=",
    ]) {
      expect(() =>
        parseCandyDesign({
          ...emptyCandyDesign(),
          layers: [{ ...newDesignLayer("image", "art"), image }],
        }),
      ).toThrow("PNG");
    }
  });
  it("limits documents and sanitises numeric styles without discarding layer order", () => {
    const design = emptyCandyDesign();
    design.layers[0].x = 900;
    design.layers[0].rotation = NaN;
    design.layers.push({
      ...newDesignLayer("star", "star"),
      colour: "url(http://evil.test)",
    });
    const result = parseCandyDesign(design)!;
    expect(result.layers.map((l) => l.id)).toEqual(["text-1", "star"]);
    expect(result.layers[0].x).toBe(100);
    expect(result.layers[0].rotation).toBe(0);
    expect(result.layers[1].colour).toBe("#333333");
    expect(() =>
      parseCandyDesign({ ...design, layers: Array(21).fill(design.layers[0]) }),
    ).toThrow("20");
    expect(() =>
      parseCandyDesign({
        ...design,
        layers: [design.layers[0], design.layers[0]],
      }),
    ).toThrow("unique");
  });
  it("copies existing designs so future library edits cannot mutate order snapshots", () => {
    const saved = emptyCandyDesign("Order mockup");
    saved.source = { id: "77777777-7777-4777-8777-777777777777", revision: 2 };
    const snapshot = parseCandyDesign(JSON.stringify(saved))!;
    saved.layers[0].text = "CHANGED";
    saved.jacket.colours[0] = "#000000";
    expect(snapshot.layers[0].text).toBe("CANDY");
    expect(snapshot.source?.revision).toBe(2);
    expect(snapshot.jacket.colours[0]).not.toBe("#000000");
  });
  it("keeps commercial category independent and supplies compatibility jacket fields", () => {
    const design = emptyCandyDesign();
    design.jacket.mode = "segments";
    design.jacket.showPinstripe = true;
    const fields = designLegacyFields(design);
    expect(fields.jacket).toBe("two_colour_pinstripe");
    expect(fields).not.toHaveProperty("category_id");
    expect(fields).not.toHaveProperty("logo_url");
  });
  it("separates customer summary from internal production notes and dimensions", () => {
    const design = emptyCandyDesign();
    design.productionNotes = "Internal-only recipe";
    design.layers[0].font = "serif";
    design.layers[0].rotation = 15;
    expect(designSummary(design).join("\n")).toContain(
      "Roboto Slab (serif) bold",
    );
    expect(designSummary(design).join("\n")).not.toContain("Internal-only");
    expect(designSummary(design, true).join("\n")).toContain("rotation 15°");
    expect(designSummary(design, true).join("\n")).toContain(
      "Internal-only recipe",
    );
  });
  it("imports wedding names, colours and heart into separate editable layers", () => {
    const design = designFromOrder({
      category_id: "weddings-both-names",
      design_text: "ALICE ❤️ BOB",
      jacket: "two_colour_pinstripe",
      candy_fill_color: "#ff0000",
    });
    expect(design.layers.map((l) => l.type)).toEqual(["text", "heart", "text"]);
    expect(design.layers[2].text).toBe("BOB");
    expect(design.jacket.fill).toBe("#ff0000");
    expect(design.jacket.showPinstripe).toBe(true);
  });
  it("records a design edit even if its name and library revision are unchanged", () => {
    const first = emptyCandyDesign();
    const next = parseCandyDesign(first)!;
    next.layers[0].size = 20;
    const changes = buildOrderActivityChanges(
      { candy_design: first } as OrderRow,
      { candy_design: next },
    );
    expect(changes).toContainEqual(
      expect.objectContaining({ field: "Candy design" }),
    );
  });
});

describe("design rendering and exports", () => {
  it.each([3, 4, 8])("joins every custom-segment side panel to its face colour with %i colours", async (count) => {
    const design = emptyCandyDesign();
    design.jacket.mode = "segments";
    design.jacket.colours = ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#00ffff", "#ff00ff", "#222222", "#eeeeee"].slice(0, count);
    const preview = renderToStaticMarkup(<CandyPreview design={design} mode="" colorOne="#ffffff" colorTwo="#ffffff"/>);
    const exported = await candyDesignSvg(design);
    for (const svg of [preview, exported]) {
      const colour = (gradient: number) => {
        const match = svg.match(new RegExp(`<linearGradient[^>]*id="[^"]*-_Linear${gradient}"[^>]*>([\\s\\S]*?)</linearGradient>`));
        return match?.[1].match(/stop-color="([^"]+)"/)?.[1];
      };
      for (const [side, face] of [[1, 8], [2, 7], [3, 6], [4, 9]]) {
        expect(colour(side)).toBeDefined();
        expect(colour(side)).toBe(colour(face));
      }
      for (let face = 5; face <= 12; face++) expect(colour(face)).toBe(design.jacket.colours[(face - 5) % count]);
    }
  });
  it("renders the same SVG design in admin, order preview and export without a legacy logo overriding it", async () => {
    const design = emptyCandyDesign("MOCKUP");
    design.layers[0].text = '<script> & "TEST"';
    design.layers[0].curve = "up";
    design.layers[0].font = "mono";
    const svg = await candyDesignSvg(design);
    expect(svg).toContain("&lt;script&gt;");
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("clipPath");
    expect(svg).toContain("Roboto Mono");
    expect(svg).toContain("data-outlined-font");
    expect(svg).not.toContain("<text");
    const preview = renderToStaticMarkup(
      <CandyPreview
        design={design}
        mode=""
        colorOne="#ffffff"
        colorTwo="#ffffff"
        logoUrl="https://old-logo.test/old.png"
      />,
    );
    expect(preview).toContain("MOCKUP");
    expect(preview).not.toContain("https://old-logo.test");
    const metadata = await sharp(await candyDesignPng(design)).metadata();
    expect(metadata.format).toBe("png");
    expect(metadata.width).toBe(1418);
    expect(metadata.height).toBe(1040);
  });
  it("rejects mislabeled/broken raster artwork before persisting an order", async () => {
    const design = emptyCandyDesign();
    design.layers = [
      {
        ...newDesignLayer("image", "art"),
        image: "data:image/png;base64,aGVsbG8=",
      },
    ];
    await expect(validateDesignImages(design)).rejects.toThrow();
  });
  it("renders pinstripes and custom segments while keeping hidden layers out of exports", async () => {
    const design = emptyCandyDesign();
    design.jacket.mode = "segments";
    design.jacket.showPinstripe = true;
    design.jacket.pinstripe = "#123456";
    design.layers[0].text = "HIDDEN";
    design.layers[0].visible = false;
    const svg = await candyDesignSvg(design);
    expect(svg).not.toContain("HIDDEN");
    expect(svg).toContain("#123456");
    const png = await candyDesignPng(design);
    expect(png.length).toBeGreaterThan(5000);
  });
});
