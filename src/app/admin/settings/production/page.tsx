import { getProductionBlocks, getSettings } from "@/lib/data";
import { logAdminActivity } from "@/lib/adminActivity";
import { requireAdminSession, requireAdminWriteAccess } from "@/lib/adminAuth";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { revalidateAdminPath as revalidatePath } from "@/lib/adminRevalidation";
import { redirect } from "next/navigation";
import { AdminLink as Link } from "@/app/admin/AdminNavigationFeedback";
import { AdminSubmitButton } from "@/components/AdminSubmitButton";
import { WebsiteBlockoutBannerSettings } from "./WebsiteBlockoutBannerSettings";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const DEFAULT_NO_PRODUCTION_DAYS = [
  { name: "no_production_mon", label: "Monday" },
  { name: "no_production_tue", label: "Tuesday" },
  { name: "no_production_wed", label: "Wednesday" },
  { name: "no_production_thu", label: "Thursday" },
  { name: "no_production_fri", label: "Friday" },
  { name: "no_production_sat", label: "Saturday" },
  { name: "no_production_sun", label: "Sunday" },
] as const;

const PRODUCTION_DUE_LEAD_DEFAULTS: Record<string, number> = {
  pickup: 3,
  WA: 3,
  ACT: 7,
  NSW: 7,
  NT: 7,
  QLD: 7,
  SA: 7,
  TAS: 7,
  VIC: 7,
};

const PRODUCTION_DUE_LEAD_OPTIONS = [
  { key: "pickup", label: "Pickup" },
  { key: "WA", label: "WA" },
  { key: "ACT", label: "ACT" },
  { key: "NSW", label: "NSW" },
  { key: "NT", label: "NT" },
  { key: "QLD", label: "QLD" },
  { key: "SA", label: "SA" },
  { key: "TAS", label: "TAS" },
  { key: "VIC", label: "VIC" },
] as const;

function revalidateProductionBlockoutPages() {
  revalidatePath("/admin/settings/production");
  revalidatePath("/");
  revalidatePath("/about");
  revalidatePath("/blog");
  revalidatePath("/faqs");
  revalidatePath("/privacy");
  revalidatePath("/terms-and-conditions");
  revalidatePath("/design");
  revalidatePath("/pre-made-candy");
  revalidatePath("/pre-made-candy/[item]", "page");
  revalidatePath("/checkout");
  revalidatePath("/[...slug]", "page");
}

async function updateProductionSettings(formData: FormData) {
  "use server";
  await requireAdminWriteAccess({ onDenied: "redirect", redirectTo: "/admin/settings/production" });

  const production_slots_per_day = Number(formData.get("production_slots_per_day"));
  const max_total_kg = Number(formData.get("max_total_kg"));
  const invoiceDueDaysRaw = Number(formData.get("invoice_due_days"));
  const invoice_due_days = Number.isFinite(invoiceDueDaysRaw)
    ? Math.min(90, Math.max(0, Math.floor(invoiceDueDaysRaw)))
    : 7;

  const client = supabaseAdminClient;
  const { error } = await client
    .from("settings")
    .update({
      production_slots_per_day,
      max_total_kg,
      invoice_due_days,
    })
    .eq("id", 1);

  if (error) {
    throw new Error(error.message);
  }

  revalidateProductionBlockoutPages();
  await logAdminActivity({
    area: "operations",
    action: "updated",
    entityType: "production-settings",
    entityLabel: "Production settings",
    summary: "Updated production and invoice settings.",
    path: "/admin/settings/production",
    changedFields: ["Slots per day", "Max total kg", "Invoice due days"],
  });
  redirect("/admin/settings/production");
}

async function updateBlockoutBannerSettings(formData: FormData) {
  "use server";
  await requireAdminWriteAccess({ onDenied: "redirect", redirectTo: "/admin/settings/production" });

  const show_quote_blockout_banner = formData.get("show_quote_blockout_banner") === "on";
  const monthsRaw = Number(formData.get("quote_blockout_months"));
  const quote_blockout_months = Number.isFinite(monthsRaw)
    ? Math.min(12, Math.max(1, Math.floor(monthsRaw)))
    : 3;

  const client = supabaseAdminClient;
  const { error } = await client
    .from("settings")
    .update({
      quote_blockout_months,
      show_quote_blockout_banner,
    })
    .eq("id", 1);

  if (error) {
    throw new Error(error.message);
  }

  revalidateProductionBlockoutPages();
  await logAdminActivity({
    area: "operations",
    action: "updated",
    entityType: "quote-blockout-window",
    entityLabel: "Quote blockout window",
    summary: "Updated the website blockout banner settings.",
    path: "/admin/settings/production",
    changedFields: ["Website blockout banner", "Quote blockout window"],
    metadata: {
      showQuoteBlockoutBanner: show_quote_blockout_banner,
      quoteBlockoutMonths: quote_blockout_months,
    },
  });
  redirect("/admin/settings/production");
}

async function updateProductionDueLeadDays(formData: FormData) {
  "use server";
  await requireAdminWriteAccess({ onDenied: "redirect", redirectTo: "/admin/settings/production" });

  const production_due_lead_days = Object.fromEntries(
    PRODUCTION_DUE_LEAD_OPTIONS.map(({ key }) => {
      const submitted = Number(formData.get(`due_lead_${key}`));
      const fallback = PRODUCTION_DUE_LEAD_DEFAULTS[key];
      return [key, Number.isFinite(submitted) ? Math.min(365, Math.max(0, Math.floor(submitted))) : fallback];
    }),
  );
  const { error } = await supabaseAdminClient
    .from("settings")
    .update({ production_due_lead_days })
    .eq("id", 1);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/orders");
  revalidatePath("/admin/settings/production");
  await logAdminActivity({
    area: "operations",
    action: "updated",
    entityType: "production-settings",
    entityLabel: "Production due lead times",
    summary: "Updated production due lead times by state and pickup.",
    path: "/admin/settings/production",
    changedFields: ["Production due lead times"],
    metadata: { productionDueLeadDays: production_due_lead_days },
  });
  redirect("/admin/settings/production");
}

async function updateDefaultNoProduction(formData: FormData) {
  "use server";
  await requireAdminWriteAccess({ onDenied: "redirect", redirectTo: "/admin/settings/production" });

  const no_production_mon = formData.get("no_production_mon") === "on";
  const no_production_tue = formData.get("no_production_tue") === "on";
  const no_production_wed = formData.get("no_production_wed") === "on";
  const no_production_thu = formData.get("no_production_thu") === "on";
  const no_production_fri = formData.get("no_production_fri") === "on";
  const no_production_sat = formData.get("no_production_sat") === "on";
  const no_production_sun = formData.get("no_production_sun") === "on";

  const client = supabaseAdminClient;
  const { error } = await client
    .from("settings")
    .update({
      no_production_mon,
      no_production_tue,
      no_production_wed,
      no_production_thu,
      no_production_fri,
      no_production_sat,
      no_production_sun,
    })
    .eq("id", 1);

  if (error) {
    throw new Error(error.message);
  }

  revalidateProductionBlockoutPages();
  await logAdminActivity({
    area: "operations",
    action: "updated",
    entityType: "production-days",
    entityLabel: "Default no-production days",
    summary: "Updated default no-production days.",
    path: "/admin/settings/production",
    changedFields: ["Default no-production days"],
  });
  redirect("/admin/settings/production");
}

async function addBlock(formData: FormData) {
  "use server";
  await requireAdminWriteAccess({ onDenied: "redirect", redirectTo: "/admin/settings/production" });

  const start_date = formData.get("start_date")?.toString();
  const end_date = formData.get("end_date")?.toString();
  const reason = formData.get("reason")?.toString().trim();

  if (!start_date || !reason) {
    throw new Error("Start date and reason are required.");
  }

  const resolvedEnd = end_date && end_date.length > 0 ? end_date : start_date;

  const client = supabaseAdminClient;
  const { error } = await client.from("production_blocks").insert({
    start_date,
    end_date: resolvedEnd,
    reason,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidateProductionBlockoutPages();
  await logAdminActivity({
    area: "operations",
    action: "created",
    entityType: "production-block",
    entityLabel: reason,
    summary: `Added production block "${reason}" from ${start_date} to ${resolvedEnd}.`,
    path: "/admin/settings/production",
    changedFields: ["Blocked dates"],
  });
  redirect("/admin/settings/production");
}

async function deleteBlock(formData: FormData) {
  "use server";
  await requireAdminWriteAccess({ onDenied: "redirect", redirectTo: "/admin/settings/production" });

  const id = formData.get("id")?.toString();
  if (!id) {
    throw new Error("Block id missing.");
  }

  const client = supabaseAdminClient;
  const { data: existing } = await client.from("production_blocks").select("id,start_date,end_date,reason").eq("id", id).maybeSingle();
  const { error } = await client.from("production_blocks").delete().eq("id", id);
  if (error) {
    throw new Error(error.message);
  }

  revalidateProductionBlockoutPages();
  await logAdminActivity({
    area: "operations",
    action: "deleted",
    entityType: "production-block",
    entityId: existing?.id ?? id,
    entityLabel: existing?.reason ?? "Production block",
    summary: `Deleted production block${existing ? ` "${existing.reason}"` : ""}.`,
    path: "/admin/settings/production",
    changedFields: ["Blocked dates"],
  });
  redirect("/admin/settings/production");
}

async function updateBlock(formData: FormData) {
  "use server";
  await requireAdminWriteAccess({ onDenied: "redirect", redirectTo: "/admin/settings/production" });

  const id = formData.get("id")?.toString();
  const start_date = formData.get("start_date")?.toString();
  const end_date = formData.get("end_date")?.toString();
  const reason = formData.get("reason")?.toString().trim();

  if (!id) {
    throw new Error("Block id missing.");
  }
  if (!start_date || !reason) {
    throw new Error("Start date and reason are required.");
  }

  const resolvedEnd = end_date && end_date.length > 0 ? end_date : start_date;

  const client = supabaseAdminClient;
  const { error } = await client
    .from("production_blocks")
    .update({
      start_date,
      end_date: resolvedEnd,
      reason,
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidateProductionBlockoutPages();
  await logAdminActivity({
    area: "operations",
    action: "updated",
    entityType: "production-block",
    entityId: id,
    entityLabel: reason,
    summary: `Updated production block "${reason}" from ${start_date} to ${resolvedEnd}.`,
    path: "/admin/settings/production",
    changedFields: ["Blocked dates"],
  });
  redirect("/admin/settings/production");
}

export default async function SettingsProductionPage() {
  await requireAdminSession();

  const [settings, blocks] = await Promise.all([getSettings(), getProductionBlocks()]);
  const quoteBlockoutMonthsRaw = Number(settings.quote_blockout_months ?? 3);
  const quoteBlockoutMonths = Number.isFinite(quoteBlockoutMonthsRaw)
    ? Math.min(12, Math.max(1, Math.floor(quoteBlockoutMonthsRaw)))
    : 3;
  const showQuoteBlockoutBanner = settings.show_quote_blockout_banner !== false;
  const invoiceDueDaysRaw = Number(settings.invoice_due_days ?? 7);
  const invoiceDueDays = Number.isFinite(invoiceDueDaysRaw)
    ? Math.min(90, Math.max(0, Math.floor(invoiceDueDaysRaw)))
    : 7;
  const productionDueLeadDays = Object.fromEntries(
    PRODUCTION_DUE_LEAD_OPTIONS.map(({ key }) => {
      const configured = Number(settings.production_due_lead_days?.[key]);
      return [key, Number.isFinite(configured) && configured >= 0 ? Math.floor(configured) : PRODUCTION_DUE_LEAD_DEFAULTS[key]];
    }),
  ) as Record<string, number>;

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="admin-page-title">Production settings</h2>
        </div>
        <Link
          href="/admin/orders"
          className="rounded border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
        >
          Production schedule
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
      <form action={updateProductionSettings} className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-zinc-900">Capacity</h3>
        </div>
        <div className="divide-y divide-zinc-100">
          <label className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_9rem] sm:items-center">
            <span><span className="block text-sm font-medium text-zinc-900">Slots per day</span><span className="mt-0.5 block text-xs text-zinc-500">Number of production slots on an open day.</span></span>
            <input
              type="number"
              name="production_slots_per_day"
              defaultValue={settings.production_slots_per_day}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              min={1}
            />
          </label>
          <label className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_9rem] sm:items-center">
            <span><span className="block text-sm font-medium text-zinc-900">Daily capacity</span><span className="mt-0.5 block text-xs text-zinc-500">Maximum total weight produced per day.</span></span>
            <input
              type="number"
              step="0.1"
              name="max_total_kg"
              defaultValue={settings.max_total_kg}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              min={0}
            />
          </label>
          <label className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_9rem] sm:items-center">
            <span><span className="block text-sm font-medium text-zinc-900">Invoice due in</span><span className="mt-0.5 block text-xs text-zinc-500">Days after creating an admin invoice.</span></span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                name="invoice_due_days"
                defaultValue={invoiceDueDays}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                min={0}
                max={90}
                required
              />
              <span className="text-xs text-zinc-500">days</span>
            </div>
          </label>
        </div>
        <div className="border-t border-zinc-100 px-5 py-3">
          <AdminSubmitButton
            type="submit"
            pendingLabel="Saving..."
            className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Save settings
          </AdminSubmitButton>
        </div>
      </form>

      <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-zinc-900">Calendar warning lead time</h3>
          <p className="mt-1 text-xs text-zinc-500">Flag orders when the required date is too close to their production day.</p>
        </div>
        <form action={updateProductionDueLeadDays}>
          <div className="grid divide-y divide-zinc-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-3">
            {PRODUCTION_DUE_LEAD_OPTIONS.map(({ key, label }) => (
              <label key={key} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="font-medium text-zinc-900">{label}</span>
                <input
                  type="number"
                  name={`due_lead_${key}`}
                  min={0}
                  max={365}
                  defaultValue={productionDueLeadDays[key]}
                  required
                  className="w-16 rounded border border-zinc-300 bg-white px-2 py-1.5 text-right text-sm text-zinc-900"
                />
              </label>
            ))}
          </div>
          <div className="border-t border-zinc-100 px-5 py-3"><AdminSubmitButton type="submit" pendingLabel="Saving..." className="rounded-md border border-zinc-900 bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800">Save lead times</AdminSubmitButton></div>
        </form>
      </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(18rem,0.7fr)_minmax(0,1.3fr)]">
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="space-y-1">
            <h3 className="admin-card-title text-zinc-900">Regular closed days</h3>
            <p className="mt-1 text-xs text-zinc-500">These days are unavailable every week.</p>
          </div>
          <form action={updateDefaultNoProduction} className="space-y-3">
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {DEFAULT_NO_PRODUCTION_DAYS.map((day) => (
                <label key={day.name} className="flex items-center gap-2 rounded border border-zinc-200 px-3 py-2 text-xs">
                  <input
                    type="checkbox"
                    name={day.name}
                    defaultChecked={Boolean(settings[day.name])}
                  />
                  <span>{day.label}</span>
                </label>
              ))}
            </div>
            <AdminSubmitButton
              type="submit"
              pendingLabel="Saving..."
              className="rounded-md border border-zinc-900 bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
            >
              Save default days
            </AdminSubmitButton>
          </form>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div>
            <h3 className="admin-card-title text-zinc-900">Date-specific blocks</h3>
            <p className="mt-1 text-xs text-zinc-500">Add holidays, shutdowns and other one-off closures.</p>
          </div>
          <div className="mt-5 border-t border-zinc-100 pt-5">
            <h4 className="text-sm font-semibold text-zinc-900">Website notice</h4>
            <div className="mt-3">
              <WebsiteBlockoutBannerSettings
                enabled={showQuoteBlockoutBanner}
                months={quoteBlockoutMonths}
                action={updateBlockoutBannerSettings}
              />
            </div>
          </div>
          <div className="mt-5 border-t border-zinc-100 pt-5">
            <h4 className="text-sm font-semibold text-zinc-900">Add a production block</h4>
          <form action={addBlock} className="mt-3 grid gap-3 md:grid-cols-4">
            <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              Start date
              <input
                type="date"
                name="start_date"
                required
                className="mt-1 w-full rounded border border-zinc-200 px-2 py-1 text-sm"
              />
            </label>
            <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              End date (optional)
              <input
                type="date"
                name="end_date"
                className="mt-1 w-full rounded border border-zinc-200 px-2 py-1 text-sm"
              />
            </label>
            <label className="md:col-span-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
              Reason
              <input
                type="text"
                name="reason"
                required
                placeholder="e.g., Christmas shutdown"
                className="mt-1 w-full rounded border border-zinc-200 px-2 py-1 text-sm"
              />
            </label>
            <div className="md:col-span-4">
              <AdminSubmitButton
                type="submit"
                pendingLabel="Saving..."
                className="rounded-md border border-zinc-900 bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
              >
                Add block
              </AdminSubmitButton>
            </div>
          </form>
          </div>

        <div className="mt-5 border-t border-zinc-100 pt-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-zinc-900">Saved blocks</h4>
          </div>
        <div className="overflow-x-auto rounded-xl border border-zinc-200">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 text-[11px] uppercase tracking-[0.2em] text-zinc-500">
              <tr>
                <th className="px-3 py-2 text-left">Dates</th>
                <th className="px-3 py-2 text-left">Reason</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {blocks.length === 0 && (
                <tr>
                  <td className="px-3 py-3 text-sm text-zinc-500" colSpan={3}>
                    No blocked dates yet.
                  </td>
                </tr>
              )}
              {blocks.map((block) => (
                <tr key={block.id}>
                  <td className="px-3 py-2 text-zinc-700">
                    {block.start_date}
                    {block.end_date !== block.start_date ? ` -> ${block.end_date}` : ""}
                  </td>
                  <td className="px-3 py-2 text-zinc-700">{block.reason}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <details className="group">
                        <summary className="cursor-pointer text-xs font-semibold text-zinc-700 underline underline-offset-4">
                          Edit
                        </summary>
                        <form
                          action={updateBlock}
                          className="mt-2 grid gap-2 rounded-lg border border-zinc-200 bg-white p-3 text-left text-xs text-zinc-600 shadow-sm"
                        >
                          <input type="hidden" name="id" value={block.id} />
                          <label className="block">
                            <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Start</span>
                            <input
                              type="date"
                              name="start_date"
                              defaultValue={block.start_date}
                              required
                              className="mt-1 w-full rounded border border-zinc-200 px-2 py-1 text-xs"
                            />
                          </label>
                          <label className="block">
                            <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">End</span>
                            <input
                              type="date"
                              name="end_date"
                              defaultValue={block.end_date ?? ""}
                              className="mt-1 w-full rounded border border-zinc-200 px-2 py-1 text-xs"
                            />
                          </label>
                          <label className="block">
                            <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Reason</span>
                            <input
                              type="text"
                              name="reason"
                              defaultValue={block.reason}
                              required
                              className="mt-1 w-full rounded border border-zinc-200 px-2 py-1 text-xs"
                            />
                          </label>
                          <div className="flex justify-end">
              <AdminSubmitButton
                type="submit"
                pendingLabel="Saving..."
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-zinc-800"
              >
                Save
              </AdminSubmitButton>
                          </div>
                        </form>
                      </details>
                      <form action={deleteBlock}>
                        <input type="hidden" name="id" value={block.id} />
                        <AdminSubmitButton type="submit" className="text-xs font-semibold text-red-600 underline underline-offset-4">
                          Remove
                        </AdminSubmitButton>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
        </section>
      </div>
    </section>
  );
}
