import { getLabelTypes } from "@/lib/data";
import { LabelTypesTable } from "./LabelTypesTable";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function PackagingLabelsPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/admin/login");
  }

  const labelTypes = await getLabelTypes();

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Admin / Packaging / Labels</p>
        <h2 className="admin-page-title">Label types</h2>
        <p className="text-sm text-zinc-600">
          Create label options to use for packaging. Cost is for internal reference only.
        </p>
      </div>

      <LabelTypesTable labelTypes={labelTypes} />
    </section>
  );
}
