import "server-only";
import { unstable_cache } from "next/cache";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { ADMIN_WORKSPACE_TAG, ADMIN_WORKSPACE_TTL } from "@/lib/adminWorkspaceCache";
import type { OrderRow, OrderSlot, ProductionSlot } from "@/lib/data";

export type OrderHistoryPage = { total:number; page:number; pageSize:number; groupKeys:string[]; orders:OrderRow[]; slots:ProductionSlot[]; assignments:OrderSlot[] };

export const getOrderHistoryPage = unstable_cache(async (view:string, sort:string, direction:string, query:string, page:number): Promise<OrderHistoryPage> => {
  const { data, error } = await supabaseAdminClient.rpc("admin_order_history_page", {p_view:view,p_sort:sort,p_direction:direction,p_query:query.slice(0,200),p_page:page,p_page_size:50});
  if (error || !data || !Array.isArray(data.orders)) throw new Error("Unable to load order history. Please refresh and try again.");
  return data as unknown as OrderHistoryPage;
},["admin-order-history-page-v1"],{revalidate:ADMIN_WORKSPACE_TTL,tags:[ADMIN_WORKSPACE_TAG]});
