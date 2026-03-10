import { supabaseServerClient } from "@/lib/supabase/server";

const SITE_PAGES_TABLE = "site_pages";

export type ManagedSitePage = {
  slug: string;
  title: string;
  bodyHtml: string;
  seoTitle: string | null;
  metaDescription: string | null;
  ogImageUrl: string | null;
  canonicalUrl: string | null;
};

export type ManagedSitePageInput = {
  slug: string;
  title?: string;
  bodyHtml?: string;
  seoTitle?: string | null;
  metaDescription?: string | null;
  ogImageUrl?: string | null;
  canonicalUrl?: string | null;
};

type SitePageRow = {
  slug: string;
  title: string;
  body_html: string;
  seo_title?: string | null;
  meta_description?: string | null;
  og_image_url?: string | null;
  canonical_url?: string | null;
};

export const CORE_SITE_PAGE_SLUGS = ["about", "faq", "design", "pre-made-candy"] as const;

const DEFAULT_SITE_PAGES: Record<string, ManagedSitePage> = {
  about: {
    slug: "about",
    title: "A Little About Us",
    bodyHtml: `
<p class="normal-case text-2xl font-semibold leading-tight text-[#ff6f95]">Welcome to Roc Candy - Your Source for Exquisite Handmade Personalised Candy!</p>
<p>Established in 1999 we have been creating for all occasions: Corporate functions, weddings, birthdays, christenings, and special event days such as NAIDOC, Pride, Idahobit, and R U OK? to name a few.</p>
<p>At Roc Candy, we believe in the power of sweetness and the joy it brings to people's lives in a visual and tasty way. Our passion for crafting delectable handmade candies is matched only by our dedication to creating personalised treats that are as unique as the individuals who savor them.</p>
<p>With our roots deeply embedded in the art of traditional candy-making, Roc Candy has evolved into a modern confectionery brand, combining time-honored techniques with innovative flavors and custom designs.</p>
<p>We handcraft each and every piece of candy with meticulous attention to detail, using only the finest ingredients sourced from trusted suppliers, 98% of which are Australian.</p>
<p>With Roc Candy, you have the freedom to <a href="/design">design your own candy</a>, tailored to match your unique style and event theme.</p>
<p>Whether you're looking for elegant <a href="/design/wedding-candy">wedding candy</a>, eye-catching <a href="/design/branded-logo-candy">branded candy</a>, or memorable <a href="/design/custom-text-candy">custom text candy</a>, Roc Candy has you covered.</p>
<p>We ship Australia-wide, delivering our delicious rock candy to all major cities, including Sydney, Melbourne, Brisbane, Perth, Adelaide, and beyond.</p>
<p>You can also browse our <a href="/pre-made-candy">pre-made candy range</a> for ready-to-order options.</p>
    `,
    seoTitle: "About Roc Candy | Handmade Personalised Rock Candy Since 1999",
    metaDescription:
      "Learn about Roc Candy, Australian artisan confectioners creating handmade personalised rock candy for weddings, events, gifts, and branded campaigns since 1999.",
    ogImageUrl: "/about-carousel/about-1.jpg",
    canonicalUrl: null,
  },
  faq: {
    slug: "faq",
    title: "Frequently Asked Questions",
    bodyHtml: "<p>Find answers about ordering, delivery, ingredients, lead times, and personalised rock candy options.</p>",
    seoTitle: "FAQ | Personalised Rock Candy Questions | Roc Candy",
    metaDescription:
      "Answers to common questions about Roc Candy personalised rock candy, including ordering, delivery, ingredients, lead times, and custom designs.",
    ogImageUrl: null,
    canonicalUrl: null,
  },
  design: {
    slug: "design",
    title: "Design Your Candy",
    bodyHtml:
      "<p>Choose colours, flavours, packaging, and design options for personalised rock candy orders across Australia.</p>",
    seoTitle: "Design Personalised Rock Candy | Wedding, Branded & Text Candy | Roc Candy",
    metaDescription:
      "Design personalised rock candy for weddings, branded events, gifts, and custom text orders. Choose colours, flavours, packaging, and styling online.",
    ogImageUrl: "/landing/design-top.webp",
    canonicalUrl: null,
  },
  "pre-made-candy": {
    slug: "pre-made-candy",
    title: "Pre-made candy",
    bodyHtml:
      "<p>Choose from our range of pre-made candy for multiple occasions, available for pickup or delivery across Australia.</p>",
    seoTitle: "Pre-Made Rock Candy Australia | Ready To Order Candy | Roc Candy",
    metaDescription:
      "Browse Roc Candy's pre-made rock candy collection with ready-to-order flavours, pack sizes, and Australia-wide delivery.",
    ogImageUrl: "/quote/subtypes/premade.jpg",
    canonicalUrl: null,
  },
  privacy: {
    slug: "privacy",
    title: "Privacy Policy",
    bodyHtml: "<p>Add privacy policy content in admin.</p>",
    seoTitle: null,
    metaDescription: null,
    ogImageUrl: null,
    canonicalUrl: null,
  },
};

function normalizeText(value: string | null | undefined) {
  return (value ?? "").replace(/\r\n/g, "\n").trim();
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function isMissingTableError(message: string) {
  return message.includes("site_pages") || message.includes("relation") || message.includes("schema cache");
}

function normalizeRow(row: SitePageRow): ManagedSitePage {
  return {
    slug: row.slug,
    title: normalizeText(row.title),
    bodyHtml: normalizeText(row.body_html),
    seoTitle: normalizeOptionalText(row.seo_title),
    metaDescription: normalizeOptionalText(row.meta_description),
    ogImageUrl: normalizeOptionalText(row.og_image_url),
    canonicalUrl: normalizeOptionalText(row.canonical_url),
  };
}

async function readSitePage(slug: string): Promise<ManagedSitePage | null> {
  const { data, error } = await supabaseServerClient
    .from(SITE_PAGES_TABLE)
    .select("slug,title,body_html,seo_title,meta_description,og_image_url,canonical_url")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    const message = error.message.toLowerCase();
    if (isMissingTableError(message)) {
      return null;
    }
    throw new Error(error.message);
  }

  return data ? normalizeRow(data as SitePageRow) : null;
}

async function upsertSitePage(page: ManagedSitePage) {
  const payload = {
    slug: page.slug,
    title: normalizeText(page.title),
    body_html: normalizeText(page.bodyHtml),
    seo_title: normalizeOptionalText(page.seoTitle),
    meta_description: normalizeOptionalText(page.metaDescription),
    og_image_url: normalizeOptionalText(page.ogImageUrl),
    canonical_url: normalizeOptionalText(page.canonicalUrl),
  };

  const { error } = await supabaseServerClient.from(SITE_PAGES_TABLE).upsert(payload, {
    onConflict: "slug",
  });

  if (error) {
    throw new Error(error.message);
  }
}

export function buildManagedSitePageHref(slug: string) {
  return slug === "home" ? "/" : `/${slug.replace(/^\/+/, "")}`;
}

export async function getManagedSitePage(slug: string): Promise<ManagedSitePage> {
  const existing = await readSitePage(slug);
  if (existing) {
    return existing;
  }

  const fallback = DEFAULT_SITE_PAGES[slug] ?? {
    slug,
    title: slug,
    bodyHtml: "",
    seoTitle: null,
    metaDescription: null,
    ogImageUrl: null,
    canonicalUrl: null,
  };

  await upsertSitePage(fallback);
  return fallback;
}

export async function getManagedSitePages(slugs: readonly string[]) {
  const pages = await Promise.all(slugs.map((slug) => getManagedSitePage(slug)));
  return pages;
}

export async function saveManagedSitePage(page: ManagedSitePageInput) {
  const current = await getManagedSitePage(page.slug);

  const next: ManagedSitePage = {
    slug: page.slug,
    title: page.title !== undefined ? normalizeText(page.title) : current.title,
    bodyHtml: page.bodyHtml !== undefined ? normalizeText(page.bodyHtml) : current.bodyHtml,
    seoTitle: page.seoTitle !== undefined ? normalizeOptionalText(page.seoTitle) : current.seoTitle,
    metaDescription:
      page.metaDescription !== undefined ? normalizeOptionalText(page.metaDescription) : current.metaDescription,
    ogImageUrl: page.ogImageUrl !== undefined ? normalizeOptionalText(page.ogImageUrl) : current.ogImageUrl,
    canonicalUrl:
      page.canonicalUrl !== undefined ? normalizeOptionalText(page.canonicalUrl) : current.canonicalUrl,
  };

  await upsertSitePage(next);
}
