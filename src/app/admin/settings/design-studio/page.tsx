import { AdminSubmitButton } from "@/components/AdminSubmitButton";
import { logAdminActivity } from "@/lib/adminActivity";
import { requireAdminSession, requireAdminWriteAccess } from "@/lib/adminAuth";
import { getSettings } from "@/lib/data";
import { revalidateAdminPath } from "@/lib/adminRevalidation";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function updateDesignStudioSettings(formData: FormData) {
  "use server";
  const path = "/admin/settings/design-studio";
  await requireAdminWriteAccess({ onDenied: "redirect", redirectTo: path });
  const submitted = Number(formData.get("design_clipboard_image_width"));
  if (!Number.isInteger(submitted) || submitted < 320 || submitted > 5000)
    throw new Error("Clipboard image width must be a whole number from 320 to 5000 pixels.");
  const { error } = await supabaseAdminClient
    .from("settings")
    .update({ design_clipboard_image_width: submitted })
    .eq("id", 1);
  if (error) throw new Error(error.message);
  revalidateAdminPath(path);
  revalidateAdminPath("/admin/design");
  await logAdminActivity({
    area: "operations",
    action: "updated",
    entityType: "design-studio-settings",
    entityLabel: "Design Studio settings",
    summary: "Updated the copied Studio image size.",
    path,
    changedFields: ["Clipboard image width"],
  });
  redirect(path);
}

export default async function DesignStudioSettingsPage() {
  const session = await requireAdminSession();
  if (session.user.role === "seo" || session.user.role === "production")
    redirect("/admin");
  const settings = await getSettings();
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Admin / Settings</p>
        <h2 className="admin-page-title">Design Studio settings</h2>
        <p className="text-sm text-zinc-600">
          Choose the width of the PNG copied from Design Studio for pasting into email.
        </p>
      </div>
      <form action={updateDesignStudioSettings} className="max-w-xl space-y-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <label className="block text-sm text-zinc-700">
          <span className="text-xs text-zinc-500">Copied image width (pixels)</span>
          <input
            type="number"
            name="design_clipboard_image_width"
            defaultValue={settings?.design_clipboard_image_width ?? 1200}
            min={320}
            max={5000}
            step={1}
            required
            className="mt-1 block w-full rounded border border-zinc-200 px-2 py-1"
          />
          <span className="mt-1 block text-xs text-zinc-500">Height is scaled automatically to preserve the Studio preview proportions.</span>
        </label>
        <AdminSubmitButton type="submit" pendingLabel="Saving..." className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800">
          Save Design Studio settings
        </AdminSubmitButton>
      </form>
    </section>
  );
}
