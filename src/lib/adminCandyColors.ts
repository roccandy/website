export const DEFAULT_CANDY_FILL = "#ffffff";

/** New admin-only colour fields accept opaque six-digit hex colours. */
export function adminCandyColor(value: unknown, fallback = DEFAULT_CANDY_FILL): string {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value !== "string" || !/^#?[0-9a-f]{6}$/i.test(value.trim())) {
    throw new Error("Candy fill and pinstripe colours must be valid six-digit hex colours.");
  }
  return `#${value.trim().replace(/^#/, "").toLowerCase()}`;
}
