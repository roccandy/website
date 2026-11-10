/** Pixel operations used by the admin artwork editor. No browser or server dependencies. */
export type Raster = { width: number; height: number; data: Uint8ClampedArray };
export type Mask = Uint8Array;
export function colourSelection(
  image: Raster,
  x: number,
  y: number,
  tolerance: number,
  contiguous: boolean,
): Mask {
  const { width, height, data } = image,
    mask = new Uint8Array(width * height);
  x = Math.floor(x);
  y = Math.floor(y);
  if (x < 0 || y < 0 || x >= width || y >= height) return mask;
  const seed = (y * width + x) * 4;
  if (!data[seed + 3]) return mask;
  const matches = (p: number) =>
    data[p * 4 + 3] > 0 &&
    Math.max(
      ...[0, 1, 2].map((c) => Math.abs(data[p * 4 + c] - data[seed + c])),
    ) <= tolerance;
  if (!contiguous) {
    for (let p = 0; p < mask.length; p++) if (matches(p)) mask[p] = 1;
    return mask;
  }
  const seen = new Uint8Array(mask.length),
    queue = new Int32Array(mask.length);
  let head = 0,
    tail = 1;
  queue[0] = y * width + x;
  seen[queue[0]] = 1;
  const push = (p: number) => {
    if (!seen[p]) {
      seen[p] = 1;
      queue[tail++] = p;
    }
  };
  while (head < tail) {
    const p = queue[head++];
    if (!matches(p)) continue;
    mask[p] = 1;
    if (p % width) push(p - 1);
    if (p % width < width - 1) push(p + 1);
    if (p >= width) push(p - width);
    if (p < width * (height - 1)) push(p + width);
  }
  return mask;
}
export function polygonSelection(
  width: number,
  height: number,
  points: { x: number; y: number }[],
): Mask {
  const mask = new Uint8Array(width * height);
  if (points.length < 3) return mask;
  const firstY = Math.max(0, Math.floor(Math.min(...points.map((p) => p.y))));
  const lastY = Math.min(
    height - 1,
    Math.ceil(Math.max(...points.map((p) => p.y))),
  );
  for (let y = firstY; y <= lastY; y++) {
    const crossings: number[] = [],
      scan = y + 0.5;
    for (let i = 0; i < points.length; i++) {
      const a = points[i],
        b = points[(i + 1) % points.length];
      if (a.y > scan !== b.y > scan)
        crossings.push(a.x + ((scan - a.y) * (b.x - a.x)) / (b.y - a.y));
    }
    crossings.sort((a, b) => a - b);
    for (let i = 0; i + 1 < crossings.length; i += 2)
      for (
        let x = Math.max(0, Math.ceil(crossings[i] - 0.5));
        x < Math.min(width, Math.ceil(crossings[i + 1] - 0.5));
        x++
      )
        mask[y * width + x] = 1;
  }
  return mask;
}
export function resizeSelection(
  mask: Mask,
  width: number,
  height: number,
  amount: number,
): Mask {
  // Separable square dilation/erosion. Outside the image counts as unselected.
  const radius = Math.min(30, Math.abs(Math.round(amount))),
    grow = amount > 0;
  const pass = (source: Mask, horizontal: boolean) => {
    const out = new Uint8Array(source.length);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        let value = grow ? 0 : 1;
        for (let d = -radius; d <= radius; d++) {
          const nx = horizontal ? x + d : x,
            ny = horizontal ? y : y + d;
          const sample =
            nx < 0 || ny < 0 || nx >= width || ny >= height
              ? 0
              : source[ny * width + nx];
          if (grow ? sample : !sample) {
            value = grow ? 1 : 0;
            break;
          }
        }
        out[y * width + x] = value;
      }
    return out;
  };
  return radius ? pass(pass(mask, true), false) : mask.slice();
}
export function editRaster(
  image: Raster,
  mask: Mask | null,
  action: "delete" | "keep" | "recolour" | "fill",
  colour = "#000000",
): Raster {
  const data = image.data.slice(),
    rgb = [1, 3, 5].map((i) => parseInt(colour.slice(i, i + 2), 16));
  for (let p = 0; p < image.width * image.height; p++) {
    const selected = !mask || !!mask[p];
    if ((action === "delete" && selected) || (action === "keep" && !selected))
      data[p * 4 + 3] = 0;
    if (selected && (action === "recolour" || action === "fill")) {
      rgb.forEach((c, i) => {
        data[p * 4 + i] = c;
      });
      if (action === "fill") data[p * 4 + 3] = 255;
    }
  }
  // ImageData width/height are prototype accessors, so object spread loses them.
  return { width: image.width, height: image.height, data };
}
