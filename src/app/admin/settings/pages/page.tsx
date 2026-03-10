import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { buildManagedPageHref, getManagedPages } from "@/lib/managedPages";
import { createManagedPageAction, deleteManagedPageAction, updateManagedPageAction } from "./actions";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function PathHint() {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
      <p className="font-semibold text-zinc-900">Recommended uses</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>`design/wedding-candy`</li>
        <li>`design/branded-logo-candy`</li>
        <li>`design/custom-text-candy`</li>
        <li>`contact`</li>
        <li>`shipping-and-returns`</li>
        <li>`occasions/baby-shower`</li>
        <li>`sydney`</li>
      </ul>
      <p className="mt-3 text-xs text-zinc-500">
        Exact built-in routes like `about`, `faq`, `privacy`, `terms-and-conditions`, and `pre-made-candy` are
        reserved. Use this CMS for landing pages and SEO content pages.
      </p>
    </div>
  );
}

function SeoEditorHelp() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
        <p className="font-semibold text-zinc-900">Field guidance</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Keep the page path short, lowercase, and hyphenated.</li>
          <li>Use one clear on-page title as the H1.</li>
          <li>Aim for roughly 50-60 characters in the SEO title.</li>
          <li>Aim for roughly 140-160 characters in the meta description.</li>
        </ul>
      </div>
      <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
        <p className="font-semibold text-zinc-900">Images</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Use the image upload field for a social share image when possible.</li>
          <li>You can also paste a full URL or site-relative path such as `/quote/subtypes/branded.jpg`.</li>
          <li>Uploaded image URLs can be reused inside the page body HTML after the first save.</li>
        </ul>
      </div>
      <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
        <p className="font-semibold text-zinc-900">Body content</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>The body field supports HTML, including headings, paragraphs, lists, links, and images.</li>
          <li>Useful tags: `&lt;h2&gt;`, `&lt;p&gt;`, `&lt;ul&gt;`, `&lt;li&gt;`, `&lt;a&gt;`, `&lt;img&gt;`.</li>
          <li>Keep sections scannable and add FAQs near the bottom when relevant.</li>
        </ul>
      </div>
    </div>
  );
}

function PageBodyHint() {
  return (
    <details className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
      <summary className="cursor-pointer font-semibold text-zinc-900">Starter HTML example</summary>
      <pre className="mt-3 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
{`<p>Intro paragraph explaining the page topic and offer.</p>
<h2>Main section heading</h2>
<p>Supporting content paragraph.</p>
<ul>
  <li>Key point one</li>
  <li>Key point two</li>
</ul>
<h2>FAQ</h2>
<p><strong>Question?</strong><br />Answer.</p>`}
      </pre>
    </details>
  );
}

function ImagePreview({ imageUrl }: { imageUrl: string | null | undefined }) {
  if (!imageUrl) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-500">Current social image</p>
      <div
        className="h-40 w-full rounded-xl border border-zinc-200 bg-zinc-100 bg-cover bg-center"
        style={{ backgroundImage: `url("${imageUrl}")` }}
      />
      <a href={imageUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-zinc-600 underline-offset-2 hover:underline">
        Open image
      </a>
    </div>
  );
}

function ManagedPageCard({
  page,
  canWriteSeo,
}: {
  page: Awaited<ReturnType<typeof getManagedPages>>[number];
  canWriteSeo: boolean;
}) {
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Managed page</p>
          <p className="text-lg font-semibold text-zinc-900">{page.title}</p>
          <p className="text-xs text-zinc-500">
            Public URL: <span className="font-mono">{buildManagedPageHref(page.slugPath)}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={buildManagedPageHref(page.slugPath)}
            target="_blank"
            className="rounded border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
          >
            View page
          </Link>
          {canWriteSeo ? (
            <form action={deleteManagedPageAction}>
              <input type="hidden" name="id" value={page.id} />
              <input type="hidden" name="slugPath" value={page.slugPath} />
              <button
                type="submit"
                className="rounded border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </form>
          ) : null}
        </div>
      </div>
      <form action={updateManagedPageAction} className="space-y-4">
        <input type="hidden" name="id" value={page.id} />
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm text-zinc-700">
            <span className="text-xs text-zinc-500">Page path</span>
            <input
              type="text"
              name="slugPath"
              defaultValue={page.slugPath}
              readOnly={!canWriteSeo}
              className="w-full rounded border border-zinc-200 px-3 py-2 text-sm font-mono"
            />
          </label>
          <label className="space-y-1 text-sm text-zinc-700">
            <span className="text-xs text-zinc-500">On-page title (H1)</span>
            <input
              type="text"
              name="title"
              defaultValue={page.title}
              readOnly={!canWriteSeo}
              className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm text-zinc-700">
            <span className="text-xs text-zinc-500">SEO title ({(page.seoTitle ?? "").length} chars)</span>
            <input
              type="text"
              name="seoTitle"
              defaultValue={page.seoTitle ?? ""}
              readOnly={!canWriteSeo}
              className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1 text-sm text-zinc-700">
            <span className="text-xs text-zinc-500">Canonical URL (optional)</span>
            <input
              type="text"
              name="canonicalUrl"
              defaultValue={page.canonicalUrl ?? ""}
              readOnly={!canWriteSeo}
              className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm text-zinc-700">
            <span className="text-xs text-zinc-500">Meta description ({(page.metaDescription ?? "").length} chars)</span>
            <textarea
              name="metaDescription"
              defaultValue={page.metaDescription ?? ""}
              rows={3}
              readOnly={!canWriteSeo}
              className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
            />
          </label>
          <div className="space-y-3">
            <label className="space-y-1 text-sm text-zinc-700">
              <span className="text-xs text-zinc-500">Social share image URL</span>
              <input
                type="text"
                name="ogImageUrl"
                defaultValue={page.ogImageUrl ?? ""}
                readOnly={!canWriteSeo}
                className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
              />
            </label>
            {canWriteSeo ? (
              <label className="space-y-1 text-sm text-zinc-700">
                <span className="text-xs text-zinc-500">Upload new social image</span>
                <input type="file" name="ogImageFile" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" className="block w-full text-sm" />
              </label>
            ) : null}
            <ImagePreview imageUrl={page.ogImageUrl} />
          </div>
        </div>

        <div className="space-y-2">
          <label className="block space-y-1 text-sm text-zinc-700">
            <span className="text-xs text-zinc-500">Page body (HTML allowed)</span>
            <textarea
              name="bodyHtml"
              defaultValue={page.bodyHtml}
              rows={14}
              readOnly={!canWriteSeo}
              className="w-full rounded border border-zinc-200 px-3 py-2 font-mono text-sm"
            />
          </label>
          <PageBodyHint />
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
            <input type="checkbox" name="isPublished" defaultChecked={page.isPublished} disabled={!canWriteSeo} className="h-4 w-4" />
            Published on site
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
            <input type="checkbox" name="isIndexable" defaultChecked={page.isIndexable} disabled={!canWriteSeo} className="h-4 w-4" />
            Allow search engines to index
          </label>
        </div>

        {canWriteSeo ? (
          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              Save page
            </button>
          </div>
        ) : (
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Read-only view</p>
        )}
      </form>
    </article>
  );
}

export default async function AdminManagedPagesPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/admin/login");
  }

  const pages = await getManagedPages();
  const canWriteSeo = session.user.canWriteSeo;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Admin / Site Settings</p>
          <h1 className="text-3xl font-semibold text-zinc-900">Content & SEO Pages</h1>
          <p className="max-w-3xl text-sm text-zinc-600">
            Create landing pages, contact pages, city pages, and other SEO content without code. Each page has its
            own slug, body content, SEO title, meta description, canonical URL, social image, publish toggle, and
            index toggle.
          </p>
        </div>
      </div>

      <PathHint />
      <SeoEditorHelp />

      {canWriteSeo ? (
        <form action={createManagedPageAction} className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-zinc-900">Create a new page</p>
            <p className="text-xs text-zinc-500">
              New pages appear immediately at the path you choose. Use HTML in the body for headings, lists, links, and
              formatted content.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm text-zinc-700">
              <span className="text-xs text-zinc-500">Page path</span>
              <input
                type="text"
                name="slugPath"
                placeholder="design/wedding-candy"
                className="w-full rounded border border-zinc-200 px-3 py-2 text-sm font-mono"
              />
            </label>
            <label className="space-y-1 text-sm text-zinc-700">
              <span className="text-xs text-zinc-500">On-page title (H1)</span>
              <input
                type="text"
                name="title"
                placeholder="Wedding Candy"
                className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm text-zinc-700">
              <span className="text-xs text-zinc-500">SEO title</span>
              <input
                type="text"
                name="seoTitle"
                placeholder="Wedding Candy Australia | Personalised Wedding Rock Candy | Roc Candy"
                className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1 text-sm text-zinc-700">
              <span className="text-xs text-zinc-500">Canonical URL (optional)</span>
              <input
                type="text"
                name="canonicalUrl"
                placeholder="https://www.roccandy.com.au/design/wedding-candy"
                className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm text-zinc-700">
              <span className="text-xs text-zinc-500">Meta description</span>
              <textarea
                name="metaDescription"
                rows={3}
                placeholder="Create personalised wedding rock candy with names, initials, colours, and packaging for wedding favours."
                className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
              />
            </label>
            <div className="space-y-3">
              <label className="space-y-1 text-sm text-zinc-700">
                <span className="text-xs text-zinc-500">Social share image URL</span>
                <input
                  type="text"
                  name="ogImageUrl"
                  placeholder="/quote/subtypes/weddings-initials.jpg"
                  className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-1 text-sm text-zinc-700">
                <span className="text-xs text-zinc-500">Upload social image</span>
                <input type="file" name="ogImageFile" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" className="block w-full text-sm" />
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block space-y-1 text-sm text-zinc-700">
              <span className="text-xs text-zinc-500">Page body (HTML allowed)</span>
              <textarea
                name="bodyHtml"
                rows={12}
                placeholder="<p>Start writing the page content here.</p>"
                className="w-full rounded border border-zinc-200 px-3 py-2 font-mono text-sm"
              />
            </label>
            <PageBodyHint />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
              <input type="checkbox" name="isPublished" defaultChecked className="h-4 w-4" />
              Published on site
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
              <input type="checkbox" name="isIndexable" defaultChecked className="h-4 w-4" />
              Allow search engines to index
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              Create page
            </button>
          </div>
        </form>
      ) : (
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-600">
          This user can view SEO pages here but cannot create new ones.
        </div>
      )}

      <div className="space-y-4">
        {pages.map((page) => (
          <ManagedPageCard key={page.id} page={page} canWriteSeo={canWriteSeo} />
        ))}
      </div>
    </section>
  );
}
