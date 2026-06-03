import type { ColorPaletteRow } from "@/lib/data";
import { paletteSections } from "@/app/admin/settings/palette";

export type ColorOption = { value: string; label: string; hex: string };
export type ColorFormat = "hex" | "rgb" | "cmyk";
export type CandyPreviewMode = "" | "rainbow" | "pinstripe" | "two_colour";

export const COLOR_FORMAT_OPTIONS: { value: ColorFormat; label: string }[] = [
  { value: "hex", label: "Hex" },
  { value: "rgb", label: "RGB" },
  { value: "cmyk", label: "CMYK" },
];

export const normalizeHex = (value: string) => {
  const trimmed = value.trim();
  if (!/^#?[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
  return trimmed.startsWith("#") ? trimmed.toLowerCase() : `#${trimmed.toLowerCase()}`;
};

export const isHexColor = (value: string) => /^#[0-9a-f]{6}$/i.test(value);

export const sanitizeHexInput = (value: string) => {
  const stripped = value.replace(/#/g, "").replace(/[^0-9a-f]/gi, "").slice(0, 6);
  if (!stripped) return "";
  return `#${stripped}`;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const clampColorChannel = clamp;

const rgbToHex = (r: number, g: number, b: number) => {
  const toHex = (channel: number) => Math.round(channel).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const hexToRgb = (value: string) => {
  const normalized = normalizeHex(value);
  if (!isHexColor(normalized)) return null;
  const raw = normalized.slice(1);
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  };
};

const rgbToCmyk = (r: number, g: number, b: number) => {
  const rNorm = clamp(r, 0, 255) / 255;
  const gNorm = clamp(g, 0, 255) / 255;
  const bNorm = clamp(b, 0, 255) / 255;
  const k = 1 - Math.max(rNorm, gNorm, bNorm);
  if (k >= 1) {
    return { c: 0, m: 0, y: 0, k: 100 };
  }
  const c = (1 - rNorm - k) / (1 - k);
  const m = (1 - gNorm - k) / (1 - k);
  const y = (1 - bNorm - k) / (1 - k);
  return {
    c: Math.round(c * 100),
    m: Math.round(m * 100),
    y: Math.round(y * 100),
    k: Math.round(k * 100),
  };
};

const cmykToRgb = (c: number, m: number, y: number, k: number) => {
  const cNorm = clamp(c, 0, 100) / 100;
  const mNorm = clamp(m, 0, 100) / 100;
  const yNorm = clamp(y, 0, 100) / 100;
  const kNorm = clamp(k, 0, 100) / 100;
  const r = 255 * (1 - cNorm) * (1 - kNorm);
  const g = 255 * (1 - mNorm) * (1 - kNorm);
  const b = 255 * (1 - yNorm) * (1 - kNorm);
  return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
};

export const formatColorInput = (value: string, format: ColorFormat) => {
  const normalized = normalizeHex(value);
  if (!normalized) return "";
  if (!isHexColor(normalized)) return normalized;
  if (format === "hex") return normalized.toLowerCase();
  const rgb = hexToRgb(normalized);
  if (!rgb) return normalized.toLowerCase();
  if (format === "rgb") return `${rgb.r}, ${rgb.g}, ${rgb.b}`;
  const cmyk = rgbToCmyk(rgb.r, rgb.g, rgb.b);
  return `${cmyk.c}, ${cmyk.m}, ${cmyk.y}, ${cmyk.k}`;
};

const parseNumericList = (input: string, expected: number) => {
  const matches = input.match(/-?\d*\.?\d+/g);
  if (!matches || matches.length !== expected) return null;
  const numbers = matches.map((value) => Number(value));
  if (numbers.some((value) => Number.isNaN(value))) return null;
  return numbers;
};

export const parseRgbInput = (input: string) => {
  const numbers = parseNumericList(input, 3);
  if (!numbers) return null;
  const [r, g, b] = numbers.map((value) => clamp(Math.round(value), 0, 255));
  return rgbToHex(r, g, b);
};

export const parseCmykInput = (input: string) => {
  const numbers = parseNumericList(input, 4);
  if (!numbers) return null;
  const [c, m, y, k] = numbers.map((value) => clamp(value, 0, 100));
  const rgb = cmykToRgb(c, m, y, k);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
};

export const parseHexInput = (input: string) => {
  const sanitized = sanitizeHexInput(input).toLowerCase();
  return isHexColor(sanitized) ? sanitized : null;
};

export const isCustomPaletteValue = (value: string, paletteSet: Set<string>) => {
  if (!value) return false;
  const normalized = normalizeHex(value);
  if (!normalized.startsWith("#")) return true;
  const key = normalized.toLowerCase();
  return !paletteSet.has(key);
};

export const buildPaletteOptions = (palette: ColorPaletteRow[]): ColorOption[] => {
  const options: ColorOption[] = [];
  const seen = new Set<string>();
  paletteSections.forEach((section) => {
    section.items.forEach((item) => {
      const match = palette.find((row) => row.category === item.categoryKey && row.shade === item.shadeKey);
      const hex = normalizeHex(match?.hex ?? item.defaultValue);
      if (!hex.startsWith("#")) return;
      const key = hex.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      options.push({ value: key, label: item.label, hex: key.toUpperCase() });
    });
  });
  return options;
};

export const buildColorOptions = (options: ColorOption[], currentValue: string): ColorOption[] => {
  const trimmed = currentValue.trim();
  if (!trimmed) return options;
  const normalized = normalizeHex(trimmed);
  if (normalized.startsWith("#")) {
    const key = normalized.toLowerCase();
    if (options.some((option) => option.value === key)) return options;
    return [{ value: key, label: "Custom", hex: key.toUpperCase() }, ...options];
  }
  if (options.some((option) => option.value === trimmed)) return options;
  return [{ value: trimmed, label: trimmed, hex: trimmed }, ...options];
};

export const getContrastTextColor = (hex: string) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#111827";
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.6 ? "#111827" : "#ffffff";
};

export const formatSizeLabel = (type: string, size: string) => {
  if (!type.toLowerCase().includes("jar")) return size;
  const trimmed = size.trim();
  if (!trimmed) return size;
  const withoutGrams = trimmed.replace(/\s*\(?\d+\s*g\)?$/i, "");
  return withoutGrams || trimmed;
};

export const toHexColor = (value: string, fallback = "#000000") => {
  const normalized = normalizeHex(value);
  return isHexColor(normalized) ? normalized : fallback;
};

export const selectValueForColor = (value: string) => {
  const normalized = normalizeHex(value);
  return isHexColor(normalized) ? normalized.toLowerCase() : value;
};

const normalizeJacketSearchText = (value: string | null | undefined) =>
  (value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

export function resolveCandyPreviewJacket(
  order: { jacket?: string | null; jacket_type?: string | null },
): { mode: CandyPreviewMode; showPinstripe: boolean } {
  const jacket = normalizeJacketSearchText(order.jacket);
  const jacketType = normalizeJacketSearchText(order.jacket_type);
  const combined = `${jacketType} ${jacket}`;
  const hasPinstripe = combined.includes("pinstripe") || combined.includes("pinstrip");
  const hasTwoColour =
    combined.includes("twocolour") ||
    combined.includes("twocolor") ||
    combined.includes("2colour") ||
    combined.includes("2color");

  if (combined.includes("rainbow")) {
    return { mode: "rainbow", showPinstripe: false };
  }

  if (hasTwoColour) {
    return { mode: "two_colour", showPinstripe: hasPinstripe };
  }

  if (hasPinstripe) {
    return { mode: "pinstripe", showPinstripe: true };
  }

  return { mode: "", showPinstripe: false };
}
