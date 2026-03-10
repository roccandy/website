import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getManagedSitePage } from "@/lib/sitePages";
import { savePrivacyPage } from "./actions";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type SearchParams = { updated?: string } | Promise<{ updated?: string }>;

export default async function AdminPrivacySettingsPage({ searchParams }: { searchParams?: SearchParams }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/admin/login");
  }

  const resolvedSearchParams = await Promise.resolve(searchParams);
  const privacyPage = await getManagedSitePage("privacy");
  const wasUpdated = resolvedSearchParams?.updated === "1";
  const canWriteSeo = session.user.canWriteSeo;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Admin / Site Settings</p>
          <h1 className="text-3xl font-semibold text-zinc-900">Privacy Policy</h1>
          <p className="text-sm text-zinc-600">
            Edit the public privacy page here. Paste the policy as HTML.
          </p>
        </div>
        <Link
          href="/privacy"
          className="rounded border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
        >
          View public privacy page
        </Link>
      </div>

      {wasUpdated ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          Privacy policy updated on site.
        </div>
      ) : null}

      <form action={savePrivacyPage} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <label className="block space-y-1 text-sm text-zinc-700">
          <span className="text-xs text-zinc-500">Page title</span>
          <input
            type="text"
            name="title"
            defaultValue={privacyPage.title}
            readOnly={!canWriteSeo}
            className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
          />
        </label>

        <label className="block space-y-1 text-sm text-zinc-700">
          <span className="text-xs text-zinc-500">HTML content</span>
          <textarea
            name="bodyHtml"
            defaultValue={privacyPage.bodyHtml}
            rows={20}
            readOnly={!canWriteSeo}
            className="w-full rounded border border-zinc-200 px-3 py-2 font-mono text-sm"
          />
        </label>

        {canWriteSeo ? (
          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              Save privacy page
            </button>
          </div>
        ) : (
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Read-only view</p>
        )}
      </form>
    </section>
  );
}
