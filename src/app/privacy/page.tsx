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
          className="
            max-w-none space-y-4 text-sm leading-relaxed text-zinc-700
            [&_p]:my-0
            [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:normal-case [&_h2]:tracking-tight [&_h2]:text-[rgb(114,112,111)]
            [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:normal-case [&_h3]:tracking-tight [&_h3]:text-[rgb(114,112,111)]
            [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6
            [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6
            [&_li]:my-1
            [&_strong]:font-semibold [&_strong]:text-zinc-900
            [&_a]:text-pink-500 [&_a]:underline-offset-2 hover:[&_a]:underline
          "
          dangerouslySetInnerHTML={{ __html: privacyPage.bodyHtml || "<p>Add privacy policy content in admin.</p>" }}
        />
      </div>
    </main>
  );
}
