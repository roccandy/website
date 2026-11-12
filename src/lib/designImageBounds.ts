import { designFaceRadius, type CandyDesign } from "@/lib/candyDesign";
export function designImageBounds(design: CandyDesign) {
  const radius = designFaceRadius(design),
    points: [number, number][] = [];
  for (const l of design.layers.filter(
    (l) => l.visible && l.type === "image" && (l.opacity ?? 1) > 0,
  )) {
    const base = l.frame === "scene" ? 1772 : radius * 2;
    const boxW = (l.size / 100) * base,
      boxH = boxW / (l.aspectRatio ?? 1),
      natural =
        l.imageWidth && l.imageHeight
          ? l.imageWidth / l.imageHeight
          : (l.aspectRatio ?? 1);
    const width = Math.min(boxW, boxH * natural) * (l.scaleX ?? 1),
      height = Math.min(boxH, boxW / natural) * (l.scaleY ?? 1);
    const x =
        l.frame === "scene"
          ? (l.x / 100) * 1772
          : 545 - radius + (l.x / 100) * radius * 2,
      y =
        l.frame === "scene"
          ? (l.y / 100) * 1300
          : 660 - radius + (l.y / 100) * radius * 2;
    const a = (l.rotation * Math.PI) / 180;
    for (const dx of [-width / 2, width / 2])
      for (const dy of [-height / 2, height / 2])
        points.push([
          x + dx * Math.cos(a) - dy * Math.sin(a),
          y + dx * Math.sin(a) + dy * Math.cos(a),
        ]);
  }
  if (!points.length)
    throw new Error("Add a visible image layer before cropping to artwork.");
  const x = Math.min(...points.map((p) => p[0])),
    y = Math.min(...points.map((p) => p[1]));
  return {
    x,
    y,
    width: Math.max(...points.map((p) => p[0])) - x,
    height: Math.max(...points.map((p) => p[1])) - y,
  };
}
export function designExportSize(
  design: CandyDesign,
  options: {
    view?: "face" | "three-dimensional";
    cropImages?: boolean;
    resolution?: "native" | 1 | 2 | 4 | 6;
    width?: number;
  } = {},
) {
  const bounds = options.cropImages
    ? designImageBounds(design)
    : options.view === "face"
      ? { x: 0, y: 110, width: 1090, height: 1090 }
      : { x: 0, y: 0, width: 1772, height: 1300 };
  let scale = options.view === "face" ? 1040 / 1090 : 1040 / 1300;
  if (Number.isFinite(options.width) && (options.width ?? 0) > 0) {
    scale = (options.width ?? 1) / bounds.width;
  } else if (options.resolution === "native") {
    scale = options.cropImages ? 0 : 0.8;
    for (const l of design.layers.filter(
      (l) => l.visible && l.type === "image",
    )) {
      const width =
        (l.size / 100) *
        (l.frame === "scene" ? 1772 : designFaceRadius(design) * 2) *
        (l.scaleX ?? 1);
      if (l.imageWidth)
        scale = Math.max(scale, l.imageWidth / Math.max(1, width));
      if (l.imageHeight)
        scale = Math.max(
          scale,
          l.imageHeight /
            Math.max(
              1,
              ((width / (l.aspectRatio ?? 1)) * (l.scaleY ?? 1)) /
                (l.scaleX ?? 1),
            ),
        );
    }
  } else if (options.resolution) scale *= options.resolution;
  if (!scale) scale = 1;
  const limited = Math.min(
    scale,
    16000 / bounds.width,
    16000 / bounds.height,
    Math.sqrt(36_000_000 / (bounds.width * bounds.height)),
  );
  return {
    bounds,
    width: Math.max(1, Math.round(bounds.width * limited)),
    height: Math.max(1, Math.round(bounds.height * limited)),
    scale: limited,
    capped: limited < scale,
  };
}
