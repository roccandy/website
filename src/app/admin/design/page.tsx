import { requireAdminSession } from "@/lib/adminAuth";
import { redirect, notFound } from "next/navigation";
import { AdminLink } from "@/app/admin/AdminNavigationFeedback";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { loadCandyDesign } from "@/lib/candyDesignStore";
import { emptyCandyDesign, readCandyDesign } from "@/lib/candyDesign";
import { CandyPreview } from "@/app/quote/CandyPreview";
import { DesignEditor } from "./DesignEditor";
import { getColorPalette } from "@/lib/data";
import { resolveSiteDesignerDefaults } from "@/lib/siteDesignerDefaults";

export const dynamic = "force-dynamic";
export default async function DesignStudioPage({
  searchParams,
}: {
  searchParams?: Promise<{
    design?: string;
    revision?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const session = await requireAdminSession();
  if (session.user.role === "seo" || session.user.role === "production")
    redirect("/admin");
  const params = await searchParams;
  const revision = Number(params?.revision) || undefined;
  const search = (params?.q || "").trim().slice(0, 100);
  const pageNumber = Math.max(
    0,
    Math.min(10000, Math.floor(Number(params?.page) || 0)),
  );
  let libraryQuery = supabaseAdminClient
    .from("candy_designs")
    .select("id,name,document,revision,updated_at", { count: "exact" });
  if (search)
    libraryQuery = libraryQuery.ilike(
      "name",
      `%${search.replace(/[%_]/g, "\\$&")}%`,
    );
  const libraryHref = (page: number, designId = params?.design) => {
    const query = new URLSearchParams();
    if (designId) query.set("design", designId);
    if (designId === params?.design && params?.revision)
      query.set("revision", params.revision);
    if (search) query.set("q", search);
    if (page) query.set("page", String(page));
    return `/admin/design?${query}`;
  };
  const [library, design, palette] = await Promise.all([
    libraryQuery
      .order("updated_at", { ascending: false })
      .range(pageNumber * 24, pageNumber * 24 + 23),
    params?.design
      ? loadCandyDesign(params.design, revision)
      : Promise.resolve(null),
    getColorPalette(),
  ]);
  const siteDefaults = resolveSiteDesignerDefaults(palette);
  if (params?.design && !design) notFound();
  const revisions = design?.source
    ? await supabaseAdminClient
        .from("candy_design_revisions")
        .select("revision,created_at")
        .eq("design_id", design.source.id)
        .order("revision", { ascending: false })
        .limit(30)
    : null;
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Admin / Design
          </p>
          <h1 className="admin-page-title">Candy designs</h1>
        </div>
        <AdminLink
          href="/admin/design"
          className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-semibold"
        >
          New design
        </AdminLink>
      </div>
      {library.error ? (
        <p
          role="alert"
          className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
        >
          The design library is unavailable. Apply the Design Studio database
          migration before saving.
        </p>
      ) : (
        <details
          open={Boolean(search) || pageNumber > 0}
          className="rounded-xl border border-zinc-200 bg-white p-4"
        >
          <summary className="cursor-pointer text-sm font-semibold">
            Design library · {library.count || 0}{" "}
            {search ? "matching" : "saved"} designs
          </summary>
          <form
            action="/admin/design"
            method="get"
            className="mt-3 flex flex-wrap gap-2"
          >
            {params?.design && (
              <input type="hidden" name="design" value={params.design} />
            )}
            {params?.revision && (
              <input type="hidden" name="revision" value={params.revision} />
            )}
            <input
              name="q"
              aria-label="Search design library"
              defaultValue={search}
              maxLength={100}
              placeholder="Search designs by name"
              className="min-w-0 flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-semibold"
            >
              Search
            </button>
          </form>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {library.data?.map((row) => (
              <AdminLink
                key={row.id}
                href={libraryHref(pageNumber, row.id)}
                className="rounded-lg border border-zinc-200 p-3 text-sm hover:bg-zinc-50"
              >
                <CandyPreview
                  design={readCandyDesign(row.document)}
                  mode=""
                  colorOne="#d1d5db"
                  colorTwo="#d1d5db"
                  dimensions={{ width: 180, height: 134 }}
                />
                <span className="block truncate font-semibold">{row.name}</span>
                <span className="text-xs text-zinc-500">
                  Revision {row.revision} ·{" "}
                  {new Date(row.updated_at).toLocaleDateString("en-AU", {
                    timeZone: "Australia/Perth",
                  })}
                </span>
              </AdminLink>
            ))}
            {!library.data?.length && (
              <p className="text-sm text-zinc-500">
                {search
                  ? "No designs match this name."
                  : "Saved mockups and templates will appear here."}
              </p>
            )}
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs">
            {pageNumber > 0 && (
              <AdminLink
                className="underline"
                href={libraryHref(pageNumber - 1)}
              >
                Previous page
              </AdminLink>
            )}
            {library.count !== null && library.count > 24 && (
              <span>
                Page {pageNumber + 1} of {Math.ceil(library.count / 24)}
              </span>
            )}
            {(library.count || 0) > (pageNumber + 1) * 24 && (
              <AdminLink
                className="underline"
                href={libraryHref(pageNumber + 1)}
              >
                Next page
              </AdminLink>
            )}
          </div>
        </details>
      )}
      {revisions?.data && revisions.data.length > 1 && (
        <details className="rounded-lg border border-zinc-200 p-3 text-xs">
          <summary className="cursor-pointer">Previous revisions</summary>
          <div className="mt-2 flex flex-wrap gap-3">
            {revisions.data.map((row) => (
              <AdminLink
                key={row.revision}
                className="underline"
                href={`/admin/design?design=${design!.source!.id}&revision=${row.revision}`}
              >
                Revision {row.revision}
              </AdminLink>
            ))}
          </div>
          <p className="mt-2 text-zinc-500">
            Open an old revision, then save a copy to restore it without
            overwriting newer work.
          </p>
        </details>
      )}
      <DesignEditor
        key={`${design?.source?.id || "new"}-${design?.source?.revision || 0}`}
        initialDesign={design || emptyCandyDesign(undefined, siteDefaults)}
        canWrite={session.user.canWrite}
        siteDefaults={siteDefaults}
      />
    </section>
  );
}
