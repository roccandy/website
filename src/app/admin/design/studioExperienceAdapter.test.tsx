import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CandyDesignSvg } from "@/components/CandyDesignSvg";
import {
  studioCandyDesign,
  emptyCandyDesign,
  newDesignLayer,
  parseCandyDesign,
} from "@/lib/candyDesign";
import { StudioExperienceAdapter } from "./studioExperienceAdapter";
vi.mock("@/lib/studioClientAssets", () => ({
  uploadStudioDataUrl: vi.fn(async () => ({
    image: `candy-asset:${"a".repeat(64)}.png`,
    imageWidth: 1772,
    imageHeight: 1300,
  })),
}));
const documentStub = {} as Document;
describe("supplied Studio experience to canonical order artwork", () => {
  it.each([studioCandyDesign("V2"), emptyCandyDesign("Legacy")])(
    "opening $name preserves the entire saved document including property-order differences",
    async (design) => {
      const adapter = new StudioExperienceAdapter(design),
        state = await adapter.load(design, documentStub);
      state.jacket = Object.fromEntries(
        Object.entries(state.jacket).reverse(),
      ) as typeof state.jacket;
      expect(adapter.toDesign(state)).toBe(design);
    },
  );
  it("retains existing eight-colour jackets, transforms and semicircle geometry when another layer changes", async () => {
    const design = studioCandyDesign();
    design.jacket.mode = "segments";
    design.jacket.colours = [
      "#111111",
      "#222222",
      "#333333",
      "#444444",
      "#555555",
      "#666666",
      "#777777",
      "#888888",
    ];
    design.layers.push({
      ...newDesignLayer("text", "keep"),
      text: "UNCHANGED",
      curve: "down",
      fullArc: false,
      arcOffset: 10,
      scaleX: 1.8,
      flipX: true,
    });
    const adapter = new StudioExperienceAdapter(design),
      state = await adapter.load(design, documentStub);
    state.layers[0].text = "THANK YOU KARRI";
    const output = adapter.toDesign(state);
    expect(output.layers[0].text).toBe("THANK YOU KARRI");
    expect(output.layers[1]).toBe(design.layers[1]);
    expect(output.jacket).toBe(design.jacket);
  });
  it("preserves label visibility, clipping and whole-design scaling through parse and every shared SVG render", async () => {
    const design = studioCandyDesign(),
      adapter = new StudioExperienceAdapter(design),
      state = await adapter.load(design, documentStub);
    state.jacket.show = false;
    state.zoom = 0.8;
    state.layers[0].clip = false;
    const parsed = parseCandyDesign(adapter.toDesign(state))!;
    expect(parsed.presentation).toMatchObject({
      hideCandy: true,
      designScale: 0.8,
    });
    expect(parsed.layers[0].clip).toBe(false);
    const svg = renderToStaticMarkup(<CandyDesignSvg design={parsed} />);
    expect(svg).not.toContain("data-advanced-jacket");
    expect(svg).toContain("scale(0.8)");
    expect(svg).not.toContain('clip-path="url(#design-face)"');
  });
  it("paint surface changes and asset preparation cannot retain the earlier jacket-only setting", async () => {
    const design = studioCandyDesign(),
      adapter = new StudioExperienceAdapter(design),
      state = await adapter.load(design, documentStub);
    const img = {
      width: 1772,
      height: 1300,
      toDataURL: () => "data:image/png;base64,aGVsbG8=",
    } as HTMLCanvasElement;
    state.layers.push({
      ...state.layers[0],
      original: undefined,
      id: "paint",
      type: "paint",
      img,
      jacketOnly: true,
    });
    expect(adapter.toDesign(state).layers[1]).toMatchObject({
      surface: "jacket",
      frame: "scene",
      size: 100,
    });
    state.layers[1].jacketOnly = false;
    const output = adapter.toDesign(state);
    expect(output.layers[1]).toMatchObject({ surface: "face", clip: false });
    const prepared = await adapter.prepare(output);
    expect(prepared.layers[1].image).toMatch(/^candy-asset:/);
    expect(output.layers[1].image).toMatch(/^data:/);
  });
});
