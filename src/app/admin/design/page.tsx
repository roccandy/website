import { requireAdminSession } from "@/lib/adminAuth";
import { redirect, notFound } from "next/navigation";
import { loadCandyDesign } from "@/lib/candyDesignStore";
import { studioCandyDesign } from "@/lib/candyDesign";
import { DesignEditor } from "./DesignEditor";
import { getColorPalette } from "@/lib/data";
import { resolveSiteDesignerDefaults } from "@/lib/siteDesignerDefaults";
export const dynamic = "force-dynamic";
export default async function DesignStudioPage({
  searchParams,
}: {
  searchParams?: Promise<{ design?: string; revision?: string; new?: string }>;
}) {
  const session = await requireAdminSession();
  if (session.user.role === "seo" || session.user.role === "production")
    redirect("/admin");
  const params = await searchParams;
  const [design, palette] = await Promise.all([
    params?.design
      ? loadCandyDesign(params.design, Number(params.revision) || undefined)
      : Promise.resolve(null),
    getColorPalette(),
  ]);
  if (params?.design && !design) notFound();
  const defaults = resolveSiteDesignerDefaults(palette);
  return (
    <DesignEditor
      key={`${design?.source?.id || `new-${(params?.new || "initial").slice(0, 100)}`}-${design?.source?.revision || 0}`}
      initialDesign={design || studioCandyDesign(undefined, defaults)}
      canWrite={session.user.canWrite}
      siteDefaults={defaults}
    />
  );
}
