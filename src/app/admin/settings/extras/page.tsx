import { getSettings } from "@/lib/data";
import { requireAdminSession, requireAdminWriteAccess } from "@/lib/adminAuth";
import { supabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

async function updateExtrasPricing(formData: FormData) {
  "use server";
  await requireAdminWriteAccess({ onDenied: "redirect", redirectTo: "/admin/settings/extras" });

  const lead_time_days = Number(formData.get("lead_time_days"));
  const urgency_fee = Number(formData.get("urgency_fee"));
  const transaction_fee_percent = Number(formData.get("transaction_fee_percent"));
  const jacket_rainbow = Number(formData.get("jacket_rainbow"));
  const jacket_two_colour = Number(formData.get("jacket_two_colour"));
  const jacket_pinstripe = Number(formData.get("jacket_pinstripe"));

  const client = supabaseServerClient;
  const { error } = await client
    .from("settings")
    .update({
      lead_time_days,
      urgency_fee,
      transaction_fee_percent,
      jacket_rainbow,
      jacket_two_colour,
      jacket_pinstripe,
    })
    .eq("id", 1);

  if (error) {
    throw new Error(error.message);
  }

  redirect("/admin/settings/extras");
}

export default async function SettingsExtrasPage() {
  await requireAdminSession();

  const settings = await getSettings();

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Admin / Settings</p>
        <h2 className="text-3xl font-semibold">Extras pricing</h2>
        <p className="text-sm text-zinc-600">Update jacket options, urgency fees, and transaction fee.</p>
      </div>

      <form
        action={updateExtrasPricing}
        className="grid gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
      >
        <fieldset className="space-y-2 text-sm text-zinc-700">
          <h3 className="text-base font-semibold text-zinc-900">Urgency fee</h3>
          <label className="block">
            <span className="text-xs text-zinc-500">Urgency period (days)</span>
            <input
              type="number"
              name="lead_time_days"
              defaultValue={settings.lead_time_days}
              className="mt-1 w-full rounded border border-zinc-200 px-2 py-1"
              min={0}
            />
          </label>
          <label className="block">
            <span className="text-xs text-zinc-500">Urgency fee (%)</span>
            <input
              type="number"
              step="0.01"
              name="urgency_fee"
              defaultValue={settings.urgency_fee}
              className="mt-1 w-full rounded border border-zinc-200 px-2 py-1"
              min={0}
            />
          </label>
        </fieldset>

        <fieldset className="space-y-2 text-sm text-zinc-700">
          <h3 className="text-base font-semibold text-zinc-900">Transaction fee</h3>
          <label className="block">
            <span className="text-xs text-zinc-500">Transaction fee (%)</span>
            <input
              type="number"
              step="0.01"
              name="transaction_fee_percent"
              defaultValue={settings.transaction_fee_percent}
              className="mt-1 w-full rounded border border-zinc-200 px-2 py-1"
              min={0}
            />
          </label>
        </fieldset>

        <fieldset className="space-y-2 text-sm text-zinc-700">
          <h3 className="text-base font-semibold text-zinc-900">Jacket pricing options</h3>
          <div className="grid gap-3">
            <label className="block">
              <span className="text-xs text-zinc-500">Rainbow ($)</span>
              <input
                type="number"
                step="0.01"
                name="jacket_rainbow"
                defaultValue={settings.jacket_rainbow}
                className="mt-1 w-full rounded border border-zinc-200 px-2 py-1"
                min={0}
              />
            </label>
            <label className="block">
              <span className="text-xs text-zinc-500">Two colour ($)</span>
              <input
                type="number"
                step="0.01"
                name="jacket_two_colour"
                defaultValue={settings.jacket_two_colour}
                className="mt-1 w-full rounded border border-zinc-200 px-2 py-1"
                min={0}
              />
            </label>
            <label className="block">
              <span className="text-xs text-zinc-500">Pinstripe ($)</span>
              <input
                type="number"
                step="0.01"
                name="jacket_pinstripe"
                defaultValue={settings.jacket_pinstripe}
                className="mt-1 w-full rounded border border-zinc-200 px-2 py-1"
                min={0}
              />
            </label>
          </div>
        </fieldset>

        <div>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Save extras pricing
          </button>
        </div>
      </form>
    </section>
  );
}
