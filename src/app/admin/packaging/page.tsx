import { getCategories, getLabelTypes, getPackagingOptionImages, getPackagingOptions, getSettings } from "@/lib/data";
import { listBucketObjectInfo } from "@/lib/storageObjects";
import { PackagingTable } from "./PackagingTable";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function PackagingPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/admin/login");
  }

  const [options, categories, images, settings, labelTypes, imageObjectInfo] = await Promise.all([
    getPackagingOptions(),
    getCategories(),
    getPackagingOptionImages(),
    getSettings(),
    getLabelTypes(),
    listBucketObjectInfo("packaging-images"),
  ]);

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Admin / Packaging</p>
        <h2 className="text-3xl font-semibold">Packaging options</h2>
        <p className="text-sm text-zinc-600">Add or update packaging options in the table below.</p>
        <p className="text-sm text-zinc-600">Scroll down to upload or replace images for each packaging combination.</p>
      </div>

      <PackagingTable
        options={options}
        categories={categories}
        images={images}
        imageObjectInfo={imageObjectInfo}
        maxTotalKg={Number(settings?.max_total_kg ?? 0)}
        labelTypes={labelTypes}
      />
    </section>
  );
}
