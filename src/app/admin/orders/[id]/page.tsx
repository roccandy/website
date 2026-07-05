import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getCategories,
  getFlavors,
  getPackagingOptions,
  getSettings,
  type OrderRow,
} from "@/lib/data";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { formatDate, formatMoney } from "../productionScheduleShared";
import { OrderDetailEditor } from "./OrderDetailEditor";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type Params = {
  params?: { id?: string } | Promise<{ id?: string }>;
};

type SearchParams = {
  toast?: string;
  message?: string;
};

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

async function loadOrder(rawId: string) {
  const query = supabaseAdminClient.from("orders").select("*");
  if (isUuid(rawId)) {
    const { data, error } = await query.eq("id", rawId).maybeSingle();
    if (error) throw new Error(error.message);
    return (data as OrderRow | null) ?? null;
  }
  const { data, error } = await query
    .eq("order_number", rawId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  return (data?.[0] as OrderRow | null) ?? null;
}

export default async function AdminOrderDetailPage({
  params,
  searchParams,
}: Params & { searchParams?: SearchParams | Promise<SearchParams> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/admin/login");

  const resolvedParams = await Promise.resolve(params);
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const rawId = resolvedParams?.id?.trim() || "";
  if (!rawId) redirect("/admin/orders");

  const order = await loadOrder(rawId);
  if (!order) redirect("/admin/orders");

  const [categories, packagingOptions, flavors, settings] = await Promise.all([
    getCategories(),
    getPackagingOptions(),
    getFlavors(),
    getSettings(),
  ]);
  const toastTone = resolvedSearchParams?.toast === "error" ? "error" : resolvedSearchParams?.toast === "success" ? "success" : null;
  const toastMessage = resolvedSearchParams?.message ?? null;
  const orderLabel = order.order_number ? `#${order.order_number}` : `#${order.id.slice(0, 8)}`;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Admin / Orders</p>
          <h2 className="admin-page-title">Order details</h2>
          <p className="text-sm text-zinc-600">
            {orderLabel} · {order.title || order.customer_name || "Untitled order"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/orders/${order.id}/print?id=${order.id}`}
            target="_blank"
            rel="noreferrer"
            className="rounded border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
          >
            Print
          </Link>
          <Link
            href={`/admin/orders?selected=${encodeURIComponent(order.id)}`}
            className="rounded border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
          >
            Back to schedule
          </Link>
        </div>
      </div>

      {toastTone && toastMessage ? (
        <p
          className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
            toastTone === "error"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {toastMessage}
        </p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-400">Total</p>
          <p className="mt-1 text-sm font-semibold text-zinc-900">{formatMoney(order.total_price)}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-400">Required</p>
          <p className="mt-1 text-sm font-semibold text-zinc-900">{formatDate(order.due_date) || "-"}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-400">Customer</p>
          <p className="mt-1 text-sm font-semibold text-zinc-900">{order.customer_name || order.customer_email || "-"}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-400">Payment</p>
          <p className="mt-1 text-sm font-semibold text-zinc-900">
            {order.payment_method || order.payment_provider || "-"}
          </p>
        </div>
      </div>

      <OrderDetailEditor
        order={order}
        cancelHref={`/admin/orders?selected=${encodeURIComponent(order.id)}`}
        categories={categories}
        packagingOptions={packagingOptions}
        flavors={flavors}
        settings={settings}
      />
    </section>
  );
}
