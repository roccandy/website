import type { CandyDesign } from "@/lib/candyDesign";
export type TextGeometry = {
  signature: string;
  layers: Record<
    string,
    {
      text: string;
      font: string;
      width: number;
      strokeWidth?: number;
      points: [number, number][];
      clipped: number;
      glyphs: { d: string; transform: string }[];
    }
  >;
};
export function textGeometrySignature(design: CandyDesign) {
  const diameter =
    design.schemaVersion === 2 && design.jacket.advanced
      ? 1064 * (1 - design.jacket.advanced.ring)
      : 870;
  return JSON.stringify([
    diameter,
    design.layers
      .filter((l) => l.type === "text" && l.visible)
      .map((l) => [
        l.id,
        l.text,
        l.uppercase ?? false,
        l.font,
        l.bold,
        l.italic,
        l.size,
        l.spacing,
        l.curve,
        l.arcRadius ?? 320,
        l.arcOffset ?? 0,
        l.fullArc ?? false,
        l.frame ?? "face",
      ]),
  ]);
}
export function parseTextGeometry(value: unknown): TextGeometry | undefined {
  if (!value || typeof value !== "object") return;
  const v = value as TextGeometry;
  if (
    typeof v.signature !== "string" ||
    v.signature.length > 20000 ||
    !v.layers ||
    typeof v.layers !== "object" ||
    Object.keys(v.layers).length > 20
  )
    return;
  for (const layer of Object.values(v.layers)) {
    if (
      !layer ||
      typeof layer.text !== "string" ||
      typeof layer.font !== "string" ||
      !Number.isFinite(layer.width) ||
      !Number.isFinite(layer.clipped) ||
      !Array.isArray(layer.glyphs) ||
      layer.glyphs.length > 240 ||
      !Array.isArray(layer.points) ||
      layer.points.length > 960
    )
      return;
    if (
      layer.glyphs.some(
        (g) =>
          typeof g.d !== "string" ||
          g.d.length > 100000 ||
          !/^[MmLlHhVvCcSsQqTtAaZz0-9.eE, +\-]*$/.test(g.d) ||
          typeof g.transform !== "string" ||
          !/^[translatecoskwXY0-9.eE, ()+\-]*$/.test(g.transform),
      )
    )
      return;
    if (
      layer.points.some(
        (p) => !Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite),
      )
    )
      return;
    if (
      layer.strokeWidth !== undefined &&
      (!Number.isFinite(layer.strokeWidth) ||
        layer.strokeWidth < 0 ||
        layer.strokeWidth > 100)
    )
      return;
  }
  return v;
}
export function renderTextGeometry(geometry: TextGeometry) {
  return Object.fromEntries(
    Object.entries(geometry.layers).map(([id, layer]) => [
      id,
      <g key={id} data-outlined-font={layer.font}>
        <title>{layer.text}</title>
        {layer.glyphs.map((glyph, i) => (
          <path
            key={i}
            data-outline-glyph={i}
            d={glyph.d}
            transform={glyph.transform}
            fill="currentColor"
            stroke={layer.strokeWidth ? "currentColor" : undefined}
            strokeWidth={layer.strokeWidth ? layer.strokeWidth : undefined}
            strokeLinejoin="round"
            paintOrder="stroke"
          />
        ))}
      </g>,
    ]),
  );
}
export function studioTextWarnings(
  design: CandyDesign,
  geometry?: TextGeometry,
) {
  if (!geometry || geometry.signature !== textGeometrySignature(design))
    return [];
  const radius =
    design.schemaVersion === 2 && design.jacket.advanced
      ? 532 * (1 - design.jacket.advanced.ring)
      : 435;
  return design.layers
    .filter((l) => l.type === "text" && l.visible && (l.opacity ?? 1) > 0)
    .flatMap((l) => {
      const data = geometry.layers[l.id];
      if (!data) return [];
      const angle = (l.rotation * Math.PI) / 180,
        cos = Math.cos(angle),
        sin = Math.sin(angle);
      const offX = ((l.x - 50) / 100) * radius * 2,
        offY = ((l.y - 50) / 100) * radius * 2;
      const clipped =
        l.surface !== "jacket" &&
        data.points.some(([x, y]) => {
          x *= (l.scaleX ?? 1) * (l.flipX ? -1 : 1);
          y *= (l.scaleY ?? 1) * (l.flipY ? -1 : 1);
          return (
            Math.hypot(offX + x * cos - y * sin, offY + x * sin + y * cos) >
            radius + 1
          );
        });
      return clipped || data.clipped
        ? [
            `${l.name || "Text"}: lettering may be clipped by its face or text path. Check the preview or use Fit text to face.`,
          ]
        : [];
    });
}
