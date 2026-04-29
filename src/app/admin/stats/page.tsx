import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { BarChart3, CircleDollarSign, Clock3, MapPinned, Sparkles, Users, WalletCards } from "lucide-react";
import { requireAdminSession } from "@/lib/adminAuth";
import { getCategories, getOrders, getPackagingOptions, type OrderRow } from "@/lib/data";
import { normalizeBaseOrderNumber } from "@/lib/orderNumbers";
import { canAccessCustomerCrm } from "@/lib/customerHistory";

export const metadata: Metadata = {
  title: "Order Observatory | Roc Candy Admin",
};

type CountItem = {
  label: string;
  value: number;
};

type DonutItem = CountItem & {
  color: string;
};

type MonthlyPoint = {
  key: string;
  label: string;
  shortLabel: string;
  yearLabel: string;
  revenue: number;
  orders: number;
};

type OrderGroup = {
  id: string;
  baseOrderNumber: string | null;
  createdAt: string | null;
  dueDate: string | null;
  totalRevenue: number;
  refundedRevenue: number;
  totalWeightKg: number;
  pickup: boolean;
  paymentProvider: string | null;
  state: string | null;
  suburb: string | null;
  organizationName: string | null;
  customerKey: string | null;
  categories: string[];
  packagingTypes: string[];
  flavors: string[];
  hasCustom: boolean;
  hasPremade: boolean;
  isSplit: boolean;
  leadTimeDays: number | null;
  rows: OrderRow[];
};

const money = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});

const moneyPrecise = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integer = new Intl.NumberFormat("en-AU");

function toCurrency(value: number) {
  return money.format(Number.isFinite(value) ? value : 0);
}

function toPreciseCurrency(value: number) {
  return moneyPrecise.format(Number.isFinite(value) ? value : 0);
}

function toCount(value: number) {
  return integer.format(Number.isFinite(value) ? value : 0);
}

function toPercent(value: number, total: number) {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function cleanText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function cleanGeographyText(value: string | null | undefined) {
  const cleaned = cleanText(value);
  if (!cleaned) return null;
  const normalized = cleaned.toLowerCase();
  if (normalized === "pickup" || normalized === "pick up" || normalized.startsWith("pickup ")) {
    return null;
  }
  return cleaned;
}

function toCustomerKey(order: OrderRow) {
  const email = cleanText(order.customer_email)?.toLowerCase();
  if (email) return `email:${email}`;
  const phone = cleanText(order.phone)?.replace(/\s+/g, "");
  if (phone) return `phone:${phone}`;
  const name = cleanText(order.customer_name) ?? [cleanText(order.first_name), cleanText(order.last_name)].filter(Boolean).join(" ");
  if (name) return `name:${name.toLowerCase()}`;
  return null;
}

function diffDays(createdAt: string | null, dueDate: string | null) {
  if (!createdAt || !dueDate) return null;
  const created = new Date(createdAt);
  const due = new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(created.getTime()) || Number.isNaN(due.getTime())) return null;
  return Math.round((due.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
}

function incrementCount(map: Map<string, number>, label: string | null | undefined, amount = 1) {
  const cleaned = cleanText(label);
  if (!cleaned) return;
  map.set(cleaned, (map.get(cleaned) ?? 0) + amount);
}

function mapToTopItems(map: Map<string, number>, limit = 6): CountItem[] {
  return Array.from(map.entries())
    .sort((a, b) => (b[1] === a[1] ? a[0].localeCompare(b[0]) : b[1] - a[1]))
    .slice(0, limit)
    .map(([label, value]) => ({ label, value }));
}

function buildLast12Months(groups: OrderGroup[]) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const months: MonthlyPoint[] = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth() + index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return {
      key,
      label: date.toLocaleString("en-AU", { month: "long", year: "numeric" }),
      shortLabel: date.toLocaleString("en-AU", { month: "short" }),
      yearLabel: String(date.getFullYear()),
      revenue: 0,
      orders: 0,
    };
  });
  const monthMap = new Map(months.map((month) => [month.key, month]));

  groups.forEach((group) => {
    if (!group.createdAt) return;
    const created = new Date(group.createdAt);
    if (Number.isNaN(created.getTime())) return;
    const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}`;
    const point = monthMap.get(key);
    if (!point) return;
    point.orders += 1;
    point.revenue += group.totalRevenue;
  });

  return months;
}

function getDayLabel(dateIso: string | null) {
  if (!dateIso) return null;
  const date = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-AU", { weekday: "short" });
}

function buildGroups(orders: OrderRow[], categoryNameById: Map<string, string>, packagingTypeById: Map<string, string>) {
  const groupedRows = new Map<string, OrderRow[]>();

  orders.forEach((order) => {
    const baseOrderNumber = normalizeBaseOrderNumber(order.order_number);
    const key = baseOrderNumber ?? order.order_number ?? order.id;
    const group = groupedRows.get(key) ?? [];
    group.push(order);
    groupedRows.set(key, group);
  });

  const groups = Array.from(groupedRows.entries()).map(([key, rows]) => {
    const createdAt = rows
      .map((row) => row.created_at)
      .filter(Boolean)
      .sort()[0] ?? null;
    const dueDate = rows
      .map((row) => row.due_date)
      .filter(Boolean)
      .sort()[0] ?? null;
    const state = rows
      .map((row) => (row.pickup ? null : cleanGeographyText(row.state) ?? cleanGeographyText(row.location)))
      .find(Boolean) ?? null;
    const suburb = rows
      .map((row) => (row.pickup ? null : cleanGeographyText(row.suburb)))
      .find(Boolean) ?? null;
    const organizationName = rows.map((row) => cleanText(row.organization_name)).find(Boolean) ?? null;
    const paymentProvider =
      rows.map((row) => cleanText(row.payment_provider) ?? cleanText(row.payment_method)).find(Boolean) ?? null;
    const categories = Array.from(
      new Set(
        rows
          .map((row) => cleanText(categoryNameById.get(row.category_id ?? "") ?? row.category_id))
          .filter((value): value is string => Boolean(value))
      )
    );
    const packagingTypes = Array.from(
      new Set(
        rows
          .map((row) => cleanText(packagingTypeById.get(row.packaging_option_id ?? "") ?? null))
          .filter((value): value is string => Boolean(value))
      )
    );
    const flavors = Array.from(
      new Set(
        rows
          .flatMap((row) =>
            (row.flavor ?? "")
              .split(",")
              .map((value) => cleanText(value))
              .filter((value): value is string => Boolean(value))
          )
      )
    );
    const hasCustom = rows.some((row) => row.design_type !== "premade");
    const hasPremade = rows.some((row) => row.design_type === "premade");

    return {
      id: key,
      baseOrderNumber: normalizeBaseOrderNumber(rows[0]?.order_number),
      createdAt,
      dueDate,
      totalRevenue: rows.reduce((sum, row) => sum + Number(row.total_price ?? 0), 0),
      refundedRevenue: rows.reduce((sum, row) => sum + (row.refunded_at ? Number(row.total_price ?? 0) : 0), 0),
      totalWeightKg: rows.reduce((sum, row) => sum + Number(row.total_weight_kg ?? 0), 0),
      pickup: rows.every((row) => Boolean(row.pickup)),
      paymentProvider,
      state,
      suburb,
      organizationName,
      customerKey: rows.map(toCustomerKey).find(Boolean) ?? null,
      categories,
      packagingTypes,
      flavors,
      hasCustom,
      hasPremade,
      isSplit: hasCustom && hasPremade,
      leadTimeDays: diffDays(createdAt, dueDate),
      rows,
    } satisfies OrderGroup;
  });

  return groups;
}

function StatCard({
  icon,
  label,
  value,
  secondary,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  secondary?: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white/90 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">{label}</p>
          <p className="text-2xl font-semibold tracking-tight text-zinc-900">{value}</p>
          {secondary ? <p className="text-xs text-zinc-500">{secondary}</p> : null}
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-2 text-zinc-700">{icon}</div>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-5 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">{eyebrow}</p>
        <h2 className="admin-subsection-title text-zinc-900">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function HorizontalBars({
  items,
  totalOverride,
}: {
  items: CountItem[];
  totalOverride?: number;
}) {
  const max = totalOverride ?? Math.max(...items.map((item) => item.value), 1);

  if (items.length === 0) {
    return <p className="text-sm text-zinc-400">No data yet.</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate font-medium text-zinc-800">{item.label}</span>
            <span className="text-xs font-semibold text-zinc-500">{toCount(item.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-zinc-100">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400"
              style={{ width: `${Math.max(8, (item.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function DonutBreakdown({ items, totalLabel }: { items: DonutItem[]; totalLabel: string }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);

  if (total <= 0) {
    return <p className="text-sm text-zinc-400">No data yet.</p>;
  }

  const gradient = items
    .reduce<{ start: number; segments: string[] }>(
      (accumulator, item) => {
        const nextStop = accumulator.start + (item.value / total) * 360;
        return {
          start: nextStop,
          segments: [...accumulator.segments, `${item.color} ${accumulator.start}deg ${nextStop}deg`],
        };
      },
      { start: 0, segments: [] }
    )
    .segments.join(", ");

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-center">
      <div
        className="relative h-40 w-40 rounded-full"
        style={{ background: `conic-gradient(${gradient})` }}
      >
        <div className="absolute inset-5 flex items-center justify-center rounded-full border border-zinc-200 bg-white text-center">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">{totalLabel}</p>
            <p className="text-2xl font-semibold text-zinc-900">{toCount(total)}</p>
          </div>
        </div>
      </div>
      <div className="grid flex-1 gap-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-sm font-medium text-zinc-800">{item.label}</span>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-zinc-900">{toCount(item.value)}</p>
              <p className="text-[11px] text-zinc-500">{toPercent(item.value, total)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthlyRevenueChart({ months }: { months: MonthlyPoint[] }) {
  const maxRevenue = Math.max(...months.map((month) => month.revenue), 1);
  const maxOrders = Math.max(...months.map((month) => month.orders), 1);

  return (
    <div className="grid gap-3 md:grid-cols-12">
      {months.map((month) => (
        <div key={month.key} className="flex flex-col gap-2">
          <div className="flex h-40 items-end rounded-2xl border border-zinc-200 bg-zinc-50 p-2">
            <div className="flex h-full w-full items-end gap-1">
              <div
                className="w-2 flex-1 rounded-full"
                style={{
                  height: `${Math.max(10, (month.revenue / maxRevenue) * 100)}%`,
                  background: "linear-gradient(180deg, rgb(251 113 133), rgb(251 146 60) 52%, rgb(251 191 36))",
                }}
                title={`${month.label}: ${toPreciseCurrency(month.revenue)}`}
              />
              <div
                className="w-2 rounded-full bg-zinc-300"
                style={{ height: `${Math.max(10, (month.orders / maxOrders) * 100)}%` }}
                title={`${month.label}: ${toCount(month.orders)} orders`}
              />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-800">{month.shortLabel}</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">{month.yearLabel}</p>
            <p className="text-[11px] text-zinc-500">{toCount(month.orders)} / {toCurrency(month.revenue)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function OrderStatsPage() {
  const session = await requireAdminSession();

  const [orders, categories, packagingOptions] = await Promise.all([
    getOrders(),
    getCategories(),
    getPackagingOptions(),
  ]);

  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));
  const packagingTypeById = new Map(packagingOptions.map((option) => [option.id, option.type]));
  const groups = buildGroups(orders, categoryNameById, packagingTypeById);
  const customerOrderCounts = new Map<string, number>();

  groups.forEach((group) => {
    if (group.customerKey) {
      customerOrderCounts.set(group.customerKey, (customerOrderCounts.get(group.customerKey) ?? 0) + 1);
    }
  });

  const grossRevenue = groups.reduce((sum, group) => sum + group.totalRevenue, 0);
  const refundedRevenue = groups.reduce((sum, group) => sum + group.refundedRevenue, 0);
  const netRevenue = grossRevenue - refundedRevenue;
  const leadTimes = groups.map((group) => group.leadTimeDays).filter((value): value is number => value !== null && value >= 0);
  const averageLeadTime = leadTimes.length > 0 ? leadTimes.reduce((sum, value) => sum + value, 0) / leadTimes.length : 0;
  const splitOrders = groups.filter((group) => group.isSplit).length;
  const pickupOrders = groups.filter((group) => group.pickup).length;
  const deliveryOrders = groups.length - pickupOrders;
  const businessOrders = groups.filter((group) => Boolean(group.organizationName)).length;
  const repeatCustomers = Array.from(customerOrderCounts.values()).filter((count) => count > 1).length;
  const repeatOrders = groups.filter((group) => group.customerKey && (customerOrderCounts.get(group.customerKey) ?? 0) > 1).length;
  const totalWeightKg = groups.reduce((sum, group) => sum + group.totalWeightKg, 0);

  const stateCounts = new Map<string, number>();
  const suburbCounts = new Map<string, number>();
  const packagingCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  const flavorCounts = new Map<string, number>();
  const paymentCounts = new Map<string, number>();
  const dueWeekdayCounts = new Map<string, number>();

  groups.forEach((group) => {
    incrementCount(stateCounts, group.state);
    incrementCount(suburbCounts, group.suburb && group.state ? `${group.suburb}, ${group.state}` : group.suburb ?? group.state);
    incrementCount(paymentCounts, group.paymentProvider?.toUpperCase() ?? "Unknown");
    incrementCount(dueWeekdayCounts, getDayLabel(group.dueDate));
  });

  groups.forEach((group) => {
    group.packagingTypes.forEach((type) => incrementCount(packagingCounts, type));
    group.categories.forEach((category) => incrementCount(categoryCounts, category));
    group.flavors.forEach((flavor) => incrementCount(flavorCounts, flavor));
  });

  const typeMix: DonutItem[] = [
    { label: "Custom only", value: groups.filter((group) => group.hasCustom && !group.hasPremade).length, color: "#f59e0b" },
    { label: "Pre-made only", value: groups.filter((group) => group.hasPremade && !group.hasCustom).length, color: "#fb7185" },
    { label: "Split checkout", value: splitOrders, color: "#0ea5e9" },
  ].filter((item) => item.value > 0);

  const profileMix: DonutItem[] = [
    { label: "Delivery", value: deliveryOrders, color: "#f97316" },
    { label: "Pickup", value: pickupOrders, color: "#14b8a6" },
  ].filter((item) => item.value > 0);
  const topPaymentProvider = mapToTopItems(paymentCounts, 1)[0] ?? null;

  const leadTimeBuckets: CountItem[] = [
    { label: "0-6 days", value: leadTimes.filter((value) => value <= 6).length },
    { label: "7-13 days", value: leadTimes.filter((value) => value >= 7 && value <= 13).length },
    { label: "14-29 days", value: leadTimes.filter((value) => value >= 14 && value <= 29).length },
    { label: "30+ days", value: leadTimes.filter((value) => value >= 30).length },
  ].filter((item) => item.value > 0);

  const months = buildLast12Months(groups);
  const activeMonth = months[months.length - 1];

  return (
    <section className="space-y-8">
      <div className="rounded-[2rem] border border-zinc-200 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.18),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(244,114,182,0.14),_transparent_32%),linear-gradient(180deg,_#ffffff,_#fafafa)] p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-800">
              <Sparkles className="h-3.5 w-3.5" />
              Secret stats room
            </div>
            <div className="space-y-2">
              <h1 className="admin-page-title text-zinc-900">Order Observatory</h1>
              <p className="max-w-3xl text-sm leading-6 text-zinc-600">
                A grouped view of how Roc Candy is selling, where orders are coming from, and what customers keep choosing.
                Split orders are rolled up into one checkout where possible so the numbers stay readable.
              </p>
              {canAccessCustomerCrm(session.user) ? (
                <Link
                  href="/admin/customers"
                  className="inline-flex rounded-lg border border-zinc-900 bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
                >
                  Open customer history
                </Link>
              ) : null}
            </div>
          </div>
          <div className="grid gap-3 rounded-3xl border border-zinc-200 bg-white/80 p-4 text-sm text-zinc-600 shadow-sm sm:grid-cols-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">Current month</p>
              <p className="mt-1 text-lg font-semibold text-zinc-900">{toCount(activeMonth.orders)}</p>
              <p className="text-xs text-zinc-500">orders created</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">Current month</p>
              <p className="mt-1 text-lg font-semibold text-zinc-900">{toCurrency(activeMonth.revenue)}</p>
              <p className="text-xs text-zinc-500">gross order value</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">Order lines</p>
              <p className="mt-1 text-lg font-semibold text-zinc-900">{toCount(orders.length)}</p>
              <p className="text-xs text-zinc-500">across {toCount(groups.length)} grouped checkouts</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          icon={<CircleDollarSign className="h-5 w-5" />}
          label="Gross Order Value"
          value={toCurrency(grossRevenue)}
          secondary={`${toCount(groups.length)} grouped orders`}
        />
        <StatCard
          icon={<WalletCards className="h-5 w-5" />}
          label="Net After Refunds"
          value={toCurrency(netRevenue)}
          secondary={`${toCurrency(refundedRevenue)} refunded`}
        />
        <StatCard
          icon={<BarChart3 className="h-5 w-5" />}
          label="Average Order Value"
          value={toCurrency(groups.length > 0 ? grossRevenue / groups.length : 0)}
          secondary={`${toCount(splitOrders)} split checkouts`}
        />
        <StatCard
          icon={<Clock3 className="h-5 w-5" />}
          label="Average Lead Time"
          value={`${Math.round(averageLeadTime || 0)} days`}
          secondary={leadTimes.length > 0 ? `${toCount(leadTimes.length)} orders with due dates` : "No lead-time data yet"}
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Repeat Customers"
          value={toCount(repeatCustomers)}
          secondary={`${toCount(repeatOrders)} orders from repeat buyers`}
        />
        <StatCard
          icon={<MapPinned className="h-5 w-5" />}
          label="Delivery vs Pickup"
          value={`${toPercent(deliveryOrders, groups.length)} delivery`}
          secondary={`${toCount(pickupOrders)} pickup, ${toCount(deliveryOrders)} delivery`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
        <SectionCard title="Order tempo" eyebrow="Rhythm">
          <MonthlyRevenueChart months={months} />
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-zinc-500">
            <span>
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-gradient-to-r from-amber-400 to-rose-400 align-middle" />{" "}
              Revenue
            </span>
            <span>
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-zinc-300 align-middle" /> Order count
            </span>
          </div>
        </SectionCard>

        <SectionCard title="How people buy" eyebrow="Mix">
          <div className="space-y-6">
              <DonutBreakdown items={typeMix} totalLabel="Checkout mix" />
            <DonutBreakdown items={profileMix} totalLabel="Fulfilment mix" />
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
        <SectionCard title="Top states" eyebrow="Geography">
          <HorizontalBars items={mapToTopItems(stateCounts)} />
        </SectionCard>
        <SectionCard title="Top suburbs" eyebrow="Geography">
          <HorizontalBars items={mapToTopItems(suburbCounts)} />
        </SectionCard>
        <SectionCard title="Due weekday" eyebrow="Timing">
          <HorizontalBars items={mapToTopItems(dueWeekdayCounts, 7)} totalOverride={groups.length} />
        </SectionCard>
        <SectionCard title="Lead-time buckets" eyebrow="Timing">
          <HorizontalBars items={leadTimeBuckets} totalOverride={groups.length} />
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
        <SectionCard title="Packaging favourites" eyebrow="Products">
          <HorizontalBars items={mapToTopItems(packagingCounts)} />
        </SectionCard>
        <SectionCard title="Category demand" eyebrow="Products">
          <HorizontalBars items={mapToTopItems(categoryCounts)} />
        </SectionCard>
        <SectionCard title="Top flavours" eyebrow="Products">
          <HorizontalBars items={mapToTopItems(flavorCounts)} />
        </SectionCard>
        <SectionCard title="Payment providers" eyebrow="Payments">
          <HorizontalBars items={mapToTopItems(paymentCounts)} />
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr_0.9fr]">
        <SectionCard title="Customer profile" eyebrow="Signals">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "Business orders", value: toCount(businessOrders), note: toPercent(businessOrders, groups.length) },
              { label: "Personal orders", value: toCount(groups.length - businessOrders), note: toPercent(groups.length - businessOrders, groups.length) },
              { label: "Repeat-order checkouts", value: toCount(repeatOrders), note: toPercent(repeatOrders, groups.length) },
              { label: "One-off checkouts", value: toCount(groups.length - repeatOrders), note: toPercent(groups.length - repeatOrders, groups.length) },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-900">{item.value}</p>
                <p className="text-xs text-zinc-500">{item.note}</p>
              </div>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="Weight through the door" eyebrow="Production">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">Total ordered weight</p>
            <p className="mt-2 text-3xl font-semibold text-zinc-900">{Number.isFinite(totalWeightKg) ? `${totalWeightKg.toFixed(1)}kg` : "0.0kg"}</p>
            <p className="mt-2 text-sm text-zinc-500">
              Averaging{" "}
              <span className="font-semibold text-zinc-700">
                {groups.length > 0 ? `${(totalWeightKg / groups.length).toFixed(2)}kg` : "0.00kg"}
              </span>{" "}
              per grouped order.
            </p>
          </div>
        </SectionCard>
        <SectionCard title="Quick reads" eyebrow="Snapshot">
          <div className="space-y-3">
            {[
              {
                label: "Refund exposure",
                value: toCurrency(refundedRevenue),
                description: `${toPercent(refundedRevenue, grossRevenue)} of gross order value`,
              },
              {
                label: "Split checkout share",
                value: toCount(splitOrders),
                description: `${toPercent(splitOrders, groups.length)} of grouped orders`,
              },
              {
                label: "Top payment rail",
                value: topPaymentProvider?.label ?? "None",
                description: `${toCount(topPaymentProvider?.value ?? 0)} orders`,
              },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">{item.label}</p>
                <p className="mt-2 text-lg font-semibold text-zinc-900">{item.value}</p>
                <p className="text-xs text-zinc-500">{item.description}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </section>
  );
}
