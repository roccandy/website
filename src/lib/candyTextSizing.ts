/** Only short, straight custom text grows; wedding/long-text layouts are unchanged. */
export function shortCandyTextScale(text: string) {
  const length = Array.from(text.replace(/\s/g, "")).length;
  if (length === 1) return 1.7;
  if (length >= 2 && length <= 3) return 1.4;
  if (length >= 4 && length <= 5) return 1.2;
  return 1;
}
