import "server-only";
import { unstable_cache } from "next/cache";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { getCategories, getOrderSlots, getProductionDayNotes, getProductionSlots, type OrderRow } from "@/lib/data";
import { buildPricingContext } from "@/lib/pricing";
import { listRecentAdminActivity } from "@/lib/adminActivity";
import { ADMIN_WORKSPACE_TAG, ADMIN_WORKSPACE_TTL } from "@/lib/adminWorkspaceCache";
import { getTodayHub } from "./today/todayData";
import { productionLogoUrl } from "@/lib/inlineOrderLogo";

// The schedule never uses label artwork. Avoid transferring megabytes of inline
// label images from the database and serialising them into every calendar visit.
export const PRODUCTION_ORDER_COLUMNS = "id,order_number,title,order_description,customer_name,customer_email,category_id,packaging_option_id,quantity,jar_lid_color,labels_count,ingredient_labels_count,jacket,design_type,design_text,jacket_type,jacket_color_one,jacket_color_two,candy_fill_color,pinstripe_color,text_color,heart_color,flavor,payment_method,logo_url,due_date,label_type_id,total_weight_kg,total_price,status,notes,customer_note,made,pickup,state,location,first_name,last_name,phone,organization_name,address_line1,address_line2,suburb,postcode,woo_order_id,woo_order_status,woo_order_key,woo_payment_url,paid_at,payment_provider,payment_transaction_id,admin_batch_weights_kg,admin_pricing_subtotal,admin_discount_type,admin_discount_value,admin_price_override,admin_price_locked_at,square_customer_id,square_order_id,square_invoice_id,square_invoice_title,square_invoice_version,square_invoice_status,square_invoice_url,square_invoice_due_date,square_invoice_created_at,square_invoice_sent_at,square_invoice_error,refunded_at,refund_reason,refunded_amount,archived_at,shipped_at,created_at";

export async function readProductionOrders(): Promise<OrderRow[]> {
  const rows: OrderRow[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabaseAdminClient.from("orders").select(PRODUCTION_ORDER_COLUMNS).order("id").range(offset, offset + 499);
    if (error) throw new Error("Unable to load production orders. Please try again.");
    rows.push(...(data as unknown as OrderRow[]).map(row => ({ ...row, label_image_url: null, logo_url: productionLogoUrl(row.id, row.logo_url) })));
    if (data.length < 500) return rows;
  }
}

/** Full artwork is only needed for the one order being edited/re-made. */
export async function readOrderForRemake(id: string): Promise<OrderRow|null> {
  if(!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const {data,error}=await supabaseAdminClient.from("orders").select("*").eq("id",id).maybeSingle();
  if(error)throw new Error("Unable to load the original order.");
  return data as OrderRow|null;
}

// Only call after the page's authentication/role checks. No sessions or per-user
// permissions are cached. Other pages and checkout continue to read fresh data.
export const getProductionWorkspaceData = unstable_cache(async () => {
  const [orders, slots, assignments, dayNotes, pricingContext, categories, activityLog] = await Promise.all([
    readProductionOrders(), getProductionSlots(), getOrderSlots(), getProductionDayNotes(),
    buildPricingContext({ includeInactivePackaging: true }), getCategories(), listRecentAdminActivity(200),
  ]);
  return { orders, slots, assignments, dayNotes, pricingContext, categories, activityLog, loadedAt: new Date().toISOString() };
}, ["production-workspace-v1"], { revalidate: ADMIN_WORKSPACE_TTL, tags: [ADMIN_WORKSPACE_TAG] });

export const getCachedTodayHub = unstable_cache(getTodayHub, ["today-workspace-v1"], { revalidate: ADMIN_WORKSPACE_TTL, tags: [ADMIN_WORKSPACE_TAG] });
