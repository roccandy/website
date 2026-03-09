import { getProductionBlocks, getSettings } from "@/lib/data";
import { requireAdminSession, requireAdminWriteAccess } from "@/lib/adminAuth";
import { supabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

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

async function updateProductionSettings(formData: FormData) {
  "use server";
  await requireAdminWriteAccess();

  const production_slots_per_day = Number(formData.get("production_slots_per_day"));
  const max_total_kg = Number(formData.get("max_total_kg"));

  const client = supabaseServerClient;
  const { error } = await client
    .from("settings")
    .update({
      production_slots_per_day,
      max_total_kg,
    })
    .eq("id", 1);

  if (error) {
    throw new Error(error.message);
  }

  redirect("/admin/settings/production");
}

async function updateBlockoutVisibilityWindow(formData: FormData) {
  "use server";
  await requireAdminWriteAccess();

  const monthsRaw = Number(formData.get("quote_blockout_months"));
  const quote_blockout_months = Number.isFinite(monthsRaw)
    ? Math.min(12, Math.max(1, Math.floor(monthsRaw)))
    : 3;

  const client = supabaseServerClient;
  const { error } = await client
    .from("settings")
    .update({
      quote_blockout_months,
    })
    .eq("id", 1);

  if (error) {
    throw new Error(error.message);
  }

  redirect("/admin/settings/production");
}

async function updateDefaultNoProduction(formData: FormData) {
  "use server";
  await requireAdminWriteAccess();

  const no_production_mon = formData.get("no_production_mon") === "on";
  const no_production_tue = formData.get("no_production_tue") === "on";
  const no_production_wed = formData.get("no_production_wed") === "on";
  const no_production_thu = formData.get("no_production_thu") === "on";
  const no_production_fri = formData.get("no_production_fri") === "on";
  const no_production_sat = formData.get("no_production_sat") === "on";
  const no_production_sun = formData.get("no_production_sun") === "on";

  const client = supabaseServerClient;
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

  redirect("/admin/settings/production");
}

async function addBlock(formData: FormData) {
  "use server";
  await requireAdminWriteAccess();

  const start_date = formData.get("start_date")?.toString();
  const end_date = formData.get("end_date")?.toString();
  const reason = formData.get("reason")?.toString().trim();

  if (!start_date || !reason) {
    throw new Error("Start date and reason are required.");
  }

  const resolvedEnd = end_date && end_date.length > 0 ? end_date : start_date;

  const client = supabaseServerClient;
  const { error } = await client.from("production_blocks").insert({
    start_date,
    end_date: resolvedEnd,
    reason,
  });

  if (error) {
    throw new Error(error.message);
  }

  redirect("/admin/settings/production");
}

async function deleteBlock(formData: FormData) {
  "use server";
  await requireAdminWriteAccess();

  const id = formData.get("id")?.toString();
  if (!id) {
    throw new Error("Block id missing.");
  }

  const client = supabaseServerClient;
  const { error } = await client.from("production_blocks").delete().eq("id", id);
  if (error) {
    throw new Error(error.message);
  }

  redirect("/admin/settings/production");
}

async function updateBlock(formData: FormData) {
  "use server";
  await requireAdminWriteAccess();

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

  const client = supabaseServerClient;
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

  redirect("/admin/settings/production");
}

export default async function SettingsProductionPage() {
  await requireAdminSession();

  const [settings, blocks] = await Promise.all([getSettings(), getProductionBlocks()]);
  const quoteBlockoutMonthsRaw = Number(settings.quote_blockout_months ?? 3);
  const quoteBlockoutMonths = Number.isFinite(quoteBlockoutMonthsRaw)
    ? Math.min(12, Math.max(1, Math.floor(quoteBlockoutMonthsRaw)))
    : 3;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Admin / Settings</p>
          <h2 className="text-3xl font-semibold">Production settings</h2>
          <p className="text-sm text-zinc-600">Production options & Blocked Dates</p>
        </div>
        <Link
          href="/admin/orders"
          className="rounded border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
        >
          Production schedule
        </Link>
      </div>

      <form
        action={updateProductionSettings}
        className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
      >
        <h3 className="text-base font-semibold text-zinc-900">Production options</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm text-zinc-700">
            <span className="text-xs text-zinc-500">Slots per production day</span>
            <input
              type="number"
              name="production_slots_per_day"
              defaultValue={settings.production_slots_per_day}
              className="mt-1 w-full rounded border border-zinc-200 px-2 py-1"
              min={1}
            />
          </label>
          <label className="block text-sm text-zinc-700">
            <span className="text-xs text-zinc-500">Max total kg</span>
            <input
              type="number"
              step="0.1"
              name="max_total_kg"
              defaultValue={settings.max_total_kg}
              className="mt-1 w-full rounded border border-zinc-200 px-2 py-1"
              min={0}
            />
          </label>
        </div>
        <div>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Save production settings
          </button>
        </div>
      </form>

      <div className="space-y-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-zinc-900">Blocked dates</h3>
          <p className="text-xs text-zinc-500">Default no-production days and one-off blocks.</p>
        </div>
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-zinc-900">Default no-production days</h4>
          <form action={updateDefaultNoProduction} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
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
            <button
              type="submit"
              className="rounded-md border border-zinc-900 bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
            >
              Save default days
            </button>
          </form>
        </div>

        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-zinc-900">No-production blockouts</h4>
            <p className="text-xs text-zinc-500">
              Block dates for holidays etc. Any dates blocked here will show up on the website as
              {" "}
              <span className="font-semibold text-zinc-700">&quot;Production full between A and B&quot;</span>.
              {" "}
              This will appear on the website X months before the blocked period starts.
            </p>
          </div>
          <form action={updateBlockoutVisibilityWindow} className="grid gap-3 md:grid-cols-[260px_auto] md:items-end">
            <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              X months
              <input
                type="number"
                name="quote_blockout_months"
                min={1}
                max={12}
                defaultValue={quoteBlockoutMonths}
                className="mt-1 w-full rounded border border-zinc-200 px-2 py-1 text-sm"
                required
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="rounded-md border border-zinc-900 bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
              >
                Save website window
              </button>
              <p className="text-xs text-zinc-500">Current value: {quoteBlockoutMonths} month{quoteBlockoutMonths === 1 ? "" : "s"}.</p>
            </div>
          </form>
          <form action={addBlock} className="grid gap-3 md:grid-cols-4">
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
              <button
                type="submit"
                className="rounded-md border border-zinc-900 bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
              >
                Add block
              </button>
            </div>
          </form>
        </div>

        <div className="overflow-x-auto">
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
                            <button
                              type="submit"
                              className="rounded-md bg-zinc-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-zinc-800"
                            >
                              Save
                            </button>
                          </div>
                        </form>
                      </details>
                      <form action={deleteBlock}>
                        <input type="hidden" name="id" value={block.id} />
                        <button type="submit" className="text-xs font-semibold text-red-600 underline underline-offset-4">
                          Remove
                        </button>
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
  );
}
