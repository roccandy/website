/** Explicit pixel widths avoid browser differences in responsive <col> rules. */
export function productionColumnWidths(availableWidth: number): number[] {
  const width = Math.max(464, Number.isFinite(availableWidth) ? availableWidth : 464);
  const [order, date, packaging, kg, state] = width >= 700
    ? [width * 0.14, width * 0.16, width * 0.22, width * 0.10, width * 0.08]
    : [88, 96, 112, 64, 56];
  const strip = 12;
  return [order, width - order - date - packaging - kg - state - strip, date, packaging, kg, state, strip];
}
