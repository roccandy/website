import { describe, expect, it } from "vitest";
import {
  colourSelection,
  editRaster,
  polygonSelection,
  resizeSelection,
  type Raster,
} from "@/lib/designRaster";

const fixture = (): Raster => ({
  width: 3,
  height: 2,
  data: new Uint8ClampedArray([
    255, 0, 0, 255, 0, 0, 0, 255, 255, 0, 0, 128, 255, 0, 0, 255, 0, 0, 0, 0,
    255, 0, 0, 255,
  ]),
});
describe("admin artwork pixel editing", () => {
  it("distinguishes contiguous colour from all matching pixels without selecting transparent pixels", () => {
    expect([...colourSelection(fixture(), 0, 0, 0, true)]).toEqual([
      1, 0, 0, 1, 0, 0,
    ]);
    expect([...colourSelection(fixture(), 0, 0, 0, false)]).toEqual([
      1, 0, 1, 1, 0, 1,
    ]);
    expect([...colourSelection(fixture(), 1, 1, 120, false)]).toEqual([
      0, 0, 0, 0, 0, 0,
    ]);
  });
  it("preserves soft edges and the input when recolouring, while fill deliberately replaces alpha", () => {
    const image = fixture(),
      before = image.data.slice(),
      mask = colourSelection(image, 2, 0, 0, false);
    const result = editRaster(image, mask, "recolour", "#00ff00");
    expect([...result.data.slice(8, 12)]).toEqual([0, 255, 0, 128]);
    expect(editRaster(image, mask, "fill").data[11]).toBe(255);
    expect(image.data).toEqual(before);
    const deleted = editRaster(image, mask, "delete"),
      kept = editRaster(image, mask, "keep");
    for (let i = 0; i < mask.length; i++)
      expect(deleted.data[i * 4 + 3] + kept.data[i * 4 + 3]).toBe(
        image.data[i * 4 + 3],
      );
  });
  it("retains dimensions from native ImageData-style prototype accessors", () => {
    class BrowserImageData {
      get width() {
        return 3;
      }
      get height() {
        return 2;
      }
      data = fixture().data;
    }
    expect(editRaster(new BrowserImageData(), null, "keep")).toMatchObject({
      width: 3,
      height: 2,
    });
  });
  it("rasterises box/lasso selections and grows/shrinks them at image boundaries", () => {
    const mask = polygonSelection(5, 5, [
      { x: 1, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 4 },
      { x: 1, y: 4 },
    ]);
    expect(mask.reduce((a, b) => a + b)).toBe(9);
    expect(resizeSelection(mask, 5, 5, 1).reduce((a, b) => a + b)).toBe(25);
    expect(resizeSelection(mask, 5, 5, -1).reduce((a, b) => a + b)).toBe(1);
    expect(polygonSelection(5, 5, []).some(Boolean)).toBe(false);
  });
});
