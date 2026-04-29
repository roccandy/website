import type { Session } from "next-auth";
import { supabaseAdminClient } from "@/lib/supabase/admin";

export type CustomerSourceSystem = "legacy_old" | "legacy_new" | "current_next";
export type CustomerMatchConfidence = "high" | "medium" | "low";

export type CustomerSummary = {
  id: string;
  canonical_key: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  primary_email: string | null;
  primary_phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  country: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  order_count: number;
  enquiry_count: number;
  lifetime_value: number;
  source_systems: CustomerSourceSystem[];
  match_confidence: CustomerMatchConfidence;
};

export type CustomerIdentity = {
  id: string;
  customer_id: string;
  identity_type: "email" | "phone" | "name_address" | "source";
  identity_value: string;
  label: string | null;
  source_system: CustomerSourceSystem;
  source_id: string | null;
  confidence: CustomerMatchConfidence;
  created_at: string;
};

export type CustomerOrderHistory = {
  id: string;
  customer_id: string;
  source_system: CustomerSourceSystem;
  source_id: string;
  source_order_number: string | null;
  display_order_number: string;
  order_status: string | null;
  order_type: string | null;
  customer_name: string | null;
  customer_email: string | null;
  phone: string | null;
  company: string | null;
  address_line1: string | null;
  address_line2: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  country: string | null;
  created_at_source: string | null;
  due_date: string | null;
  completed_at: string | null;
  paid_at: string | null;
  total_price: number | null;
  payment_total: number | null;
  refunded_total: number | null;
  payment_summary: string | null;
  payment_reference: string | null;
  payment_provider: string | null;
  card_brand: string | null;
  card_last4: string | null;
  currency: string;
  pickup: boolean | null;
  notes: string | null;
  internal_notes: string | null;
  raw_sanitized: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CustomerOrderItem = {
  id: string;
  order_history_id: string;
  source_system: CustomerSourceSystem;
  source_id: string;
  source_order_id: string | null;
  title: string | null;
  design_type: string | null;
  design_text: string | null;
  flavor: string | null;
  quantity: number | null;
  total_weight_kg: number | null;
  unit_price: number | null;
  total_price: number | null;
  made: boolean | null;
  colors: Record<string, unknown>;
  packaging_summary: string | null;
  asset_refs: Record<string, unknown>;
  raw_sanitized: Record<string, unknown>;
};

export type CustomerContactEvent = {
  id: string;
  customer_id: string;
  source_system: CustomerSourceSystem;
  source_id: string;
  event_type: "enquiry";
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  subject: string | null;
  message: string | null;
  occurred_at: string | null;
  subscribed: boolean | null;
  attachment_path: string | null;
  source_category: string | null;
  raw_sanitized: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CustomerNote = {
  id: string;
  customer_id: string;
  body: string;
  created_by_name: string | null;
  created_by_email: string | null;
  created_at: string;
};

export type CustomerStats = {
  totalCustomers: number;
  repeatCustomers: number;
  totalOrders: number;
  totalEnquiries: number;
  lifetimeValue: number;
  lowConfidenceCustomers: number;
};

export type CustomerFilter = "all" | "repeat" | "company" | "orders" | "enquiries" | "low-confidence";

export type CustomerListOptions = {
  query?: string | null;
  filter?: CustomerFilter;
  source?: CustomerSourceSystem | "all";
  limit?: number;
};

export type CustomerDetail = {
  customer: CustomerSummary;
  identities: CustomerIdentity[];
  orders: CustomerOrderHistory[];
  itemsByOrderId: Map<string, CustomerOrderItem[]>;
  events: CustomerContactEvent[];
  notes: CustomerNote[];
  duplicateCandidates: CustomerSummary[];
};

export type CustomerHistorySchemaResult<T> =
  | { ok: true; data: T }
  | { ok: false; data: T; schemaMissing: true; message: string };

const CUSTOMER_SELECT =
  "id,canonical_key,display_name,first_name,last_name,company,primary_email,primary_phone,address_line1,address_line2,suburb,state,postcode,country,first_seen_at,last_seen_at,order_count,enquiry_count,lifetime_value,source_systems,match_confidence";

const CUSTOMER_TABLES = [
  "customers",
  "customer_identities",
  "customer_order_history",
  "customer_order_items",
  "customer_contact_events",
  "customer_notes",
] as const;

export function canAccessCustomerCrm(user: Session["user"] | undefined) {
  if (!user) return false;
  return user.role !== "production" && user.role !== "seo";
}

export function isCustomerFilter(value: string | null | undefined): value is CustomerFilter {
  return (
    value === "all" ||
    value === "repeat" ||
    value === "company" ||
    value === "orders" ||
    value === "enquiries" ||
    value === "low-confidence"
  );
}

export function isCustomerSourceSystem(value: string | null | undefined): value is CustomerSourceSystem {
  return value === "legacy_old" || value === "legacy_new" || value === "current_next";
}

export function customerSourceLabel(source: string | null | undefined) {
  if (source === "legacy_old") return "Old site";
  if (source === "legacy_new") return "New legacy site";
  if (source === "current_next") return "Current site";
  return "Unknown";
}

export function isMissingCustomerHistorySchemaError(error: { message?: string | null } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? "";
  return CUSTOMER_TABLES.some((table) => message.includes(table)) && (
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("could not find")
  );
}

export async function listCustomerSummaries(
  options: CustomerListOptions = {},
): Promise<CustomerHistorySchemaResult<CustomerSummary[]>> {
  const limit = Math.min(Math.max(options.limit ?? 250, 1), 500);
  const queryText = options.query?.trim() ?? "";
  const source = options.source && options.source !== "all" ? options.source : null;
  const filter = options.filter ?? "all";
  const client = supabaseAdminClient;

  try {
    let customerQuery = client
      .from("customers")
      .select(CUSTOMER_SELECT)
      .order("last_seen_at", { ascending: false, nullsFirst: false })
      .limit(limit);

    if (source) {
      customerQuery = customerQuery.contains("source_systems", [source]);
    }
    if (filter === "repeat") customerQuery = customerQuery.gt("order_count", 1);
    if (filter === "company") customerQuery = customerQuery.not("company", "is", null);
    if (filter === "orders") customerQuery = customerQuery.gt("order_count", 0);
    if (filter === "enquiries") customerQuery = customerQuery.gt("enquiry_count", 0);
    if (filter === "low-confidence") customerQuery = customerQuery.eq("match_confidence", "low");

    if (queryText) {
      const escaped = escapePostgrestLike(queryText);
      customerQuery = customerQuery.or(
        [
          `display_name.ilike.%${escaped}%`,
          `company.ilike.%${escaped}%`,
          `primary_email.ilike.%${escaped}%`,
          `primary_phone.ilike.%${escaped}%`,
          `suburb.ilike.%${escaped}%`,
          `postcode.ilike.%${escaped}%`,
        ].join(","),
      );
    }

    const { data, error } = await customerQuery;
    if (error) throw error;

    let customers = (data ?? []) as CustomerSummary[];
    if (queryText) {
      const { data: orderMatches, error: orderError } = await client
        .from("customer_order_history")
        .select("customer_id")
        .or(
          [
            `display_order_number.ilike.%${escapePostgrestLike(queryText)}%`,
            `source_order_number.ilike.%${escapePostgrestLike(queryText)}%`,
          ].join(","),
        )
        .limit(100);

      if (orderError) throw orderError;
      const matchedIds = Array.from(new Set((orderMatches ?? []).map((row) => row.customer_id).filter(Boolean)));
      const missingIds = matchedIds.filter((id) => !customers.some((customer) => customer.id === id));

      if (missingIds.length > 0) {
        const { data: orderCustomers, error: customersError } = await client
          .from("customers")
          .select(CUSTOMER_SELECT)
          .in("id", missingIds)
          .limit(limit);
        if (customersError) throw customersError;
        customers = [...customers, ...((orderCustomers ?? []) as CustomerSummary[])];
      }
    }

    return { ok: true, data: customers.slice(0, limit) };
  } catch (error) {
    if (isMissingCustomerHistorySchemaError(error as { message?: string })) {
      return {
        ok: false,
        data: [],
        schemaMissing: true,
        message: "Customer history tables are not installed yet. Apply docs/sql/2026-04-29-customer-history-crm.sql first.",
      };
    }
    throw error;
  }
}

export async function getCustomerHistoryStats(): Promise<CustomerHistorySchemaResult<CustomerStats>> {
  const empty = {
    totalCustomers: 0,
    repeatCustomers: 0,
    totalOrders: 0,
    totalEnquiries: 0,
    lifetimeValue: 0,
    lowConfidenceCustomers: 0,
  };

  try {
    const { data, error } = await supabaseAdminClient
      .from("customers")
      .select("order_count,enquiry_count,lifetime_value,match_confidence");
    if (error) throw error;

    const rows = (data ?? []) as Array<{
      order_count: number | null;
      enquiry_count: number | null;
      lifetime_value: number | null;
      match_confidence: CustomerMatchConfidence | null;
    }>;

    return {
      ok: true,
      data: rows.reduce<CustomerStats>(
        (stats, row) => ({
          totalCustomers: stats.totalCustomers + 1,
          repeatCustomers: stats.repeatCustomers + (Number(row.order_count ?? 0) > 1 ? 1 : 0),
          totalOrders: stats.totalOrders + Number(row.order_count ?? 0),
          totalEnquiries: stats.totalEnquiries + Number(row.enquiry_count ?? 0),
          lifetimeValue: stats.lifetimeValue + Number(row.lifetime_value ?? 0),
          lowConfidenceCustomers: stats.lowConfidenceCustomers + (row.match_confidence === "low" ? 1 : 0),
        }),
        empty,
      ),
    };
  } catch (error) {
    if (isMissingCustomerHistorySchemaError(error as { message?: string })) {
      return {
        ok: false,
        data: empty,
        schemaMissing: true,
        message: "Customer history tables are not installed yet.",
      };
    }
    throw error;
  }
}

export async function getCustomerDetail(id: string): Promise<CustomerDetail | null> {
  const client = supabaseAdminClient;
  const { data: customer, error: customerError } = await client
    .from("customers")
    .select(CUSTOMER_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (customerError) throw new Error(customerError.message);
  if (!customer) return null;

  const [identitiesResult, ordersResult, eventsResult, notesResult] = await Promise.all([
    client.from("customer_identities").select("*").eq("customer_id", id).order("confidence", { ascending: true }),
    client.from("customer_order_history").select("*").eq("customer_id", id).order("created_at_source", { ascending: false, nullsFirst: false }),
    client.from("customer_contact_events").select("*").eq("customer_id", id).order("occurred_at", { ascending: false, nullsFirst: false }),
    client.from("customer_notes").select("*").eq("customer_id", id).order("created_at", { ascending: false }),
  ]);

  if (identitiesResult.error) throw new Error(identitiesResult.error.message);
  if (ordersResult.error) throw new Error(ordersResult.error.message);
  if (eventsResult.error) throw new Error(eventsResult.error.message);
  if (notesResult.error) throw new Error(notesResult.error.message);

  const orders = (ordersResult.data ?? []) as CustomerOrderHistory[];
  const orderIds = orders.map((order) => order.id);
  const itemsByOrderId = new Map<string, CustomerOrderItem[]>();

  if (orderIds.length > 0) {
    const { data: items, error: itemsError } = await client
      .from("customer_order_items")
      .select("*")
      .in("order_history_id", orderIds)
      .order("created_at", { ascending: true });
    if (itemsError) throw new Error(itemsError.message);
    ((items ?? []) as CustomerOrderItem[]).forEach((item) => {
      const group = itemsByOrderId.get(item.order_history_id) ?? [];
      group.push(item);
      itemsByOrderId.set(item.order_history_id, group);
    });
  }

  return {
    customer: customer as CustomerSummary,
    identities: (identitiesResult.data ?? []) as CustomerIdentity[],
    orders,
    itemsByOrderId,
    events: (eventsResult.data ?? []) as CustomerContactEvent[],
    notes: (notesResult.data ?? []) as CustomerNote[],
    duplicateCandidates: await findDuplicateCandidates(customer as CustomerSummary, id),
  };
}

export async function insertCustomerNote(input: {
  customerId: string;
  body: string;
  createdByName?: string | null;
  createdByEmail?: string | null;
}) {
  const body = input.body.trim();
  if (!body) throw new Error("Note cannot be empty.");
  const { error } = await supabaseAdminClient.from("customer_notes").insert({
    customer_id: input.customerId,
    body,
    created_by_name: input.createdByName ?? null,
    created_by_email: input.createdByEmail ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function mergeCustomerRecords(input: { targetCustomerId: string; sourceCustomerId: string }) {
  if (input.targetCustomerId === input.sourceCustomerId) {
    throw new Error("Choose two different customers to merge.");
  }
  const client = supabaseAdminClient;

  const [targetResult, sourceResult] = await Promise.all([
    client.from("customers").select(CUSTOMER_SELECT).eq("id", input.targetCustomerId).maybeSingle(),
    client.from("customers").select(CUSTOMER_SELECT).eq("id", input.sourceCustomerId).maybeSingle(),
  ]);
  if (targetResult.error) throw new Error(targetResult.error.message);
  if (sourceResult.error) throw new Error(sourceResult.error.message);
  if (!targetResult.data || !sourceResult.data) throw new Error("Customer record not found.");

  const updates = [
    client.from("customer_order_history").update({ customer_id: input.targetCustomerId }).eq("customer_id", input.sourceCustomerId),
    client.from("customer_contact_events").update({ customer_id: input.targetCustomerId }).eq("customer_id", input.sourceCustomerId),
    client.from("customer_notes").update({ customer_id: input.targetCustomerId }).eq("customer_id", input.sourceCustomerId),
    client.from("customer_identities").update({ customer_id: input.targetCustomerId }).eq("customer_id", input.sourceCustomerId),
  ];
  const results = await Promise.all(updates);
  const failed = results.find((result) => result.error);
  if (failed?.error) throw new Error(failed.error.message);

  await refreshCustomerSummary(input.targetCustomerId);
  const { error: deleteError } = await client.from("customers").delete().eq("id", input.sourceCustomerId);
  if (deleteError) throw new Error(deleteError.message);
}

export async function refreshCustomerSummary(customerId: string) {
  const client = supabaseAdminClient;
  const [customerResult, ordersResult, eventsResult, identitiesResult] = await Promise.all([
    client.from("customers").select(CUSTOMER_SELECT).eq("id", customerId).maybeSingle(),
    client.from("customer_order_history").select("created_at_source,total_price,source_system").eq("customer_id", customerId),
    client.from("customer_contact_events").select("occurred_at,source_system").eq("customer_id", customerId),
    client.from("customer_identities").select("confidence,source_system").eq("customer_id", customerId),
  ]);

  if (customerResult.error) throw new Error(customerResult.error.message);
  if (!customerResult.data) return;
  if (ordersResult.error) throw new Error(ordersResult.error.message);
  if (eventsResult.error) throw new Error(eventsResult.error.message);
  if (identitiesResult.error) throw new Error(identitiesResult.error.message);

  const orders = (ordersResult.data ?? []) as Array<{ created_at_source: string | null; total_price: number | null; source_system: CustomerSourceSystem }>;
  const events = (eventsResult.data ?? []) as Array<{ occurred_at: string | null; source_system: CustomerSourceSystem }>;
  const identities = (identitiesResult.data ?? []) as Array<{ confidence: CustomerMatchConfidence | null; source_system: CustomerSourceSystem }>;
  const activityDates = [
    ...orders.map((order) => order.created_at_source),
    ...events.map((event) => event.occurred_at),
  ].filter((date): date is string => Boolean(date));
  const sourceSystems = Array.from(new Set([
    ...orders.map((order) => order.source_system),
    ...events.map((event) => event.source_system),
    ...identities.map((identity) => identity.source_system),
  ])).sort();
  const matchConfidence = identities.some((identity) => identity.confidence === "high")
    ? "high"
    : identities.some((identity) => identity.confidence === "medium")
      ? "medium"
      : "low";

  const { error } = await client
    .from("customers")
    .update({
      first_seen_at: activityDates.sort()[0] ?? null,
      last_seen_at: activityDates.sort().reverse()[0] ?? null,
      order_count: orders.length,
      enquiry_count: events.length,
      lifetime_value: orders.reduce((sum, order) => sum + Number(order.total_price ?? 0), 0),
      source_systems: sourceSystems,
      match_confidence: matchConfidence,
      updated_at: new Date().toISOString(),
    })
    .eq("id", customerId);
  if (error) throw new Error(error.message);
}

async function findDuplicateCandidates(customer: CustomerSummary, customerId: string) {
  const client = supabaseAdminClient;
  const candidates = new Map<string, CustomerSummary>();

  const addCandidateRows = (rows: CustomerSummary[] | null) => {
    (rows ?? []).forEach((row) => {
      if (row.id !== customerId) candidates.set(row.id, row);
    });
  };

  if (customer.primary_email) {
    const domain = customer.primary_email.split("@")[1]?.trim();
    if (domain) {
      const { data } = await client
        .from("customers")
        .select(CUSTOMER_SELECT)
        .ilike("primary_email", `%@${escapePostgrestLike(domain)}`)
        .limit(12);
      addCandidateRows((data ?? []) as CustomerSummary[]);
    }
  }

  if (customer.display_name && customer.postcode) {
    const { data } = await client
      .from("customers")
      .select(CUSTOMER_SELECT)
      .ilike("display_name", `%${escapePostgrestLike(customer.display_name)}%`)
      .eq("postcode", customer.postcode)
      .limit(12);
    addCandidateRows((data ?? []) as CustomerSummary[]);
  }

  if (customer.primary_phone) {
    const compactPhone = customer.primary_phone.replace(/[^\d+]/g, "");
    if (compactPhone.length >= 6) {
      const { data } = await client
        .from("customers")
        .select(CUSTOMER_SELECT)
        .ilike("primary_phone", `%${escapePostgrestLike(compactPhone.slice(-6))}%`)
        .limit(12);
      addCandidateRows((data ?? []) as CustomerSummary[]);
    }
  }

  return Array.from(candidates.values()).slice(0, 10);
}

function escapePostgrestLike(value: string) {
  return value.replace(/[%*_]/g, (match) => `\\${match}`).replace(/,/g, " ");
}
