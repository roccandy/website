import { getFlavors, getPremadeCandies } from "@/lib/data";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AddPremadeForm } from "./AddPremadeForm";
import { PremadeList } from "./PremadeList";
import { PremadeSyncControls } from "./PremadeSyncControls";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const PREMADE_IMAGE_BUCKET = "premade-images";

function buildPremadeImageUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base || !path) return "";
  const encoded = encodeURIComponent(path);
  return `${base}/storage/v1/object/public/${PREMADE_IMAGE_BUCKET}/${encoded}`;
}

export default async function PremadeAdminPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/admin/login");

  const [candies, flavors] = await Promise.all([getPremadeCandies(), getFlavors()]);
  const sorted = [...candies].sort((a, b) => {
    const aSort = a.sort_order ?? 0;
    const bSort = b.sort_order ?? 0;
    if (aSort !== bSort) return aSort - bSort;
    return a.name.localeCompare(b.name);
  });
  const flavorOptions = flavors.map((flavor) => flavor.name);

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Admin / Pre-made</p>
        <h2 className="admin-page-title">Pre-made candy</h2>
        <p className="text-sm text-zinc-600">Add or update pre-made candy items for the shop page.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-[2fr,1fr]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="admin-card-title text-zinc-900">Current items</h3>
            <PremadeSyncControls totalCount={sorted.length} />
          </div>
          {sorted.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">No pre-made candy yet.</p>
          ) : (
            <div className="mt-3">
              <PremadeList
                items={sorted.map((item) => ({
                  ...item,
                  imageUrl: buildPremadeImageUrl(item.image_path),
                }))}
                flavorOptions={flavorOptions}
              />
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h3 className="admin-card-title text-zinc-900">Add new item</h3>
          <AddPremadeForm flavorOptions={flavorOptions} />
        </div>
      </div>
    </section>
  );
}
