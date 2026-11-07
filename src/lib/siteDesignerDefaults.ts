/** Shared baseline for the public designer and new admin artwork. */
export const SITE_DESIGNER_DEFAULTS = {
  fontFamily: "Helvetica, Arial, sans-serif",
  jacketColour: "#d1d5db",
  textColour: "#b7b7b7",
  fill: "#ffffff",
  pinstripe: "#ffffff",
  straightFontSize: 132,
  genericFontSize: 122,
  weddingFontSize: 130,
  initialsFontSize: 180,
  heartScale: 9.49,
  arcRadius: 320,
  lowerArcYOffset: 24,
  initialsOffset: 230,
  straightSpacingEm: 0.03,
  weddingSpacingEm: 0.08,
  initialsSpacingEm: 0.2,
  stackedSpacingEm: 0.035,
  faceDiameter: 870,
} as const;
export type SiteDesignerDefaults = { jacketColour: string; textColour: string };
export function resolveSiteDesignerDefaults(
  palette: ReadonlyArray<{ category: string; shade: string; hex: string }> = [],
): SiteDesignerDefaults {
  const grey = palette.find(
    (row) => row.category === "grey" && row.shade === "light",
  )?.hex;
  return {
    jacketColour: grey ?? SITE_DESIGNER_DEFAULTS.jacketColour,
    textColour: grey ?? SITE_DESIGNER_DEFAULTS.textColour,
  };
}
export const siteFontSizePercent = (size: number) =>
  Math.round((size / SITE_DESIGNER_DEFAULTS.faceDiameter) * 100000) / 1000;

export type CustomTextLayout =
  | { kind: "straight"; text: string }
  | { kind: "singleArc"; text: string }
  | { kind: "stacked"; words: string[] }
  | { kind: "twoArc"; top: string; bottom: string };

const nonSpaceLength = (value: string) => value.replace(/\s/g, "").length;

export function getCustomTextLayout(
  text: string,
  variant?: "short" | "long",
): CustomTextLayout | null {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  if (variant === "short") return { kind: "straight", text: trimmed };
  if (variant !== "long") return null;

  const words = trimmed.split(" ").filter(Boolean);
  const letters = nonSpaceLength(trimmed);

  if (words.length === 1) {
    return letters <= 6
      ? { kind: "straight", text: trimmed }
      : { kind: "singleArc", text: trimmed };
  }

  if (words.length === 2) {
    const eachWordFitsStraight = words.every(
      (word) => nonSpaceLength(word) <= 6,
    );
    if (letters <= 11 && eachWordFitsStraight)
      return { kind: "stacked", words };
    return { kind: "twoArc", top: words[0] ?? "", bottom: words[1] ?? "" };
  }

  if (words.length === 3 && words.every((word) => nonSpaceLength(word) <= 6)) {
    return { kind: "stacked", words };
  }

  return { kind: "singleArc", text: trimmed };
}

export const CUSTOM_ARC_LETTER_SPACING_EM = 0.1;
const CUSTOM_ARC_MAX_WIDTH_RATIO = 0.86;
export const CUSTOM_SINGLE_ARC_MAX_WIDTH_RATIO = 0.84;
const CUSTOM_ARC_MIN_FONT_SIZE = 88;
const CUSTOM_ARC_MIN_LETTER_SPACING_EM = 0.045;

function estimateArcTextWidth(
  text: string,
  fontSize: number,
  letterSpacingEm: number,
) {
  const glyphWidth = Array.from(text.toUpperCase()).reduce((total, char) => {
    if (char === " ") return total + 0.34;
    if ("MW".includes(char)) return total + 0.95;
    if ("@#%&".includes(char)) return total + 0.86;
    if ("OQCG".includes(char)) return total + 0.74;
    if ("ABDHKNPRUSVXYZ".includes(char)) return total + 0.66;
    if ("0123456789".includes(char)) return total + 0.56;
    if ("ILTJ".includes(char)) return total + 0.38;
    return total + 0.5;
  }, 0);
  const letterCount = Array.from(text).filter((char) => char !== " ").length;
  const spacingWidth =
    Math.max(0, letterCount - 1) * letterSpacingEm * fontSize;
  return glyphWidth * fontSize + spacingWidth;
}

export function getCustomArcTextStyle(
  text: string,
  baseFontSize: number,
  arcRadius: number,
  maxWidthRatio = CUSTOM_ARC_MAX_WIDTH_RATIO,
) {
  const maxWidth = Math.PI * arcRadius * maxWidthRatio;
  const estimatedWidth = estimateArcTextWidth(
    text,
    baseFontSize,
    CUSTOM_ARC_LETTER_SPACING_EM,
  );
  const scale = estimatedWidth > maxWidth ? maxWidth / estimatedWidth : 1;
  const fontSize = Math.max(
    CUSTOM_ARC_MIN_FONT_SIZE,
    Math.floor(baseFontSize * scale),
  );
  const letterSpacingEm = Math.max(
    CUSTOM_ARC_MIN_LETTER_SPACING_EM,
    CUSTOM_ARC_LETTER_SPACING_EM * scale,
  );

  return {
    fontSize,
    letterSpacing: `${letterSpacingEm.toFixed(3)}em`,
  };
}
