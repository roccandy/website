const ORDER_NUMBER_PADDING = 4;
const ORDER_SUFFIX_PATTERN = /-[a-z]+$/i;

export function normalizeOrderNumber(input?: string | null) {
  const trimmed = input?.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
}

export function normalizeBaseOrderNumber(input?: string | null) {
  const normalized = normalizeOrderNumber(input);
  if (!normalized) return null;
  const base = normalized.replace(ORDER_SUFFIX_PATTERN, "").trim();
  if (!/^\d+$/.test(base)) return null;
  return base.padStart(ORDER_NUMBER_PADDING, "0");
}

export function orderNumberSuffixForIndex(index: number) {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error("Order suffix index must be a non-negative integer.");
  }

  let value = index;
  let suffix = "";
  do {
    suffix = String.fromCharCode(97 + (value % 26)) + suffix;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);

  return suffix;
}

export function buildSplitOrderNumber(base: string, index: number) {
  return `${base}-${orderNumberSuffixForIndex(index)}`;
}

export async function generateOrderNumber() {
  const { supabaseAdminClient } = await import("@/lib/supabase/admin");
  const { data, error } = await supabaseAdminClient
    .from("orders")
    .select("order_number");
  if (error) throw new Error(error.message);

  let max = 0;
  (data ?? []).forEach((row) => {
    const base = normalizeBaseOrderNumber(row.order_number);
    if (!base) return;
    const parsed = Number.parseInt(base, 10);
    if (Number.isFinite(parsed)) {
      max = Math.max(max, parsed);
    }
  });

  const next = String(max + 1).padStart(ORDER_NUMBER_PADDING, "0");
  return next;
}
