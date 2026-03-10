import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { authOptions } from "@/lib/auth";
import { listSeoLibraryImages } from "@/lib/seoAssets";
import { listSiteRedirects } from "@/lib/siteRedirects";
import {
  buildManagedSitePageHref,
  EDITABLE_SITE_PAGE_SLUGS,
  getManagedSitePages,
} from "@/lib/sitePages";
import {
  deleteSiteRedirectAction,
  saveSiteRedirectAction,
  updateSitePageAction,
  uploadSeoLibraryImageAction,
} from "./actions";
import { HtmlEditorField } from "./HtmlEditorField";
import { SeoAdminWorkspace } from "./SeoAdminWorkspace";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function AdminSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{eyebrow}</p>
        <h2 className="text-2xl font-semibold text-zinc-900">{title}</h2>
        <p className="max-w-3xl text-sm text-zinc-600">{description}</p>
      </div>
      {children}
    </section>
  );
}

function EditorGuide() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
        <p className="font-semibold text-zinc-900">What this page edits</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Only real site pages already in the app.</li>
          <li>No page creation and no layout builder.</li>
          <li>Each page keeps its existing design and route.</li>
        </ul>
      </div>
      <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
        <p className="font-semibold text-zinc-900">SEO fields</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>`SEO title` is the browser/search title.</li>
          <li>`Meta description` is the search snippet text.</li>
          <li>`Social share image` is the preview image for links.</li>
        </ul>
      </div>
      <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
        <p className="font-semibold text-zinc-900">Visible page content</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>`On-page title` is the main page heading.</li>
          <li>`Page content` is the editable intro/body content.</li>
          <li>Extra content images can be inserted into the HTML body.</li>
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
<p><a href="/contact">Call to action link</a></p>`}
      </pre>
    </details>
  );
}

function ImagePreview({ imageUrl }: { imageUrl: string | null | undefined }) {
  if (!imageUrl) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-500">Current social share image</p>
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

function SeoLibrarySection({
  canWriteSeo,
  images,
}: {
  canWriteSeo: boolean;
  images: Awaited<ReturnType<typeof listSeoLibraryImages>>;
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-zinc-900">SEO Media Library</h2>
        <p className="text-sm text-zinc-600">
          Upload reusable images here for social previews or for inserting into page content with an image URL.
        </p>
      </div>

      {canWriteSeo ? (
        <form action={uploadSeoLibraryImageAction} className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm text-zinc-700">
            <span className="text-xs text-zinc-500">Upload image</span>
            <input type="file" name="libraryImageFile" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" className="block w-full text-sm" />
          </label>
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Upload to library
          </button>
        </form>
      ) : null}

      {images.length === 0 ? (
        <p className="text-sm text-zinc-500">No library images uploaded yet.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {images.map((image) => (
            <div key={image.path} className="rounded-xl border border-zinc-200 p-3">
              <div
                className="mb-3 h-32 w-full rounded-lg border border-zinc-200 bg-zinc-100 bg-cover bg-center"
                style={{ backgroundImage: `url("${image.publicUrl}")` }}
              />
              <p className="text-xs font-semibold text-zinc-900">{image.name}</p>
              <input
                readOnly
                value={image.publicUrl}
                className="mt-2 w-full rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RedirectsSection({
  canWriteSeo,
  redirects,
}: {
  canWriteSeo: boolean;
  redirects: Awaited<ReturnType<typeof listSiteRedirects>>;
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-zinc-900">Launch Redirects</h2>
        <p className="text-sm text-zinc-600">
          Use redirects to preserve old URLs when the new site goes live. This is for launch protection, not page editing.
        </p>
      </div>

      {canWriteSeo ? (
        <form action={saveSiteRedirectAction} className="grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 md:grid-cols-[1.4fr,1.6fr,120px,auto] md:items-end">
          <label className="space-y-1 text-sm text-zinc-700">
            <span className="text-xs text-zinc-500">Old URL path</span>
            <input
              type="text"
              name="sourcePath"
              placeholder="/product/wedding-candy"
              className="w-full rounded border border-zinc-200 bg-white px-3 py-2 text-sm font-mono"
            />
          </label>
          <label className="space-y-1 text-sm text-zinc-700">
            <span className="text-xs text-zinc-500">New destination</span>
            <input
              type="text"
              name="destinationPath"
              placeholder="/design/wedding-candy"
              className="w-full rounded border border-zinc-200 bg-white px-3 py-2 text-sm font-mono"
            />
          </label>
          <label className="space-y-1 text-sm text-zinc-700">
            <span className="text-xs text-zinc-500">Status</span>
            <select name="statusCode" defaultValue="301" className="w-full rounded border border-zinc-200 bg-white px-3 py-2 text-sm">
              <option value="301">301</option>
              <option value="302">302</option>
            </select>
          </label>
          <div className="space-y-3">
            <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
              <input type="checkbox" name="isActive" defaultChecked className="h-4 w-4" />
              Active
            </label>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              Save redirect
            </button>
          </div>
        </form>
      ) : null}

      {redirects.length === 0 ? (
        <p className="text-sm text-zinc-500">No redirects added yet.</p>
      ) : (
        <div className="space-y-3">
          {redirects.map((redirect) => (
            <div key={redirect.sourcePath} className="rounded-xl border border-zinc-200 p-4">
              <form action={saveSiteRedirectAction} className="grid gap-3 md:grid-cols-[1.2fr,1.4fr,120px,auto,auto] md:items-end">
                <label className="space-y-1 text-sm text-zinc-700">
                  <span className="text-xs text-zinc-500">Old URL path</span>
                  <input
                    type="text"
                    name="sourcePath"
                    defaultValue={redirect.sourcePath}
                    readOnly={!canWriteSeo}
                    className="w-full rounded border border-zinc-200 px-3 py-2 text-sm font-mono"
                  />
                </label>
                <label className="space-y-1 text-sm text-zinc-700">
                  <span className="text-xs text-zinc-500">New destination</span>
                  <input
                    type="text"
                    name="destinationPath"
                    defaultValue={redirect.destinationPath}
                    readOnly={!canWriteSeo}
                    className="w-full rounded border border-zinc-200 px-3 py-2 text-sm font-mono"
                  />
                </label>
                <label className="space-y-1 text-sm text-zinc-700">
                  <span className="text-xs text-zinc-500">Status</span>
                  <select
                    name="statusCode"
                    defaultValue={String(redirect.statusCode)}
                    disabled={!canWriteSeo}
                    className="w-full rounded border border-zinc-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="301">301</option>
                    <option value="302">302</option>
                  </select>
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-zinc-700 md:pb-2">
                  <input type="checkbox" name="isActive" defaultChecked={redirect.isActive} disabled={!canWriteSeo} className="h-4 w-4" />
                  Active
                </label>
                {canWriteSeo ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800"
                    >
                      Save
                    </button>
                  </div>
                ) : null}
              </form>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-zinc-500">
                  Updated: {redirect.updatedAt ? new Date(redirect.updatedAt).toLocaleString("en-AU") : "Not recorded"}
                </p>
                {canWriteSeo ? (
                  <form action={deleteSiteRedirectAction}>
                    <input type="hidden" name="sourcePath" value={redirect.sourcePath} />
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
          ))}
        </div>
      )}
    </div>
  );
}

function SitePageCard({
  page,
  canWriteSeo,
  defaultOpen = false,
}: {
  page: Awaited<ReturnType<typeof getManagedSitePages>>[number];
  canWriteSeo: boolean;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="group rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Site page</p>
          <p className="text-lg font-semibold text-zinc-900">{page.title}</p>
          <p className="text-xs text-zinc-500">
            Public URL: <span className="font-mono">{buildManagedSitePageHref(page.slug)}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={buildManagedSitePageHref(page.slug)}
            target="_blank"
            className="rounded border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
          >
            View page
          </Link>
          <span className="text-xs font-semibold text-zinc-500 transition group-open:rotate-180">▾</span>
        </div>
      </summary>

      <div className="border-t border-zinc-200 px-5 py-5">
        <form action={updateSitePageAction} className="space-y-4">
          <input type="hidden" name="slug" value={page.slug} />

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm text-zinc-700">
              <span className="text-xs text-zinc-500">On-page title (main heading)</span>
              <input
                type="text"
                name="title"
                defaultValue={page.title}
                readOnly={!canWriteSeo}
                className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
              />
            </label>
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
            <div className="space-y-3">
              <label className="space-y-1 text-sm text-zinc-700">
                <span className="text-xs text-zinc-500">Social share image</span>
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
            <div className="space-y-2">
              <label className="block space-y-1 text-sm text-zinc-700">
                <span className="text-xs text-zinc-500">Page content (HTML allowed)</span>
                <HtmlEditorField
                  name="bodyHtml"
                  defaultValue={page.bodyHtml}
                  rows={12}
                  readOnly={!canWriteSeo}
                  placeholder="<p>Start writing the page content here.</p>"
                />
              </label>
              <PageBodyHint />
            </div>
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
      </div>
    </details>
  );
}

export default async function AdminManagedPagesPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/admin/login");
  }

  const pages = await getManagedSitePages(EDITABLE_SITE_PAGE_SLUGS);
  const seoLibraryImages = await listSeoLibraryImages();
  const redirects = await listSiteRedirects();
  const canWriteSeo = session.user.canWriteSeo;

  const mainPages = pages.filter((page) =>
    ["home", "about", "faq", "design", "pre-made-candy"].includes(page.slug),
  );
  const landingPages = pages.filter((page) =>
    ["design/wedding-candy", "design/custom-text-candy", "design/branded-logo-candy", "contact", "shipping-and-returns"].includes(page.slug),
  );
  const policyPages = pages.filter((page) =>
    ["privacy", "terms-and-conditions"].includes(page.slug),
  );

  const overviewSection = (
    <AdminSection
      eyebrow="Overview"
      title="SEO Editor Guide"
      description="This screen edits the SEO fields and content for the site pages that already exist. It does not create new pages or change page layouts."
    >
      <EditorGuide />
    </AdminSection>
  );

  const pagesSection = (
    <AdminSection
      eyebrow="Pages"
      title="Site Pages"
      description="Edit the page title, visible content, metadata, and social image for the public pages on the site."
    >
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-zinc-900">Main Pages</h3>
            <p className="text-sm text-zinc-600">Core pages customers use most often.</p>
          </div>
          {mainPages.map((page, index) => (
            <SitePageCard key={page.slug} page={page} canWriteSeo={canWriteSeo} defaultOpen={index === 0} />
          ))}
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-zinc-900">Landing Pages</h3>
            <p className="text-sm text-zinc-600">Fixed marketing and SEO pages already linked from the site.</p>
          </div>
          {landingPages.map((page) => (
            <SitePageCard key={page.slug} page={page} canWriteSeo={canWriteSeo} />
          ))}
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-zinc-900">Policy Pages</h3>
            <p className="text-sm text-zinc-600">Legal and policy pages. Terms content itself is still managed in the terms editor.</p>
          </div>
          {policyPages.map((page) => (
            <SitePageCard key={page.slug} page={page} canWriteSeo={canWriteSeo} />
          ))}
        </div>
      </div>
    </AdminSection>
  );

  const redirectsSection = (
    <AdminSection
      eyebrow="Launch"
      title="Redirects"
      description="Use redirects to preserve old URLs during launch and migration."
    >
      <RedirectsSection canWriteSeo={canWriteSeo} redirects={redirects} />
    </AdminSection>
  );

  const mediaLibrarySection = (
    <AdminSection
      eyebrow="Assets"
      title="Media Library"
      description="Upload reusable images here for social previews and content blocks."
    >
      <SeoLibrarySection canWriteSeo={canWriteSeo} images={seoLibraryImages} />
    </AdminSection>
  );

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Admin / Site Settings</p>
          <h1 className="text-3xl font-semibold text-zinc-900">Site Pages & SEO</h1>
          <p className="max-w-3xl text-sm text-zinc-600">
            Edit the SEO and visible content of the pages already on the site. Layout and styling stay controlled by the app.
          </p>
        </div>
      </div>

      <SeoAdminWorkspace
        pageCount={pages.length}
        redirectCount={redirects.length}
        imageCount={seoLibraryImages.length}
        overview={overviewSection}
        pages={pagesSection}
        redirects={redirectsSection}
        mediaLibrary={mediaLibrarySection}
      />
    </section>
  );
}
