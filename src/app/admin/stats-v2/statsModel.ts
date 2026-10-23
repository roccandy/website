import type { OrderRow } from "@/lib/data";
import { normalizeBaseOrderNumber } from "@/lib/orderNumbers";

export type StatsRow = Pick<
  OrderRow,
  | "id"
  | "order_number"
  | "created_at"
  | "due_date"
  | "customer_email"
  | "customer_name"
  | "first_name"
  | "last_name"
  | "phone"
  | "organization_name"
  | "category_id"
  | "design_type"
  | "packaging_option_id"
  | "flavor"
  | "total_price"
  | "total_weight_kg"
  | "paid_at"
  | "refunded_at"
  | "refunded_amount"
  | "status"
  | "pickup"
  | "state"
  | "payment_provider"
  | "payment_method"
  | "square_invoice_status"
  | "made"
  | "shipped_at"
  | "archived_at"
>;

export type StatsLine = {
  category: string;
  packaging: string;
  flavors: string[];
  gross: number;
  refund: number;
  net: number;
  weight: number;
};
export type StatsOrder = {
  id: string;
  number: string;
  created: string;
  due: string | null;
  customer: string;
  customerKey: string | null;
  business: boolean;
  returning: boolean;
  gross: number;
  refund: number;
  net: number;
  paid: number;
  unpaid: number;
  weight: number;
  kind: "Custom" | "Pre-made" | "Mixed";
  fulfillment: "Pickup" | "Delivery" | "Mixed";
  state: string;
  payment: string;
  complete: boolean;
  made: boolean;
  lines: StatsLine[];
};
export type StatsDataset = {
  orders: StatsOrder[];
  excludedLines: number;
  undatedOrders: number;
  loadedAt: string;
};
export type Period = "month" | "30d" | "90d" | "fy" | "all" | "custom";
export type StatsFilters = {
  period: Period;
  from: string;
  to: string;
  comparison: "previous" | "year" | "none";
  kind: string;
  fulfillment: string;
  payment: string;
  state: string;
};
export type DateRange = { from: string; to: string };
export const defaultFilters: StatsFilters = {
  period: "90d",
  from: "",
  to: "",
  comparison: "previous",
  kind: "all",
  fulfillment: "all",
  payment: "all",
  state: "all",
};

const DAY = 86_400_000;
const clean = (text: string | null | undefined) => text?.trim() || "";
export const cents = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number * 100)) : 0;
};
export function perthDate(value: string | Date) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Perth",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}
export function addDays(value: string, days: number) {
  return new Date(Date.parse(`${value}T00:00:00Z`) + days * DAY)
    .toISOString()
    .slice(0, 10);
}
export function daysBetween(from: string, to: string) {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY,
  );
}
export function dateLabel(date: string, year = false) {
  if (!validDate(date)) return "No date";
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    ...(year ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}
export const money = (value: number, precise = false) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: precise ? 2 : 0,
  }).format(value / 100);
export const count = (value: number) =>
  new Intl.NumberFormat("en-AU", { maximumFractionDigits: 1 }).format(value);

function stateLabel(value: string | null) {
  const state = clean(value).toUpperCase();
  const aliases: Record<string, string> = {
    "WESTERN AUSTRALIA": "WA",
    "NEW SOUTH WALES": "NSW",
    VICTORIA: "VIC",
    QUEENSLAND: "QLD",
    "SOUTH AUSTRALIA": "SA",
    TASMANIA: "TAS",
    "NORTHERN TERRITORY": "NT",
    "AUSTRALIAN CAPITAL TERRITORY": "ACT",
  };
  return (
    aliases[state] ?? (state && !state.startsWith("PICK") ? state : "Unknown")
  );
}
function providerLabel(value: string | null) {
  const text = clean(value).replaceAll("_", " ");
  return text
    ? text
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
        .replace(/Paypal/gi, "PayPal")
    : "Unknown";
}

/** Money is held in cents; rows are rolled into checkouts before any counting. */
export function buildStatsDataset(
  rows: StatsRow[],
  categories: Map<string, string>,
  packaging: Map<string, string>,
  loadedAt: string,
): StatsDataset {
  let excludedLines = 0;
  const grouped = new Map<string, StatsRow[]>();
  for (const row of rows) {
    if (
      ["cancelled", "canceled", "failed", "draft"].includes(
        clean(row.status).toLowerCase(),
      )
    ) {
      excludedLines++;
      continue;
    }
    const key =
      normalizeBaseOrderNumber(row.order_number) ??
      (clean(row.order_number) || row.id);
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  // Identity matching stays server-side. Never send email addresses or phone numbers to the dashboard.
  const customerIds = new Map<string, string>();
  const orders = [...grouped.values()]
    .map((groupRows): StatsOrder => {
      const sorted = [...groupRows].sort(
        (a, b) =>
          a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
      );
      const first = sorted[0];
      const email = sorted
        .map((row) => clean(row.customer_email).toLowerCase())
        .find((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
      const phone = sorted
        .map((row) => clean(row.phone).replace(/\D/g, ""))
        .find((value) => value.length >= 7);
      const identity = email ? `email:${email}` : phone ? `phone:${phone}` : "";
      if (identity && !customerIds.has(identity))
        customerIds.set(identity, `customer-${customerIds.size + 1}`);
      let paid = 0;
      let unpaid = 0;
      const lines = sorted.map((row): StatsLine => {
        const gross = cents(row.total_price);
        const refund = Math.min(
          gross,
          cents(row.refunded_amount) ||
            (row.refunded_at && row.status !== "partially-refunded"
              ? gross
              : 0),
        );
        const net = gross - refund;
        if (row.paid_at || row.square_invoice_status === "PAID") paid += net;
        else unpaid += net;
        const weight = Number(row.total_weight_kg);
        return {
          category:
            categories.get(row.category_id ?? "") ??
            (clean(row.category_id) ||
              (row.design_type === "premade" ? "Pre-made" : "Uncategorised")),
          packaging:
            packaging.get(row.packaging_option_id ?? "") ?? "Unspecified",
          flavors: [
            ...new Set(
              (row.flavor ?? "")
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
            ),
          ],
          gross,
          refund,
          net,
          weight: Number.isFinite(weight) && weight > 0 ? weight : 0,
        };
      });
      const hasCustom = sorted.some((row) => row.design_type !== "premade");
      const hasPremade = sorted.some((row) => row.design_type === "premade");
      const shippingStates = [
        ...new Set(
          sorted
            .filter((row) => !row.pickup)
            .map((row) => stateLabel(row.state)),
        ),
      ];
      const providers = [
        ...new Set(
          sorted.map((row) =>
            providerLabel(row.payment_provider || row.payment_method),
          ),
        ),
      ];
      return {
        id: first.id,
        number:
          normalizeBaseOrderNumber(first.order_number) ??
          (clean(first.order_number) || first.id.slice(0, 8)),
        created: perthDate(first.created_at),
        due:
          sorted
            .map((row) => row.due_date)
            .filter((value): value is string =>
              Boolean(value && validDate(value)),
            )
            .sort()[0] ?? null,
        customer:
          clean(first.customer_name) ||
          [clean(first.first_name), clean(first.last_name)]
            .filter(Boolean)
            .join(" ") ||
          clean(first.organization_name) ||
          "Unnamed customer",
        customerKey: identity ? customerIds.get(identity)! : null,
        business: sorted.some((row) => Boolean(clean(row.organization_name))),
        returning: false,
        gross: lines.reduce((sum, line) => sum + line.gross, 0),
        refund: lines.reduce((sum, line) => sum + line.refund, 0),
        net: paid + unpaid,
        paid,
        unpaid,
        weight: lines.reduce((sum, line) => sum + line.weight, 0),
        kind:
          hasCustom && hasPremade ? "Mixed" : hasCustom ? "Custom" : "Pre-made",
        fulfillment: sorted.every((row) => row.pickup)
          ? "Pickup"
          : sorted.every((row) => !row.pickup)
            ? "Delivery"
            : "Mixed",
        state:
          shippingStates.length > 1
            ? "Multiple"
            : (shippingStates[0] ?? "Pickup"),
        payment: providers.length > 1 ? "Multiple" : providers[0],
        complete: sorted.every((row) =>
          Boolean(
            row.shipped_at ||
              row.archived_at ||
              [
                "shipped",
                "archived",
                "completed",
                "complete",
                "collected",
              ].includes(row.status),
          ),
        ),
        made: sorted.every((row) => row.made),
        lines,
      };
    })
    .sort(
      (a, b) =>
        a.created.localeCompare(b.created) || a.number.localeCompare(b.number),
    );
  const seen = new Set<string>();
  for (const order of orders) {
    if (!order.customerKey || !order.created || !order.net) continue;
    order.returning = seen.has(order.customerKey);
    seen.add(order.customerKey);
  }
  return {
    orders,
    excludedLines,
    undatedOrders: orders.filter((order) => !order.created).length,
    loadedAt,
  };
}

export function parseFilters(params: URLSearchParams): StatsFilters {
  const filters = { ...defaultFilters };
  const period = params.get("period") as Period;
  if (["month", "30d", "90d", "fy", "all", "custom"].includes(period))
    filters.period = period;
  if (["previous", "year", "none"].includes(params.get("comparison") ?? ""))
    filters.comparison = params.get("comparison") as StatsFilters["comparison"];
  for (const key of ["from", "to"] as const)
    if (validDate(params.get(key) ?? "")) filters[key] = params.get(key)!;
  for (const key of ["kind", "fulfillment", "payment", "state"] as const)
    filters[key] = params.get(key) ?? "all";
  return filters;
}
export function resolveRange(
  filters: StatsFilters,
  today: string,
  earliest: string,
): DateRange {
  switch (filters.period) {
    case "month":
      return { from: `${today.slice(0, 7)}-01`, to: today };
    case "30d":
      return { from: addDays(today, -29), to: today };
    case "90d":
      return { from: addDays(today, -89), to: today };
    case "fy":
      return {
        from: `${Number(today.slice(0, 4)) - (Number(today.slice(5, 7)) < 7 ? 1 : 0)}-07-01`,
        to: today,
      };
    case "all":
      return { from: earliest || today, to: today };
    default:
      return {
        from: validDate(filters.from) ? filters.from : addDays(today, -89),
        to: validDate(filters.to) ? filters.to : today,
      };
  }
}
export function comparisonRange(
  range: DateRange,
  comparison: StatsFilters["comparison"],
): DateRange | null {
  if (comparison === "none" || range.from > range.to) return null;
  if (comparison === "previous")
    return {
      from: addDays(range.from, -daysBetween(range.from, range.to) - 1),
      to: addDays(range.from, -1),
    };
  const previousYear = (date: string) => {
    const year = Number(date.slice(0, 4)) - 1;
    const candidate = `${year}${date.slice(4)}`;
    return validDate(candidate) ? candidate : `${year}-02-28`;
  };
  return { from: previousYear(range.from), to: previousYear(range.to) };
}
export function matchesSegments(order: StatsOrder, filters: StatsFilters) {
  return (
    (filters.kind === "all" || order.kind === filters.kind) &&
    (filters.fulfillment === "all" ||
      order.fulfillment === filters.fulfillment) &&
    (filters.state === "all" || order.state === filters.state) &&
    (filters.payment === "all" ||
      (filters.payment === "paid" && order.paid > 0) ||
      (filters.payment === "unpaid" && order.unpaid > 0) ||
      (filters.payment === "refunded" && order.refund > 0))
  );
}
export function filterOrders(
  orders: StatsOrder[],
  filters: StatsFilters,
  range: DateRange,
) {
  return orders.filter(
    (order) =>
      order.created &&
      order.created >= range.from &&
      order.created <= range.to &&
      matchesSegments(order, filters),
  );
}
export function summarize(orders: StatsOrder[]) {
  const total = (
    key: "net" | "gross" | "refund" | "paid" | "unpaid" | "weight",
  ) => orders.reduce((sum, order) => sum + order[key], 0);
  const leadTimes = orders
    .filter(
      (order) =>
        order.due &&
        order.created &&
        daysBetween(order.created, order.due) >= 0,
    )
    .map((order) => daysBetween(order.created, order.due!))
    .sort((a, b) => a - b);
  return {
    net: total("net"),
    gross: total("gross"),
    refund: total("refund"),
    paid: total("paid"),
    unpaid: total("unpaid"),
    weight: total("weight"),
    orders: orders.length,
    average: orders.length ? total("net") / orders.length : 0,
    customers: new Set(orders.map((order) => order.customerKey).filter(Boolean))
      .size,
    returning: orders.filter((order) => order.returning).length,
    medianLead: leadTimes.length
      ? (leadTimes[Math.floor((leadTimes.length - 1) / 2)] +
          leadTimes[Math.floor(leadTimes.length / 2)]) /
        2
      : null,
  };
}
export type TrendBucket = DateRange & {
  label: string;
  orders: number;
  net: number;
  weight: number;
  previous: number;
};
export function buildTrend(
  orders: StatsOrder[],
  previous: StatsOrder[],
  range: DateRange,
  previousRange: DateRange | null,
  metric: "net" | "orders" | "weight",
): TrendBucket[] {
  const days = daysBetween(range.from, range.to) + 1;
  if (days < 1 || !Number.isFinite(days)) return [];
  const step = days <= 31 ? 1 : days <= 180 ? 7 : 0;
  const buckets: TrendBucket[] = [];
  for (let cursor = range.from; cursor <= range.to; ) {
    const next = step
      ? addDays(cursor, step)
      : new Date(
          Date.UTC(Number(cursor.slice(0, 4)), Number(cursor.slice(5, 7)), 1),
        )
          .toISOString()
          .slice(0, 10);
    const to = addDays(next, -1) < range.to ? addDays(next, -1) : range.to;
    buckets.push({
      from: cursor,
      to,
      label:
        step === 0
          ? new Intl.DateTimeFormat("en-AU", {
              month: "short",
              year: "2-digit",
              timeZone: "UTC",
            }).format(new Date(cursor))
          : dateLabel(cursor),
      net: 0,
      orders: 0,
      weight: 0,
      previous: 0,
    });
    cursor = next;
  }
  for (const order of orders) {
    const bucket = buckets.find(
      (item) => order.created >= item.from && order.created <= item.to,
    );
    if (bucket) {
      bucket.net += order.net;
      bucket.orders++;
      bucket.weight += order.weight;
    }
  }
  if (previousRange)
    for (const order of previous) {
      // Align equal positions within each period, including leap-year comparisons.
      const fraction =
        daysBetween(previousRange.from, order.created) /
        Math.max(1, daysBetween(previousRange.from, previousRange.to) + 1);
      const aligned = addDays(range.from, Math.floor(fraction * days));
      const bucket = buckets.find(
        (item) => aligned >= item.from && aligned <= item.to,
      );
      if (bucket) bucket.previous += metric === "orders" ? 1 : order[metric];
    }
  return buckets;
}
export function rankLines(
  orders: StatsOrder[],
  dimension: "category" | "packaging" | "flavors",
) {
  const map = new Map<
    string,
    { label: string; net: number; orders: Set<string>; weight: number }
  >();
  for (const order of orders)
    for (const line of order.lines) {
      const labels = dimension === "flavors" ? line.flavors : [line[dimension]];
      for (const label of labels) {
        const item = map.get(label) ?? {
          label,
          net: 0,
          orders: new Set<string>(),
          weight: 0,
        };
        item.net += line.net;
        item.weight += line.weight;
        item.orders.add(order.id);
        map.set(label, item);
      }
    }
  return [...map.values()]
    .map((item) => ({ ...item, orders: item.orders.size }))
    .sort((a, b) => b.net - a.net || b.orders - a.orders);
}
export function csvCell(value: string | number) {
  const text = String(value);
  const safe = /^[\s]*[=+@\-\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
