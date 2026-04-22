import { getSiteBaseUrl } from "@/lib/siteUrl";

export const dynamic = "force-static";

export async function GET() {
  const baseUrl = getSiteBaseUrl();
  const content = [
    "# Roc Candy",
    "",
    "> Handmade personalised rock candy in Australia for weddings, branded events, gifts, and celebrations.",
    "",
    `Site: ${baseUrl}`,
    `Sitemap: ${baseUrl}/sitemap.xml`,
    "",
    "Preferred public pages:",
    `- ${baseUrl}/`,
    `- ${baseUrl}/design`,
    `- ${baseUrl}/design/wedding-candy`,
    `- ${baseUrl}/design/custom-text-candy`,
    `- ${baseUrl}/design/branded-logo-candy`,
    `- ${baseUrl}/pre-made-candy`,
    `- ${baseUrl}/about`,
    `- ${baseUrl}/faqs`,
    `- ${baseUrl}/blog`,
    `- ${baseUrl}/contact`,
    "",
    "Notes:",
    "- Public storefront and marketing pages are the primary source of truth.",
    "- Admin, checkout internals, API endpoints, and docs pages are not public reference content.",
    "- Pre-made candy product pages contain the most specific product metadata.",
  ].join("\n");

  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
