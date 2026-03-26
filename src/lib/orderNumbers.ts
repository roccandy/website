import { supabaseAdminClient } from "@/lib/supabase/admin";

const ORDER_NUMBER_PADDING = 4;
const ORDER_SUFFIX_PATTERN = /-(a|b)$/i;

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

export async function generateOrderNumber() {
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
