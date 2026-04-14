import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { listAllBlogPosts } from "@/lib/blog";
import { OptimizedImageFileInput } from "@/components/OptimizedImageFileInput";
import { TextContentEditorField } from "@/app/admin/settings/pages/TextContentEditorField";
import { deleteBlogPostAction, saveBlogPostAction } from "./actions";
import { AdminSubmitButton } from "@/components/AdminSubmitButton";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function BlogImagePreview({ imageUrl }: { imageUrl: string | null }) {
  if (!imageUrl) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-500">Current cover image</p>
      <div
        className="h-40 w-full rounded-xl border border-zinc-200 bg-zinc-100 bg-cover bg-center"
        style={{ backgroundImage: `url("${imageUrl}")` }}
      />
    </div>
  );
}

function BlogPostCard({
  post,
  canWriteSeo,
}: {
  post: Awaited<ReturnType<typeof listAllBlogPosts>>[number];
  canWriteSeo: boolean;
}) {
  return (
    <details className="group rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Blog post</p>
          <p className="text-lg font-semibold text-zinc-900">{post.title}</p>
          <p className="text-xs text-zinc-500">
            Public URL: <span className="font-mono">/blog/{post.slug}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {post.status === "published" ? (
            <Link
              href={`/blog/${post.slug}`}
              target="_blank"
              className="rounded border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
            >
              View article
            </Link>
          ) : null}
          <span
            className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
              post.status === "published" ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"
            }`}
          >
            {post.status === "published" ? "Published" : "Draft"}
          </span>
          <span className="text-xs font-semibold text-zinc-500 transition group-open:rotate-180">▾</span>
        </div>
      </summary>

      <div className="border-t border-zinc-200 px-5 py-5">
        <form action={saveBlogPostAction} className="space-y-4">
          <input type="hidden" name="id" value={post.id} />
          <input type="hidden" name="coverImageUrl" value={post.coverImageUrl ?? ""} />

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm text-zinc-700">
              <span className="text-xs text-zinc-500">Blog title</span>
              <input
                type="text"
                name="title"
                defaultValue={post.title}
                readOnly={!canWriteSeo}
                className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1 text-sm text-zinc-700">
              <span className="text-xs text-zinc-500">Article URL</span>
              <input
                type="text"
                name="slug"
                defaultValue={post.slug}
                readOnly={!canWriteSeo}
                className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm text-zinc-700">
              <span className="text-xs text-zinc-500">Excerpt</span>
              <textarea
                name="excerpt"
                defaultValue={post.excerpt}
                rows={3}
                readOnly={!canWriteSeo}
                className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
              />
            </label>
            <div className="space-y-3">
              {canWriteSeo ? (
                <OptimizedImageFileInput
                  name="coverImageFile"
                  label="Cover image upload"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  maxWidth={2400}
                  maxHeight={2400}
                  quality={0.82}
                />
              ) : (
                <p className="text-xs text-zinc-500">Cover image</p>
              )}
              <BlogImagePreview imageUrl={post.coverImageUrl} />
              <label className="space-y-1 text-sm text-zinc-700">
                <span className="text-xs text-zinc-500">Cover image alt text</span>
                <input
                  type="text"
                  name="coverImageAlt"
                  defaultValue={post.coverImageAlt ?? ""}
                  readOnly={!canWriteSeo}
                  className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
                />
              </label>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-1 text-sm text-zinc-700">
              <span className="text-xs text-zinc-500">Status</span>
              <select
                name="status"
                defaultValue={post.status}
                disabled={!canWriteSeo}
                className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </label>
            <label className="space-y-1 text-sm text-zinc-700">
              <span className="text-xs text-zinc-500">Publish date/time</span>
              <input
                type="date"
                name="publishedAt"
                defaultValue={post.publishedAt ? post.publishedAt.slice(0, 10) : ""}
                readOnly={!canWriteSeo}
                className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1 text-sm text-zinc-700">
              <span className="text-xs text-zinc-500">Author</span>
              <input
                type="text"
                name="authorName"
                defaultValue={post.authorName ?? "Roc Candy"}
                readOnly={!canWriteSeo}
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
                defaultValue={post.seoTitle ?? ""}
                readOnly={!canWriteSeo}
                className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1 text-sm text-zinc-700">
              <span className="text-xs text-zinc-500">Canonical URL</span>
              <input
                type="text"
                name="canonicalUrl"
                defaultValue={post.canonicalUrl ?? ""}
                readOnly={!canWriteSeo}
                className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <label className="block space-y-1 text-sm text-zinc-700">
            <span className="text-xs text-zinc-500">Meta description</span>
            <textarea
              name="metaDescription"
              defaultValue={post.metaDescription ?? ""}
              rows={3}
              readOnly={!canWriteSeo}
              className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
            />
          </label>

          <label className="block space-y-1 text-sm text-zinc-700">
            <span className="text-xs text-zinc-500">Article body</span>
            <TextContentEditorField
              name="bodyText"
              defaultHtml={post.bodyHtml}
              rows={18}
              readOnly={!canWriteSeo}
              placeholder="Write the article body here."
            />
          </label>

          <div className="flex justify-end gap-2">
            {canWriteSeo ? (
              <>
                <button
                  formAction={deleteBlogPostAction}
                  className="rounded-md border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-300"
                >
                  Delete
                </button>
                <AdminSubmitButton
                  type="submit"
                  pendingLabel="Saving..."
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
                >
                  Save post
                </AdminSubmitButton>
              </>
            ) : (
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Read-only view</span>
            )}
          </div>
        </form>
      </div>
    </details>
  );
}

export default async function AdminBlogPostsPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/admin/login");
  }

  const canWriteSeo = session.user.canWriteSeo;
  const posts = await listAllBlogPosts();

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Admin / Content & SEO</p>
          <h1 className="admin-page-title text-zinc-900">Blog Posts</h1>
          <p className="max-w-3xl text-sm text-zinc-600">
            Create and publish simple monthly blog posts with a cover image, SEO fields, and rich text content.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="admin-section-title text-zinc-900">New Post</h2>
        <form action={saveBlogPostAction} className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm text-zinc-700">
              <span className="text-xs text-zinc-500">Blog title</span>
              <input type="text" name="title" readOnly={!canWriteSeo} className="w-full rounded border border-zinc-200 px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1 text-sm text-zinc-700">
              <span className="text-xs text-zinc-500">Article URL</span>
              <input type="text" name="slug" readOnly={!canWriteSeo} className="w-full rounded border border-zinc-200 px-3 py-2 text-sm" placeholder="Optional. Leave blank to generate from the title." />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm text-zinc-700">
              <span className="text-xs text-zinc-500">Excerpt</span>
              <textarea name="excerpt" rows={3} readOnly={!canWriteSeo} className="w-full rounded border border-zinc-200 px-3 py-2 text-sm" />
            </label>
            <div className="space-y-3">
              {canWriteSeo ? (
                <OptimizedImageFileInput
                  name="coverImageFile"
                  label="Cover image upload"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  maxWidth={2400}
                  maxHeight={2400}
                  quality={0.82}
                />
              ) : null}
              <label className="space-y-1 text-sm text-zinc-700">
                <span className="text-xs text-zinc-500">Cover image alt text</span>
                <input type="text" name="coverImageAlt" readOnly={!canWriteSeo} className="w-full rounded border border-zinc-200 px-3 py-2 text-sm" />
              </label>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-1 text-sm text-zinc-700">
              <span className="text-xs text-zinc-500">Status</span>
              <select name="status" defaultValue="draft" disabled={!canWriteSeo} className="w-full rounded border border-zinc-200 px-3 py-2 text-sm">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </label>
            <label className="space-y-1 text-sm text-zinc-700">
              <span className="text-xs text-zinc-500">Publish date/time</span>
              <input type="date" name="publishedAt" readOnly={!canWriteSeo} className="w-full rounded border border-zinc-200 px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1 text-sm text-zinc-700">
              <span className="text-xs text-zinc-500">Author</span>
              <input type="text" name="authorName" defaultValue="Roc Candy" readOnly={!canWriteSeo} className="w-full rounded border border-zinc-200 px-3 py-2 text-sm" />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm text-zinc-700">
              <span className="text-xs text-zinc-500">SEO title</span>
              <input type="text" name="seoTitle" readOnly={!canWriteSeo} className="w-full rounded border border-zinc-200 px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1 text-sm text-zinc-700">
              <span className="text-xs text-zinc-500">Canonical URL</span>
              <input type="text" name="canonicalUrl" readOnly={!canWriteSeo} className="w-full rounded border border-zinc-200 px-3 py-2 text-sm" />
            </label>
          </div>

          <label className="block space-y-1 text-sm text-zinc-700">
            <span className="text-xs text-zinc-500">Meta description</span>
            <textarea name="metaDescription" rows={3} readOnly={!canWriteSeo} className="w-full rounded border border-zinc-200 px-3 py-2 text-sm" />
          </label>

          <label className="block space-y-1 text-sm text-zinc-700">
            <span className="text-xs text-zinc-500">Article body</span>
            <TextContentEditorField
              name="bodyText"
              defaultHtml=""
              rows={18}
              readOnly={!canWriteSeo}
              placeholder="Write the article body here."
            />
          </label>

          <div className="flex justify-end">
            {canWriteSeo ? (
              <AdminSubmitButton
                type="submit"
                pendingLabel="Saving..."
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                Create post
              </AdminSubmitButton>
            ) : (
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Read-only view</span>
            )}
          </div>
        </form>
      </div>

      <div className="space-y-3">
        {posts.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-zinc-500">No blog posts yet.</p>
          </div>
        ) : (
          posts.map((post) => <BlogPostCard key={post.id} post={post} canWriteSeo={canWriteSeo} />)
        )}
      </div>
    </section>
  );
}
