import { stat } from "fs/promises";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { join } from "path";
import type { ReactNode } from "react";
import { authOptions } from "@/lib/auth";
import { getPremadeCandies } from "@/lib/data";
import { getManagedFaqItems } from "@/lib/faqs";
import { buildPremadeImageUrl, buildPremadeItemPath } from "@/lib/premadeCatalog";
import { listSiteRedirects, type SiteRedirect } from "@/lib/siteRedirects";
import { listBucketObjectInfo } from "@/lib/storageObjects";
import {
  buildManagedSitePageHref,
  EDITABLE_SITE_PAGE_SLUGS,
  getManagedSitePages,
  HERO_INTRO_SITE_PAGE_SLUGS,
  HERO_ONLY_SITE_PAGE_SLUGS,
  LANDING_GALLERY_PAGE_SLUGS,
} from "@/lib/sitePages";
import {
  createPageFaqAction,
  deleteSiteRedirectAction,
  updatePremadeSeoAction,
  saveSiteRedirectAction,
  updateSitePageAction,
} from "./actions";
import { OptimizedImageFileInput } from "@/components/OptimizedImageFileInput";
import { LandingGalleryPicker } from "./LandingGalleryPicker";
import { SeoAdminWorkspace } from "./SeoAdminWorkspace";
import { TextContentEditorField } from "./TextContentEditorField";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type BuiltInRedirect = {
  sourcePath: string;
  destinationPath: string;
  statusCode: 301 | 302 | 307 | 308;
  notes: string;
};

const BUILT_IN_REDIRECTS: BuiltInRedirect[] = [
  {
    sourcePath: "/faq",
    destinationPath: "/faqs",
    statusCode: 307,
    notes: "Legacy short FAQ path handled directly in the app route.",
  },
  {
    sourcePath: "/premade",
    destinationPath: "/pre-made-candy",
    statusCode: 307,
    notes: "Legacy pre-made collection path handled directly in the app route.",
  },
  {
    sourcePath: "/quote",
    destinationPath: "/design",
    statusCode: 307,
    notes: "Legacy designer entry path handled directly in the app route.",
  },
  {
    sourcePath: "/pre-made-candy/:id--:slug",
    destinationPath: "/pre-made-candy/:slug",
    statusCode: 308,
    notes: "Legacy ID-based pre-made URLs are normalized to the new canonical slug path.",
  },
  {
    sourcePath: "/design?legacy-query",
    destinationPath: "/design",
    statusCode: 307,
    notes: "Old designer query formats are normalized to the current canonical query format.",
  },
];

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
        <h2 className="admin-section-title text-zinc-900">{title}</h2>
        <p className="max-w-3xl text-sm text-zinc-600">{description}</p>
      </div>
      {children}
    </section>
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
    </div>
  );
}

function LandingGalleryEditor({
  slug,
  images,
  readOnly,
}: {
  slug: string;
  images: Array<{
    url: string;
    sizeBytes: number | null;
  }>;
  readOnly: boolean;
}) {
  return <LandingGalleryPicker slug={slug} initialImages={images} readOnly={readOnly} />;
}

const SEO_IMAGE_PUBLIC_PATH_SEGMENT = "/storage/v1/object/public/seo-images/";

function extractSeoImagePathFromUrl(imageUrl: string) {
  try {
    const resolved = new URL(imageUrl);
    const index = resolved.pathname.indexOf(SEO_IMAGE_PUBLIC_PATH_SEGMENT);
    if (index === -1) return null;
    return decodeURIComponent(resolved.pathname.slice(index + SEO_IMAGE_PUBLIC_PATH_SEGMENT.length));
  } catch {
    return null;
  }
}

async function resolveGalleryImageSizeBytes(
  imageUrl: string,
  seoImageSizeByPath: Map<string, number | null>
): Promise<number | null> {
  if (!imageUrl) return null;

  if (imageUrl.startsWith("/")) {
    try {
      const info = await stat(join(process.cwd(), "public", imageUrl.replace(/^\/+/, "")));
      return info.size;
    } catch {
      return null;
    }
  }

  const seoImagePath = extractSeoImagePathFromUrl(imageUrl);
  if (!seoImagePath) return null;
  return seoImageSizeByPath.get(seoImagePath) ?? null;
}

function PageFaqSelector({
  pageSlug,
  selectedIds,
  faqHeading,
  faqItems,
  readOnly,
  createFaqFormId,
}: {
  pageSlug: string;
  selectedIds: string[];
  faqHeading: string | null;
  faqItems: Awaited<ReturnType<typeof getManagedFaqItems>>;
  readOnly: boolean;
  createFaqFormId?: string;
}) {
  if (pageSlug === "faq" || pageSlug === "terms-and-conditions") {
    return null;
  }

  const selectedCount = selectedIds.length;

  return (
    <details className="rounded-xl border border-zinc-200 bg-zinc-50">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <div className="space-y-1">
          <h3 className="admin-card-title text-zinc-900">Page FAQs</h3>
          <p className="text-xs text-zinc-600">
            {selectedCount === 0 ? "No FAQs selected" : `${selectedCount} selected`}
          </p>
        </div>
        <span className="text-xs font-semibold text-zinc-500">▾</span>
      </summary>

      <div className="space-y-4 border-t border-zinc-200 px-4 py-4">
        <p className="text-sm text-zinc-600">
          Choose which FAQ library items appear at the bottom of this page. Edit the master FAQ content in{" "}
          <Link href="/admin/settings/faqs" className="font-semibold text-[#ff6f95] hover:text-[#ff4f80]">
            FAQ Settings
          </Link>
          .
        </p>

        <label className="block space-y-1 text-sm text-zinc-700">
          <span className="text-xs text-zinc-500">FAQ section heading (optional)</span>
          <input
            type="text"
            name="faqHeading"
            defaultValue={faqHeading ?? ""}
            readOnly={readOnly}
            placeholder="Common Questions"
            className="w-full rounded border border-zinc-200 bg-white px-3 py-2 text-sm"
          />
        </label>

        {!readOnly && createFaqFormId ? (
          <details className="rounded-lg border border-zinc-200 bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-zinc-900">Create a page FAQ</p>
                <p className="text-xs text-zinc-500">Adds it to this page and to the master FAQ library, hidden from the main FAQ page by default.</p>
              </div>
              <span className="text-xs font-semibold text-zinc-500">▾</span>
            </summary>
            <div className="border-t border-zinc-200 px-4 py-4">
              <div className="space-y-3">
                <input type="hidden" form={createFaqFormId} name="pageSlug" value={pageSlug} />
                <label className="block space-y-1 text-sm text-zinc-700">
                  <span className="text-xs text-zinc-500">New question</span>
                  <input
                    type="text"
                    form={createFaqFormId}
                    name="question"
                    placeholder="Type the FAQ question"
                    className="w-full rounded border border-zinc-200 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="block space-y-1 text-sm text-zinc-700">
                  <span className="text-xs text-zinc-500">New answer</span>
                  <TextContentEditorField
                    name="answerText"
                    defaultHtml=""
                    rows={5}
                    placeholder="Type the FAQ answer"
                    form={createFaqFormId}
                  />
                </label>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    form={createFaqFormId}
                    className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
                  >
                    Create FAQ
                  </button>
                </div>
              </div>
            </div>
          </details>
        ) : null}

        {faqItems.length === 0 ? (
          <p className="text-sm text-zinc-500">No FAQ items are available yet. Add them in FAQ Settings first.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {faqItems.map((item) => {
              const checked = selectedIds.includes(item.id);
              return (
                <label
                  key={item.id}
                  className={`rounded-lg border px-3 py-3 text-sm ${
                    checked ? "border-[#ffb0c7] bg-white" : "border-zinc-200 bg-white"
                  } ${readOnly ? "opacity-75" : ""}`}
                >
                  <span className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      name="faqItemIds"
                      value={item.id}
                      defaultChecked={checked}
                      disabled={readOnly}
                      className="mt-1 h-4 w-4"
                    />
                    <span className="space-y-1">
                      <span className="block font-semibold text-zinc-900">{item.question}</span>
                      <span className="block text-xs text-zinc-500">Library item</span>
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </details>
  );
}

function normalizePlainTextFromHtml(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function SitePageCard({
  page,
  canWriteSeo,
  faqItems,
  imageSizeBytesByUrl,
}: {
  page: Awaited<ReturnType<typeof getManagedSitePages>>[number];
  canWriteSeo: boolean;
  faqItems: Awaited<ReturnType<typeof getManagedFaqItems>>;
  imageSizeBytesByUrl: Map<string, number | null>;
}) {
  const hasLandingGallery = LANDING_GALLERY_PAGE_SLUGS.includes(
    page.slug as (typeof LANDING_GALLERY_PAGE_SLUGS)[number],
  );
  const usesHeroIntroFields = HERO_INTRO_SITE_PAGE_SLUGS.includes(
    page.slug as (typeof HERO_INTRO_SITE_PAGE_SLUGS)[number],
  );
  const hidesBodyContentEditor = HERO_ONLY_SITE_PAGE_SLUGS.includes(
    page.slug as (typeof HERO_ONLY_SITE_PAGE_SLUGS)[number],
  );
  const isTermsPage = page.slug === "terms-and-conditions";
  const derivedHeroSupportingLine =
    page.heroSupportingLine?.trim() || (hidesBodyContentEditor ? normalizePlainTextFromHtml(page.bodyHtml) : "");
  const landingGalleryImages = page.galleryImageUrls.map((url) => ({
    url,
    sizeBytes: imageSizeBytesByUrl.get(url) ?? null,
  }));
  const createFaqFormId = `create-page-faq-${page.slug.replace(/[^a-z0-9_-]/gi, "-")}`;

  return (
    <details className="group rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Site page</p>
          <p className="text-lg font-semibold text-zinc-900">{page.title}</p>
          <p className="text-xs text-zinc-500">
            Public URL: <span className="font-mono">{buildManagedSitePageHref(page.slug)}</span>
          </p>
          {isTermsPage ? (
            <p className="text-xs text-amber-700">
              This card only controls the Terms page SEO fields and page title. The actual Terms and Conditions body content is edited in the separate Terms editor.
            </p>
          ) : null}
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
              <span className="text-xs text-zinc-500">On-page title (H1)</span>
              <input
                type="text"
                name="title"
                defaultValue={page.title}
                readOnly={!canWriteSeo}
                className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1 text-sm text-zinc-700">
              <span className="text-xs text-zinc-500">SEO title (&lt;title&gt;, {(page.seoTitle ?? "").length} chars)</span>
              <input
                type="text"
                name="seoTitle"
                defaultValue={page.seoTitle ?? ""}
                readOnly={!canWriteSeo}
                className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
              />
            </label>
          </div>

          {usesHeroIntroFields ? (
            <div className="grid gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 md:grid-cols-2">
              <label className="space-y-1 text-sm text-zinc-700">
                <span className="text-xs text-zinc-500">Hero subheading (H2)</span>
                <input
                  type="text"
                  name="heroSubheading"
                  defaultValue={page.heroSubheading ?? ""}
                  readOnly={!canWriteSeo}
                  className="w-full rounded border border-zinc-200 bg-white px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-1 text-sm text-zinc-700">
                <span className="text-xs text-zinc-500">Hero supporting line (paragraph)</span>
                <textarea
                  name="heroSupportingLine"
                  defaultValue={derivedHeroSupportingLine}
                  rows={3}
                  readOnly={!canWriteSeo}
                  className="w-full rounded border border-zinc-200 bg-white px-3 py-2 text-sm"
                />
              </label>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm text-zinc-700">
              <span className="text-xs text-zinc-500">Meta description (meta description, {(page.metaDescription ?? "").length} chars)</span>
              <textarea
                name="metaDescription"
                defaultValue={page.metaDescription ?? ""}
                rows={3}
                readOnly={!canWriteSeo}
                className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1 text-sm text-zinc-700">
              <span className="text-xs text-zinc-500">Canonical URL (canonical, optional)</span>
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
              <input type="hidden" name="ogImageUrl" value={page.ogImageUrl ?? ""} readOnly />
              {canWriteSeo ? (
                <OptimizedImageFileInput
                  name="ogImageFile"
                  label="Social share image upload (og:image)"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  maxWidth={2400}
                  maxHeight={2400}
                  quality={0.82}
                />
              ) : (
                <p className="text-xs text-zinc-500">Social share image (og:image)</p>
              )}
              <ImagePreview imageUrl={page.ogImageUrl} />
            </div>
            <div className="space-y-2">
              {isTermsPage ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-semibold">Terms content is not edited here.</p>
                  <p className="mt-1 text-xs leading-relaxed text-amber-800">
                    Use this card for the page title, SEO title, meta description, canonical URL, and social share image only.
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-amber-800">
                    To edit the actual Terms and Conditions text shown on the website, go to <span className="font-semibold">Admin / Settings / Terms</span>.
                  </p>
                </div>
              ) : hidesBodyContentEditor ? (
                <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
                  <p className="font-semibold">This page does not use a separate body content block.</p>
                  <p className="mt-1 text-xs leading-relaxed text-sky-800">
                    Use the <span className="font-semibold">Hero subheading</span> and <span className="font-semibold">Hero supporting line</span> fields above for the visible intro text. The pre-made collection page goes straight from the hero into the product grid and FAQs.
                  </p>
                </div>
              ) : (
                <>
                  <label className="block space-y-1 text-sm text-zinc-700">
                    <span className="text-xs text-zinc-500">Page content</span>
                    <TextContentEditorField
                      name="bodyText"
                      defaultHtml={page.bodyHtml}
                      rows={12}
                      readOnly={!canWriteSeo}
                      placeholder="Write the page content here."
                    />
                  </label>
                </>
              )}
            </div>
          </div>

          {hasLandingGallery ? (
            <details className="rounded-xl border border-zinc-200 bg-zinc-50">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                <div className="space-y-1">
                  <h3 className="admin-card-title text-zinc-900">Landing page mini gallery</h3>
                  <p className="text-xs text-zinc-600">
                    {page.galleryImageUrls.length === 0 ? "No gallery images" : `${page.galleryImageUrls.length} images`}
                  </p>
                </div>
                <span className="text-xs font-semibold text-zinc-500">▾</span>
              </summary>

              <div className="border-t border-zinc-200 px-4 py-4">
                <LandingGalleryEditor
                  slug={page.slug}
                  images={landingGalleryImages}
                  readOnly={!canWriteSeo}
                />
              </div>
            </details>
          ) : null}

          <PageFaqSelector
            pageSlug={page.slug}
            selectedIds={page.faqItemIds}
            faqHeading={page.faqHeading}
            faqItems={faqItems}
            readOnly={!canWriteSeo}
            createFaqFormId={createFaqFormId}
          />

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
        <form id={createFaqFormId} action={createPageFaqAction} className="hidden" />
      </div>
    </details>
  );
}

function PremadeSeoCard({
  item,
  canWriteSeo,
}: {
  item: Awaited<ReturnType<typeof getPremadeCandies>>[number];
  canWriteSeo: boolean;
}) {
  const pagePath = buildPremadeItemPath(item);
  const fallbackImageUrl = buildPremadeImageUrl(item.image_path);
  const socialImageUrl = item.og_image_url?.trim() || null;

  return (
    <details className="group rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Pre-made product</p>
          <p className="text-lg font-semibold text-zinc-900">{item.name}</p>
          <p className="text-xs text-zinc-500">
            Public URL: <span className="font-mono">{pagePath}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={pagePath}
            target="_blank"
            className="rounded border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
          >
            View product
          </Link>
          <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${item.is_active ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}>
            {item.is_active ? "Active" : "Inactive"}
          </span>
          <span className="text-xs font-semibold text-zinc-500 transition group-open:rotate-180">▾</span>
        </div>
      </summary>

      <div className="border-t border-zinc-200 px-5 py-5">
        <form action={updatePremadeSeoAction} className="space-y-4">
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="pagePath" value={pagePath} />

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm text-zinc-700">
              <span className="text-xs text-zinc-500">Product URL</span>
              <input
                type="text"
                name="slug"
                defaultValue={item.slug ?? ""}
                readOnly={!canWriteSeo}
                className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
                placeholder="oh-boy-baby-boy-rock-candy"
              />
              <span className="block text-xs text-zinc-500">Visible as /pre-made-candy/your-product-slug</span>
            </label>
            <label className="space-y-1 text-sm text-zinc-700">
              <span className="text-xs text-zinc-500">SEO title (&lt;title&gt;)</span>
              <input
                type="text"
                name="seoTitle"
                defaultValue={item.seo_title ?? ""}
                readOnly={!canWriteSeo}
                className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
                placeholder={`${item.name} | Pre-Made Rock Candy | Roc Candy`}
              />
            </label>
            <label className="space-y-1 text-sm text-zinc-700">
              <span className="text-xs text-zinc-500">Canonical URL (optional)</span>
              <input
                type="text"
                name="canonicalUrl"
                defaultValue={item.canonical_url ?? ""}
                readOnly={!canWriteSeo}
                className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
                placeholder={pagePath}
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm text-zinc-700">
              <span className="text-xs text-zinc-500">Meta description</span>
              <textarea
                name="metaDescription"
                defaultValue={item.meta_description ?? ""}
                rows={3}
                readOnly={!canWriteSeo}
                className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
                placeholder={item.short_description ?? item.description ?? ""}
              />
            </label>
            <div className="space-y-3">
              <input type="hidden" name="ogImageUrl" value={socialImageUrl ?? ""} readOnly />
              {canWriteSeo ? (
                <OptimizedImageFileInput
                  name="ogImageFile"
                  label="Social share image upload (og:image)"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  maxWidth={2400}
                  maxHeight={2400}
                  quality={0.82}
                />
              ) : (
                <p className="text-xs text-zinc-500">Social share image (og:image)</p>
              )}
              <ImagePreview imageUrl={socialImageUrl || fallbackImageUrl} />
              {!socialImageUrl ? (
                <p className="text-xs text-zinc-500">Default preview uses the product image unless you upload a dedicated social image.</p>
              ) : null}
            </div>
          </div>

          {canWriteSeo ? (
            <div className="flex justify-end">
              <button
                type="submit"
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                Save product SEO
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

function RedirectEditorCard({
  redirect,
  canWriteSeo,
}: {
  redirect: SiteRedirect;
  canWriteSeo: boolean;
}) {
  return (
    <form action={saveSiteRedirectAction} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="grid gap-4 md:grid-cols-[1fr_1fr_120px_auto_auto] md:items-end">
        <label className="space-y-1 text-sm text-zinc-700">
          <span className="text-xs text-zinc-500">From</span>
          <input
            type="text"
            name="sourcePath"
            defaultValue={redirect.sourcePath}
            readOnly={!canWriteSeo}
            className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1 text-sm text-zinc-700">
          <span className="text-xs text-zinc-500">To</span>
          <input
            type="text"
            name="destinationPath"
            defaultValue={redirect.destinationPath}
            readOnly={!canWriteSeo}
            className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1 text-sm text-zinc-700">
          <span className="text-xs text-zinc-500">Status</span>
          <select
            name="statusCode"
            defaultValue={String(redirect.statusCode)}
            disabled={!canWriteSeo}
            className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
          >
            <option value="301">301</option>
            <option value="302">302</option>
          </select>
        </label>
        <label className="inline-flex items-center gap-2 rounded border border-zinc-200 px-3 py-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={redirect.isActive}
            disabled={!canWriteSeo}
            className="h-4 w-4"
          />
          Active
        </label>
        <div className="flex gap-2">
          {canWriteSeo ? (
            <>
              <button
                type="submit"
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                Save
              </button>
              <button
                formAction={deleteSiteRedirectAction}
                className="rounded-md border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-300"
              >
                Delete
              </button>
            </>
          ) : (
            <span className="rounded-md border border-zinc-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Read-only
            </span>
          )}
        </div>
      </div>
    </form>
  );
}

function BuiltInRedirectCard({ redirect }: { redirect: BuiltInRedirect }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-4 shadow-sm">
      <div className="grid gap-4 md:grid-cols-[1fr_1fr_120px_auto] md:items-end">
        <label className="space-y-1 text-sm text-zinc-700">
          <span className="text-xs text-zinc-500">From</span>
          <input
            type="text"
            value={redirect.sourcePath}
            readOnly
            className="w-full rounded border border-zinc-200 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1 text-sm text-zinc-700">
          <span className="text-xs text-zinc-500">To</span>
          <input
            type="text"
            value={redirect.destinationPath}
            readOnly
            className="w-full rounded border border-zinc-200 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1 text-sm text-zinc-700">
          <span className="text-xs text-zinc-500">Status</span>
          <input
            type="text"
            value={String(redirect.statusCode)}
            readOnly
            className="w-full rounded border border-zinc-200 bg-white px-3 py-2 text-sm"
          />
        </label>
        <div className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Code-managed
        </div>
      </div>
      <p className="mt-3 text-xs text-zinc-500">{redirect.notes}</p>
    </div>
  );
}

export default async function AdminManagedPagesPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/admin/login");
  }

  const pages = await getManagedSitePages(EDITABLE_SITE_PAGE_SLUGS);
  const faqItems = await getManagedFaqItems();
  const premadeProducts = await getPremadeCandies();
  const redirects = await listSiteRedirects();
  const builtInRedirects = BUILT_IN_REDIRECTS;
  const canWriteSeo = session.user.canWriteSeo;
  const galleryImageUrls = Array.from(
    new Set(
      pages
        .filter((page) =>
          LANDING_GALLERY_PAGE_SLUGS.includes(page.slug as (typeof LANDING_GALLERY_PAGE_SLUGS)[number])
        )
        .flatMap((page) => page.galleryImageUrls)
        .filter(Boolean)
    )
  );
  let seoImageSizeByPath = new Map<string, number | null>();
  try {
    const seoImageObjects = await listBucketObjectInfo("seo-images");
    seoImageSizeByPath = new Map(seoImageObjects.map((item) => [item.path, item.sizeBytes]));
  } catch {
    seoImageSizeByPath = new Map();
  }
  const imageSizeEntries = await Promise.all(
    galleryImageUrls.map(async (imageUrl) => [
      imageUrl,
      await resolveGalleryImageSizeBytes(imageUrl, seoImageSizeByPath),
    ] as const)
  );
  const imageSizeBytesByUrl = new Map(imageSizeEntries);

  const mainPages = pages.filter((page) =>
    ["home", "about", "faq", "blog", "design", "pre-made-candy"].includes(page.slug),
  );
  const landingPages = pages.filter((page) =>
    ["design/wedding-candy", "design/custom-text-candy", "design/branded-logo-candy", "contact", "shipping-and-returns"].includes(page.slug),
  );
  const policyPages = pages.filter((page) =>
    ["privacy", "terms-and-conditions"].includes(page.slug),
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
            <h3 className="admin-subsection-title text-zinc-900">Main Pages</h3>
            <p className="text-sm text-zinc-600">Core pages customers use most often.</p>
          </div>
          {mainPages.map((page) => (
            <SitePageCard
              key={page.slug}
              page={page}
              canWriteSeo={canWriteSeo}
              faqItems={faqItems}
              imageSizeBytesByUrl={imageSizeBytesByUrl}
            />
          ))}
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <h3 className="admin-subsection-title text-zinc-900">Landing Pages</h3>
            <p className="text-sm text-zinc-600">Fixed marketing and SEO pages already linked from the site.</p>
          </div>
          {landingPages.map((page) => (
            <SitePageCard
              key={page.slug}
              page={page}
              canWriteSeo={canWriteSeo}
              faqItems={faqItems}
              imageSizeBytesByUrl={imageSizeBytesByUrl}
            />
          ))}
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <h3 className="admin-subsection-title text-zinc-900">Policy Pages</h3>
            <p className="text-sm text-zinc-600">
              Legal and policy pages. Privacy content is editable here. For Terms and Conditions, this screen only edits the page title and SEO metadata. The actual terms body text still lives in the separate Terms editor.
            </p>
          </div>
          {policyPages.map((page) => (
            <SitePageCard
              key={page.slug}
              page={page}
              canWriteSeo={canWriteSeo}
              faqItems={faqItems}
              imageSizeBytesByUrl={imageSizeBytesByUrl}
            />
          ))}
        </div>
      </div>
    </AdminSection>
  );

  const premadeProductsSection = (
    <AdminSection
      eyebrow="Products"
      title="Pre-Made Product SEO"
      description="Edit SEO metadata for individual pre-made product pages without opening the full product admin."
    >
      {premadeProducts.length === 0 ? (
        <p className="text-sm text-zinc-500">No pre-made products found.</p>
      ) : (
        <div className="space-y-3">
          {premadeProducts.map((item) => (
            <PremadeSeoCard key={item.id} item={item} canWriteSeo={canWriteSeo} />
          ))}
        </div>
      )}
    </AdminSection>
  );

  const redirectsSection = (
    <AdminSection
      eyebrow="Redirects"
      title="301 Redirects"
      description="Map old public URLs to their new destinations. These redirects are enforced by middleware and existing rows are loaded directly from the live redirect table."
    >
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="admin-subsection-title text-zinc-900">Add a redirect</h3>
        <p className="mt-1 text-sm text-zinc-600">
          Use old site paths like <span className="font-mono">/product/wedding-candy</span> and point them to their new public path.
        </p>
        <form action={saveSiteRedirectAction} className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_120px_auto_auto] md:items-end">
          <label className="space-y-1 text-sm text-zinc-700">
            <span className="text-xs text-zinc-500">From</span>
            <input
              type="text"
              name="sourcePath"
              placeholder="/product/wedding-candy"
              readOnly={!canWriteSeo}
              className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1 text-sm text-zinc-700">
            <span className="text-xs text-zinc-500">To</span>
            <input
              type="text"
              name="destinationPath"
              placeholder="/design/wedding-candy"
              readOnly={!canWriteSeo}
              className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1 text-sm text-zinc-700">
            <span className="text-xs text-zinc-500">Status</span>
            <select
              name="statusCode"
              defaultValue="301"
              disabled={!canWriteSeo}
              className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
            >
              <option value="301">301</option>
              <option value="302">302</option>
            </select>
          </label>
          <label className="inline-flex items-center gap-2 rounded border border-zinc-200 px-3 py-2 text-sm text-zinc-700">
            <input type="checkbox" name="isActive" defaultChecked className="h-4 w-4" disabled={!canWriteSeo} />
            Active
          </label>
          <div className="flex gap-2">
            {canWriteSeo ? (
              <button
                type="submit"
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                Save redirect
              </button>
            ) : (
              <span className="rounded-md border border-zinc-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Read-only
              </span>
            )}
          </div>
        </form>
      </div>

      {redirects.length === 0 ? (
        <p className="text-sm text-zinc-500">No redirects saved yet.</p>
      ) : (
        <div className="space-y-3">
          {redirects.map((redirect) => (
            <RedirectEditorCard key={redirect.sourcePath} redirect={redirect} canWriteSeo={canWriteSeo} />
          ))}
        </div>
      )}

      <div className="space-y-3">
        <div className="space-y-1">
          <h3 className="admin-subsection-title text-zinc-900">Built-In Redirects</h3>
          <p className="text-sm text-zinc-600">
            These redirects are already enforced in code. They are shown here so the full redirect picture is visible in one place, but they are not edited from admin.
          </p>
        </div>
        <div className="space-y-3">
          {builtInRedirects.map((redirect) => (
            <BuiltInRedirectCard key={redirect.sourcePath} redirect={redirect} />
          ))}
        </div>
      </div>
    </AdminSection>
  );

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Admin / Site Settings</p>
          <h1 className="admin-page-title text-zinc-900">Site Pages & SEO</h1>
          <p className="max-w-3xl text-sm text-zinc-600">
            Edit the SEO and visible content of the pages already on the site. Layout and styling stay controlled by the app.
          </p>
        </div>
      </div>

      <SeoAdminWorkspace
        pageCount={pages.length}
        productCount={premadeProducts.length}
        redirectCount={redirects.length + builtInRedirects.length}
        pages={pagesSection}
        productPages={premadeProductsSection}
        redirects={redirectsSection}
      />
    </section>
  );
}
