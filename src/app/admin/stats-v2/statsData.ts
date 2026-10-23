import "server-only";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { buildStatsDataset, type StatsRow } from "./statsModel";

// Deliberately leave notes, addresses, payment references, and uploaded image
// data out of this reporting query and its client payload.
const COLUMNS =
  "id,order_number,created_at,due_date,customer_email,customer_name,first_name,last_name,phone,organization_name,category_id,design_type,packaging_option_id,flavor,total_price,total_weight_kg,paid_at,refunded_at,refunded_amount,status,pickup,state,payment_provider,payment_method,square_invoice_status,made,shipped_at,archived_at";

export async function getStatsDataset() {
  const loadedAt = new Date().toISOString();
  const rows: StatsRow[] = [];
  const pageSize = 500;
  // Stable, paginated reads avoid Supabase's default 1,000-row response cap.
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabaseAdminClient
      .from("orders")
      .select(COLUMNS)
      .lte("created_at", loadedAt)
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error("Unable to load order reporting data.");
    rows.push(...(data as StatsRow[]));
    if (data.length < pageSize) break;
  }
  const [categoryResult, packagingResult] = await Promise.all([
    supabaseAdminClient.from("categories").select("id,name"),
    supabaseAdminClient.from("packaging_options").select("id,type,size"),
  ]);
  if (categoryResult.error || packagingResult.error)
    throw new Error("Unable to load reporting categories.");
  return buildStatsDataset(
    rows,
    new Map(categoryResult.data.map((row) => [row.id, row.name])),
    new Map(
      packagingResult.data.map((row) => [
        row.id,
        [row.type, row.size].filter(Boolean).join(" · "),
      ]),
    ),
    loadedAt,
  );
}
