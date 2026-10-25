import "server-only";
import { unstable_cache } from "next/cache";
import { ADMIN_WORKSPACE_TAG, ADMIN_WORKSPACE_TTL } from "@/lib/adminWorkspaceCache";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { listCustomerSummaries } from "@/lib/customerHistory";
import { getInvoices } from "./orders/invoices/invoiceData";
import { getStatsDataset } from "./stats-v2/statsData";
import { readProductionOrders } from "./adminWorkspaceData";
import { getOrderSlots,getProductionSlots,getProductionDayNotes } from "@/lib/data";

const options = { revalidate:ADMIN_WORKSPACE_TTL,tags:[ADMIN_WORKSPACE_TAG] };
export const getCachedOrderSummaries = unstable_cache(readProductionOrders,["admin-order-summaries-v1"],options);
// Callers perform their existing role checks BEFORE using these shared business
// read models. User sessions, forms and payment writes are never cached here.
export const getCachedInvoices = unstable_cache(getInvoices,["admin-invoices-v1"],options);
export const getCachedStatsDataset = unstable_cache(getStatsDataset,["admin-stats-v1"],options);
export const getCachedCustomerList = unstable_cache(listCustomerSummaries,["admin-customer-list-v1"],options);
export const getCachedCustomerTotals = unstable_cache(async()=>{
  const {data,error}=await supabaseAdminClient.rpc("admin_customer_totals");
  if(error||!data)throw new Error("Unable to load customer totals.");
  return {ok:true as const,data:data as {totalCustomers:number;repeatCustomers:number;totalOrders:number;totalEnquiries:number;lifetimeValue:number;lowConfidenceCustomers:number}};
},["admin-customer-totals-v1"],options);
export const getCachedProductionDay = unstable_cache(async()=>{
  const [orders,assignments,slots,notes]=await Promise.all([readProductionOrders(),getOrderSlots(),getProductionSlots(),getProductionDayNotes()]);
  return {orders,assignments,slots,notes};
},["admin-production-day-v1"],options);
