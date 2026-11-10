import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { CandyDesignSvg } from "@/components/CandyDesignSvg";
import { CandyPreview } from "@/app/quote/CandyPreview";
import { candyDesignPng, candyDesignSvg } from "@/lib/candyDesignExport";
import {
  designFaceRadius,
  studioCandyDesign,
  emptyCandyDesign,
  upgradeCandyDesign,
  parseCandyDesign,
  designSummary,
  designLegacyFields,
  newDesignLayer,
} from "@/lib/candyDesign";
import { adminOrderRemakeInvoiceTabs } from "@/lib/adminOrderRemake";
import { parseAdminOrderDraftPayload } from "@/lib/adminOrderDrafts";
import type { OrderRow } from "@/lib/data";

describe("admin Studio v2 portable artwork", () => {
  it("clips persisted raster jacket artwork to the jacket in server exports without covering the candy face", async () => {
    const image = await sharp({ create: { width: 4, height: 3, channels: 4, background: "#ff0000" } }).png().toBuffer();
    const design = studioCandyDesign();
    design.layers = [{ ...newDesignLayer("image", "jacket-paint"), image: `data:image/png;base64,${image.toString("base64")}`, frame: "scene", surface: "jacket", size: 100, aspectRatio: 1772 / 1300 }];
    const { data, info } = await sharp(await candyDesignPng(parseCandyDesign(design)!)).raw().toBuffer({ resolveWithObject: true });
    const pixel = (x: number, y: number) => {
      const offset = (Math.round(y / 1300 * info.height) * info.width + Math.round(x / 1772 * info.width)) * info.channels;
      return [...data.slice(offset, offset + 3)];
    };
    expect(pixel(545, 660)).toEqual([255, 255, 255]);
    expect(pixel(1327, 610)).toEqual([255, 0, 0]);
    expect(pixel(1050, 660)).toEqual([255, 0, 0]);
  });
  it("preserves v1 documents and renders an explicit layer-only upgrade identically", async () => {
    const original = emptyCandyDesign("Existing order");
    original.jacket.mode = "rainbow";
    const before = JSON.stringify(original),
      upgraded = upgradeCandyDesign(original);
    expect(JSON.stringify(original)).toBe(before);
    expect(parseCandyDesign(original)?.schemaVersion).toBe(1);
    expect(upgraded.jacket.advanced).toBeUndefined();
    expect(await candyDesignPng(upgraded)).toEqual(
      await candyDesignPng(original),
    );
  });
  it("validates new controls, clones snapshots, and rejects unsafe image sources in v2", () => {
    const design = studioCandyDesign();
    design.jacket.advanced!.segments = 900;
    design.jacket.advanced!.ring = 2;
    design.layers[0] = {
      ...design.layers[0],
      opacity: -9,
      scaleX: Infinity,
      arcRadius: 1,
      arcOffset: 200,
      locked: true,
    };
    const parsed = parseCandyDesign(design)!;
    expect(parsed.jacket.advanced).toMatchObject({ segments: 16, ring: 0.35 });
    expect(parsed.layers[0]).toMatchObject({
      opacity: 0,
      scaleX: 1,
      arcRadius: 60,
      arcOffset: 50,
      locked: true,
    });
    expect(parsed).not.toBe(design);
    expect(parsed.jacket.advanced).not.toBe(design.jacket.advanced);
    expect(() =>
      parseCandyDesign({
        ...design,
        layers: [
          {
            ...newDesignLayer("image", "bad"),
            image: "https://outside.test/pixel.png",
          },
        ],
      }),
    ).toThrow("PNG");
  });
  it.each([2, 4, 6, 8, 12, 16])(
    "renders %i coloured segments consistently on the face, body, preview and server PNG",
    async (segments) => {
      const design = studioCandyDesign();
      design.layers = [];
      design.jacket.mode = "segments";
      design.jacket.colours = ["#ff0000", "#00ff00", "#0000ff", "#ffff00"];
      design.jacket.advanced = {
        ...design.jacket.advanced!,
        segments,
        shading: 0,
        shadow: false,
      };
      const svg = await candyDesignSvg(design);
      const preview = renderToStaticMarkup(
        <CandyPreview
          design={design}
          mode=""
          colorOne="#eeeeee"
          colorTwo="#eeeeee"
        />,
      );
      for (const source of [svg, preview])
        expect((source.match(/data-jacket-ring=/g) || []).length).toBe(
          segments,
        );
      const { data, info } = await sharp(await candyDesignPng(design))
        .raw()
        .toBuffer({ resolveWithObject: true });
      const pixel = (x: number, y: number) => {
        const offset =
          (Math.round((y / 1300) * info.height) * info.width +
            Math.round((x / 1772) * info.width)) *
          info.channels;
        return `#${[...data.slice(offset, offset + 3)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
      };
      const r = (532 + designFaceRadius(design)) / 2;
      for (let i = 0; i < segments; i++) {
        const angle = -Math.PI / 2 + ((i + 0.5) * Math.PI * 2) / segments;
        expect(
          pixel(545 + r * Math.cos(angle), 660 + r * Math.sin(angle)),
        ).toBe(design.jacket.colours[i % 4]);
        // Sample the centre of the adjoining extrusion where the visible normal faces right.
        if (Math.cos(angle) > 0.7)
          expect(
            pixel(795 + 532 * Math.cos(angle), 610 + 532 * Math.sin(angle)),
          ).toBe(design.jacket.colours[i % 4]);
      }
    },
  );
  it("keeps production specifications complete and customer summaries free of internal measurements", () => {
    const design = studioCandyDesign();
    design.jacket.mode = "segments";
    design.jacket.showPinstripe = true;
    design.productionNotes = "Private recipe";
    design.layers[0].arcRadius = 280;
    design.layers[0].curve = "up";
    expect(designSummary(design, true).join("\n")).toContain("ring 18.2%");
    expect(designSummary(design, true).join("\n")).toContain("arc radius 280");
    const summary = designSummary(design).join("\n");
    expect(summary).toContain("8 segments");
    expect(summary).not.toContain("ring ");
    expect(summary).not.toContain("Private recipe");
    expect(designLegacyFields(design).jacket).toBe("two_colour_pinstripe");
  });
  it("exports multiline, case and transformed artwork through the same layer controls", async () => {
    const design = studioCandyDesign();
    design.layers[0] = {
      ...design.layers[0],
      text: "Thank You\nKarri",
      uppercase: true,
      flipX: true,
      scaleX: 1.2,
      opacity: 0.6,
    };
    const exported = await candyDesignSvg(design),
      preview = renderToStaticMarkup(<CandyDesignSvg design={design} />);
    expect(exported).toContain("THANK YOU\nKARRI");
    expect(exported).toContain("scale(-1.2 1)");
    expect(preview).toContain("<tspan");
    expect(preview).toContain("KARRI");
    expect(exported).not.toContain("<text");
    expect(parseCandyDesign(design)?.layers[0].uppercase).toBe(true);
  });
  it("round trips two distinct v2 snapshots through remake tabs and unsent order drafts without sharing artwork or prices", () => {
    const a = studioCandyDesign("A"),
      b = studioCandyDesign("B");
    b.jacket.advanced!.segments = 12;
    const tabs = adminOrderRemakeInvoiceTabs([
      { id: "a", candy_design: a, total_price: 4636.77 },
      { id: "b", candy_design: b, total_price: 4483.23 },
    ] as OrderRow[]);
    const draft = parseAdminOrderDraftPayload({
      schemaVersion: 1,
      shared: {},
      orders: tabs,
      activeOrderId: tabs[0].id,
    });
    expect(
      parseCandyDesign(draft.orders[0].fields.candy_design)?.jacket.advanced
        ?.segments,
    ).toBe(8);
    expect(
      parseCandyDesign(draft.orders[1].fields.candy_design)?.jacket.advanced
        ?.segments,
    ).toBe(12);
    expect(draft.orders.map((t) => t.fields.total_price)).toEqual([
      "4636.77",
      "4483.23",
    ]);
    expect(a.jacket.advanced?.segments).toBe(8);
  });
  it("exports flat and 3D views with a transparent proof background while keeping order/email PNGs white", async () => {
    const design = studioCandyDesign();
    design.presentation = { background: "#ff00ff", transparent: true };
    const transparent = await sharp(
      await candyDesignPng(design, { presentation: true, view: "face" }),
    )
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(transparent.info.width).toBe(1040);
    expect(transparent.info.channels).toBe(4);
    expect(transparent.data[3]).toBe(0);
    const normal = await sharp(await candyDesignPng(design))
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect([...normal.data.slice(0, 3)]).toEqual([255, 255, 255]);
    const flat = renderToStaticMarkup(
      <CandyDesignSvg design={design} view="face" />,
    );
    expect(flat).not.toContain("data-jacket-body=");
    expect(flat).not.toContain("data-candy-shadow");
  });
});
