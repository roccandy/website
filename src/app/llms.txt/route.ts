import { getSiteBaseUrl } from "@/lib/siteUrl";

export const dynamic = "force-static";

export async function GET() {
  const baseUrl = getSiteBaseUrl();
  const content = [
    "# Roc Candy",
    "",
    "> Roc Candy is an Australian artisan confectionery business, established in 1999, creating handmade personalised rock candy for weddings, branded events, gifts and celebrations.",
    "",
    `Site: ${baseUrl}`,
    `Sitemap: ${baseUrl}/sitemap.xml`,
    "",
    "## Products and ordering",
    `- [Design your candy](${baseUrl}/design): Use the online designer for personalised candy; choose a style, colours, flavours and packaging.`,
    `- [Wedding candy](${baseUrl}/design/wedding-candy): Personalised candy with names or initials for wedding favours, bonbonniere and table styling.`,
    `- [Branded logo candy](${baseUrl}/design/branded-logo-candy): Custom logo candy for corporate events, campaigns, client gifts and promotions.`,
    `- [Custom text candy](${baseUrl}/design/custom-text-candy): Personalised candy with names, initials or custom wording for gifts and celebrations.`,
    `- [Custom candy orders](${baseUrl}/custom-orders): The assisted route for customers with an idea, special requirements, artwork, timing questions or a need for order advice.`,
    `- [Pre-made candy](${baseUrl}/pre-made-candy): Ready-to-order, non-personalised candy. Individual product pages contain the most specific product information.`,
    "",
    "## Company and support",
    `- [About Roc Candy](${baseUrl}/about): Roc Candy's background, craftsmanship and ingredient-sourcing approach.`,
    `- [FAQs](${baseUrl}/faqs): The current source for ordering, delivery, ingredients, dietary suitability, pricing and turnaround questions.`,
    `- [Contact](${baseUrl}/contact): Enquiries about a custom order, colours, flavours, packaging, quantity and delivery timing.`,
    `- [Blog](${baseUrl}/blog): Rock candy ideas, event inspiration and product information.`,
    "",
    "## Useful facts",
    "- Roc Candy is based in North Perth, Western Australia, operates online, and delivers across Australia.",
    "- The candy is vegan, gluten free and dairy free; see the FAQs for current dietary and certification details.",
    "- Standard delivery is free to mainland Australia and Tasmania. Offshore islands, express shipping and urgent orders may have additional charges.",
    "- Personalised orders are handmade; customers should consult the current FAQs or contact Roc Candy for lead times and urgent-order availability.",
    "",
    "## Official profiles",
    "- Facebook: https://www.facebook.com/RocCandyPages/",
    "- Instagram: https://www.instagram.com/roccandyyum/",
    "",
    "Notes:",
    "- Public storefront and marketing pages are the primary source of truth.",
    "- Admin, checkout internals, API endpoints, and docs pages are not public reference content.",
    "- The FAQs, product pages, and current checkout information take precedence over this summary if details differ.",
  ].join("\n");

  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
