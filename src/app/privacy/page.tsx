import { getManagedSitePage } from "@/lib/sitePages";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function PrivacyPage() {
  const privacyPage = await getManagedSitePage("privacy");

  return (
    <main className="min-h-[60vh] bg-white px-6 py-12 text-zinc-900">
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="normal-case text-4xl font-semibold tracking-tight text-[rgb(114,112,111)]">
          {privacyPage.title || "Privacy Policy"}
        </h1>
        <article
          className="prose prose-zinc max-w-none text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: privacyPage.bodyHtml || "<p>Add privacy policy content in admin.</p>" }}
        />
      </div>
    </main>
  );
}
