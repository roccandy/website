import { getLabelRanges, getLabelTypes, getSettings } from "@/lib/data";
import { LabelsTable } from "./LabelsTable";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function LabelsPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/admin/login");
  }

  const [ranges, settings, labelTypes] = await Promise.all([
    getLabelRanges(),
    getSettings(),
    getLabelTypes(),
  ]);

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Admin / Labels</p>
        <h2 className="text-3xl font-semibold">Label settings</h2>
        <p className="text-sm text-zinc-600">Manage bulk label limits and ingredient label defaults.</p>
      </div>

      <LabelsTable
        ranges={ranges}
        settings={settings}
        labelTypes={labelTypes}
      />
    </section>
  );
}
