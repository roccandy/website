export default function LoadingSitePagesSeo() {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Admin / Content & SEO</p>
        <h1 className="admin-page-title text-zinc-900">Loading Site Pages &amp; SEO</h1>
        <p className="text-sm text-zinc-600">Fetching page data, product SEO, and redirect rows.</p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 text-sm text-zinc-600">
          <svg
            aria-hidden="true"
            className="h-5 w-5 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="9" className="opacity-25" />
            <path d="M21 12a9 9 0 0 0-9-9" className="opacity-90" />
          </svg>
          <span>Opening Site Pages &amp; SEO...</span>
        </div>
      </div>
    </section>
  );
}
