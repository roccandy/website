export const DEFAULT_PACKAGING_LID_COLORS = [
  { name: "black", hex: "#1f1f1f" },
  { name: "silver", hex: "#d7d7d7" },
  { name: "gold", hex: "#d2b16f" },
] as const;

export const FALLBACK_PACKAGING_LID_HEX = "#d4d4d8";

export function normalizePackagingLidColorName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function normalizePackagingLidColorHex(value: string) {
  const normalized = value.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(normalized) ? normalized : null;
}

export function getPackagingLidColorHex(
  colors: ReadonlyArray<{ name: string; hex: string }>,
  name: string,
) {
  const normalizedName = normalizePackagingLidColorName(name);
  const match = colors.find((color) => normalizePackagingLidColorName(color.name) === normalizedName);
  return normalizePackagingLidColorHex(match?.hex ?? "") ?? FALLBACK_PACKAGING_LID_HEX;
}
