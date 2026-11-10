import { DEFAULT_ADVANCED_JACKET, type CandyDesign } from "@/lib/candyDesign";

export const JACKET_CX = 545,
  JACKET_CY = 660,
  JACKET_R = 532;
const DX = 500,
  DY = -100,
  TAU = Math.PI * 2;
const visibleStart = Math.atan2(DY, DX) - Math.PI / 2;
const visibleEnd = visibleStart + Math.PI;
const point = (angle: number, radius = JACKET_R, back = false) =>
  `${JACKET_CX + radius * Math.cos(angle) + (back ? DX : 0)},${JACKET_CY + radius * Math.sin(angle) + (back ? DY : 0)}`;

function arcPoints(start: number, end: number, back = false) {
  const count = Math.max(1, Math.ceil(Math.abs(end - start) / (Math.PI / 90)));
  return Array.from({ length: count + 1 }, (_, i) =>
    point(start + ((end - start) * i) / count, JACKET_R, back),
  );
}
export function jacketBodyPath(start = visibleStart, end = visibleEnd) {
  return `M${arcPoints(start, end).join(" L")} L${arcPoints(end, start, true).join(" L")} Z`;
}
export function jacketRingPath(start: number, end: number, inner: number) {
  const large = end - start > Math.PI ? 1 : 0;
  return `M${point(start)} A${JACKET_R},${JACKET_R} 0 ${large} 1 ${point(end)} L${point(end, inner)} A${inner},${inner} 0 ${large} 0 ${point(start, inner)} Z`;
}
/** Shared vector construction: every side band uses its adjoining face band's colour. */
export function jacketGeometry(design: CandyDesign) {
  const j = design.jacket,
    a = j.advanced ?? DEFAULT_ADVANCED_JACKET;
  const palette =
    j.mode === "solid"
      ? j.colours.slice(0, 1)
      : j.mode === "two_colour"
        ? j.colours.slice(0, 2)
        : j.colours;
  const inner = JACKET_R * (1 - a.ring);
  const count = j.mode === "rainbow" ? 96 : a.segments;
  const bands: { start: number; end: number; colour: string }[] = [];
  for (let i = 0; i < count; i++) {
    const start = -Math.PI / 2 + (i * TAU) / count,
      end = start + TAU / count;
    const colour =
      j.mode === "rainbow"
        ? `hsl(${(i / count) * 320},88%,58%)`
        : palette[i % palette.length] || "#b7b7b7";
    if (j.showPinstripe && j.mode !== "rainbow") {
      const halfGap = (a.gap * (end - start)) / 2;
      bands.push(
        { start, end: start + halfGap, colour: j.pinstripe },
        { start: start + halfGap, end: end - halfGap, colour },
        { start: end - halfGap, end, colour: j.pinstripe },
      );
    } else bands.push({ start, end, colour });
  }
  const body: { d: string; colour: string }[] = [];
  for (const band of bands) {
    for (const offset of [-TAU, 0, TAU]) {
      const start = Math.max(visibleStart, band.start + offset),
        end = Math.min(visibleEnd, band.end + offset);
      if (end > start + 1e-8)
        body.push({ d: jacketBodyPath(start, end), colour: band.colour });
    }
  }
  return {
    inner,
    body,
    ring: bands.map((band) => ({
      d: jacketRingPath(band.start, band.end, inner),
      colour: band.colour,
    })),
  };
}
