import "server-only";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import type { OrderSlot, ProductionDayNote, ProductionSlot } from "@/lib/data";
import { buildTodayHub, type TodayOrder } from "./todayModel";

async function readAll<T>(
  table: string,
  columns: string,
  loadedAt: string,
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabaseAdminClient
      .from(table)
      .select(columns)
      .lte("created_at", loadedAt)
      .order("id", { ascending: true })
      .range(offset, offset + 499);
    if (error)
      throw new Error("Unable to load the Today hub. Please try again.");
    rows.push(...(data as unknown as T[]));
    if (data.length < 500) return rows;
  }
}

export async function getTodayHub() {
  const loadedAt = new Date().toISOString();
  const [orders, slots, assignments, notes] = await Promise.all([
    readAll<TodayOrder>(
      "orders",
      "id,order_number,title,customer_name,first_name,last_name,created_at,due_date,design_type,category_id,notes,total_price,total_weight_kg,admin_batch_weights_kg,made,pickup,status,paid_at,payment_provider,payment_method,woo_order_id,woo_payment_url,square_invoice_id,square_invoice_status,square_invoice_sent_at,square_invoice_due_date,square_invoice_error,refunded_at,refund_reason,refunded_amount,archived_at,shipped_at",
      loadedAt,
    ),
    readAll<Pick<ProductionSlot, "id" | "slot_date" | "slot_index">>(
      "production_slots",
      "id,slot_date,slot_index",
      loadedAt,
    ),
    readAll<Pick<OrderSlot, "id" | "order_id" | "slot_id" | "kg_assigned">>(
      "order_slots",
      "id,order_id,slot_id,kg_assigned",
      loadedAt,
    ),
    readAll<Pick<ProductionDayNote, "note_date" | "note">>(
      "production_day_notes",
      "note_date,note",
      loadedAt,
    ),
  ]);
  return buildTodayHub(orders, slots, assignments, notes, loadedAt);
}
