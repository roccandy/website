import { parseCandyDesign, type CandyDesign } from "@/lib/candyDesign";

export const studioArtworkSignature = (design: CandyDesign) =>
  JSON.stringify(design);
export const studioRecoveryKey = (scope: string) =>
  `roccandy-studio-recovery-v2:${scope}`;
export function encodeStudioRecovery(
  design: CandyDesign,
  baseline: CandyDesign,
) {
  return JSON.stringify({
    version: 1,
    baseline: studioArtworkSignature(baseline),
    design,
    savedAt: Date.now(),
  });
}
export function readStudioRecovery(raw: string | null, baseline: CandyDesign) {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (value.version !== 1) return null;
    const design = parseCandyDesign(value.design);
    if (
      !design ||
      studioArtworkSignature(design) === studioArtworkSignature(baseline)
    )
      return null;
    const changedSource = value.baseline !== studioArtworkSignature(baseline);
    // Recovery must never overwrite a newer source revision or another order.
    if (changedSource) delete design.source;
    return { design, changedSource, savedAt: Number(value.savedAt) || 0 };
  } catch {
    return null;
  }
}
