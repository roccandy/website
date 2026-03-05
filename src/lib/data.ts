import { supabaseServerClient } from "@/lib/supabase/server";

export type Category = {
  id: string;
  name: string;
};

export type WeightTier = {
  id: string;
  category_id: string;
  min_kg: number;
  max_kg: number;
  price: number;
  per_kg: boolean;
  notes: string | null;
};

export type PackagingOption = {
  id: string;
  type: string;
  size: string;
  candy_weight_g: number;
  allowed_categories: string[];
  lid_colors: string[] | null;
  label_type_ids: string[] | null;
  unit_price: number;
  max_packages: number;
};

export type LabelType = {
  id: string;
  shape: "square" | "rectangular" | "circle";
  dimensions: string;
  cost: number;
  created_at: string;
};

export type LabelRange = {
  id: string;
  upper_bound: number;
  range_cost: number;
};

export type PackagingOptionImage = {
  id: string;
  packaging_option_id: string;
  category_id: string;
  lid_color: string;
  image_path: string | null;
  created_at: string;
};

export type SettingsRow = {
  id: number;
  lead_time_days: number;
  urgency_fee: number;
  transaction_fee_percent: number;
  quote_blockout_months: number | null;
  production_slots_per_day: number;
  no_production_mon: boolean;
  no_production_tue: boolean;
  no_production_wed: boolean;
  no_production_thu: boolean;
  no_production_fri: boolean;
  no_production_sat: boolean;
  no_production_sun: boolean;
  jacket_rainbow: number;
  jacket_two_colour: number;
  jacket_pinstripe: number;
  max_total_kg: number;
  labels_supplier_shipping: number;
  labels_markup_multiplier: number;
  labels_max_bulk: number;
  ingredient_label_price: number | null;
  ingredient_label_type_id: string | null;
  orders_email: string | null;
  admin_email: string | null;
  enquiries_email: string | null;
};

export type Flavor = {
  id: string;
  name: string;
  is_active?: boolean | null;
};

export type PremadeCandy = {
  id: string;
  name: string;
  description: string;
  weight_g: number;
  price: number;
  approx_pcs: number | null;
  image_path: string;
  flavors: string[] | null;
  great_value: boolean;
  is_active: boolean;
  sort_order: number | null;
  created_at: string;
  sku: string | null;
  short_description: string | null;
  brand: string | null;
  google_product_category: string | null;
  product_condition: string | null;
  sale_price: number | null;
  availability: string | null;
  woo_product_id: string | null;
  woo_sync_status: string | null;
  woo_last_sync_at: string | null;
  woo_sync_error: string | null;
};

export type OrderRow = {
  id: string;
  order_number: string | null;
  title: string | null;
  order_description: string | null;
  customer_name: string | null;
  customer_email: string | null;
  category_id: string | null;
  packaging_option_id: string | null;
  quantity: number | null;
  jar_lid_color: string | null;
  labels_count: number | null;
  jacket: string | null;
  design_type: string | null;
  design_text: string | null;
  jacket_type: string | null;
  jacket_color_one: string | null;
  jacket_color_two: string | null;
  text_color: string | null;
  heart_color: string | null;
  flavor: string | null;
  payment_method: string | null;
  logo_url: string | null;
  label_image_url: string | null;
  due_date: string | null;
  label_type_id: string | null;
  total_weight_kg: number;
  total_price: number | null;
  status: string;
  notes: string | null;
  made: boolean;
  pickup: boolean;
  state: string | null;
  location: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  organization_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  suburb: string | null;
  postcode: string | null;
  woo_order_id: string | null;
  woo_order_status: string | null;
  woo_order_key: string | null;
  woo_payment_url: string | null;
  paid_at: string | null;
  payment_provider: string | null;
  payment_transaction_id: string | null;
  refunded_at: string | null;
  refund_reason: string | null;
  shipped_at: string | null;
  created_at: string;
};

export type ProductionSlot = {
  id: string;
  slot_date: string; // ISO date
  slot_index: number;
  capacity_kg: number;
  status: string;
  notes: string | null;
  created_at: string;
};

export type ProductionBlock = {
  id: string;
  start_date: string; // ISO date
  end_date: string; // ISO date
  reason: string;
  created_at: string;
};

export type QuoteBlock = {
  id: string;
  start_date: string; // ISO date
  end_date: string; // ISO date
  reason: string | null;
  created_at: string;
};

export type ColorPaletteRow = {
  id: string;
  category: string;
  shade: string;
  hex: string;
  sort_order: number;
};

export type OrderSlot = {
  id: string;
  order_id: string;
  slot_id: string;
  kg_assigned: number;
  created_at: string;
};

async function fetchTable<T>(table: string) {
  const client = supabaseServerClient;
  const { data, error } = await client.from(table).select("*");
  if (error) throw new Error(error.message);
  return data as T[];
}

export async function getCategories() {
  return fetchTable<Category>("categories");
}

export async function getWeightTiers() {
  return fetchTable<WeightTier>("weight_tiers");
}

export async function getPackagingOptions() {
  return fetchTable<PackagingOption>("packaging_options");
}

export async function getPackagingOptionImages() {
  return fetchTable<PackagingOptionImage>("packaging_option_images");
}

export async function getLabelRanges() {
  return fetchTable<LabelRange>("label_ranges");
}

export async function getLabelTypes() {
  return fetchTable<LabelType>("label_types");
}

export async function getSettings() {
  const rows = await fetchTable<SettingsRow>("settings");
  return rows[0];
}

export async function getOrders() {
  return fetchTable<OrderRow>("orders");
}

export async function getProductionSlots() {
  return fetchTable<ProductionSlot>("production_slots");
}

export async function getProductionBlocks() {
  return fetchTable<ProductionBlock>("production_blocks");
}

export async function getQuoteBlocks() {
  const client = supabaseServerClient;
  const [quoteResult, productionResult, settingsResult] = await Promise.all([
    client.from("quote_blocks").select("*"),
    client.from("production_blocks").select("*"),
    client.from("settings").select("quote_blockout_months").eq("id", 1).maybeSingle(),
  ]);

  let quoteBlocks: QuoteBlock[] = [];
  if (quoteResult.error) {
    const message = quoteResult.error.message?.toLowerCase() ?? "";
    if (!message.includes("quote_blocks") && !message.includes("schema cache")) {
      throw new Error(quoteResult.error.message);
    }
  } else {
    quoteBlocks = quoteResult.data as QuoteBlock[];
  }

  if (productionResult.error) {
    throw new Error(productionResult.error.message);
  }

  const visibilityMonthsRaw = Number(settingsResult.data?.quote_blockout_months ?? 3);
  const visibilityMonths = Number.isFinite(visibilityMonthsRaw)
    ? Math.min(12, Math.max(1, Math.floor(visibilityMonthsRaw)))
    : 3;

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const cutoff = new Date(startOfToday);
  cutoff.setMonth(cutoff.getMonth() + visibilityMonths);

  const isOpenOverrideReason = (reason: string | null | undefined) =>
    (reason ?? "").trim().toLowerCase() === "open override";

  const formatOrdinalDay = (day: number) => {
    const mod100 = day % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${day}th`;
    const mod10 = day % 10;
    if (mod10 === 1) return `${day}st`;
    if (mod10 === 2) return `${day}nd`;
    if (mod10 === 3) return `${day}rd`;
    return `${day}th`;
  };

  const formatDisplayDate = (isoDate: string) => {
    const [year, month, day] = isoDate.split("-").map(Number);
    if (!year || !month || !day) return isoDate;
    const parsed = new Date(year, month - 1, day);
    const monthName = parsed.toLocaleString("en-AU", { month: "long" });
    return `${formatOrdinalDay(day)} ${monthName} ${year}`;
  };

  const derivedBlocks: QuoteBlock[] = (productionResult.data ?? [])
    .filter((block) => !isOpenOverrideReason(block.reason))
    .filter((block) => {
      const start = new Date(`${block.start_date}T00:00:00`);
      if (Number.isNaN(start.getTime())) return false;
      return start <= cutoff;
    })
    .map((block) => ({
      id: `production-${block.id}`,
      start_date: block.start_date,
      end_date: block.end_date,
      reason: `Production full between ${formatDisplayDate(block.start_date)} and ${formatDisplayDate(block.end_date)}`,
      created_at: block.created_at,
    }));

  const deduped = new Map<string, QuoteBlock>();
  for (const block of derivedBlocks) {
    deduped.set(`${block.start_date}:${block.end_date}`, block);
  }
  for (const block of quoteBlocks) {
    deduped.set(`${block.start_date}:${block.end_date}`, block);
  }

  return Array.from(deduped.values());
}

export async function getColorPalette() {
  const client = supabaseServerClient;
  const { data, error } = await client
    .from("color_palette")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data as ColorPaletteRow[];
}

export async function getOrderSlots() {
  return fetchTable<OrderSlot>("order_slots");
}

export async function getFlavors() {
  return fetchTable<Flavor>("flavors");
}

export async function getPremadeCandies() {
  const client = supabaseServerClient;
  const { data, error } = await client
    .from("premade_candies")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return data as PremadeCandy[];
}

export async function getPremadeCandyById(id: string) {
  const client = supabaseServerClient;
  const { data, error } = await client.from("premade_candies").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as PremadeCandy | null) ?? null;
}
