import { supabaseAdminClient } from "@/lib/supabase/admin";
import { supabasePublicClient } from "@/lib/supabase/public";
import { buildDesignerPath } from "@/lib/designUrls";
import { getFaqContentItemsByIds, type FaqContent } from "@/lib/faqs";

const SITE_PAGES_TABLE = "site_pages";
const SITE_PAGES_SELECT =
  "slug,title,hero_subheading,hero_supporting_line,body_html,faq_heading,faq_item_ids,seo_title,meta_description,og_image_url,canonical_url,gallery_image_urls";

export type ManagedSitePage = {
  slug: string;
  title: string;
  heroSubheading: string | null;
  heroSupportingLine: string | null;
  bodyHtml: string;
  faqHeading: string | null;
  faqItemIds: string[];
  seoTitle: string | null;
  metaDescription: string | null;
  ogImageUrl: string | null;
  canonicalUrl: string | null;
  galleryImageUrls: string[];
};

export type ManagedSitePageInput = {
  slug: string;
  title?: string;
  heroSubheading?: string | null;
  heroSupportingLine?: string | null;
  bodyHtml?: string;
  faqHeading?: string | null;
  faqItemIds?: string[];
  seoTitle?: string | null;
  metaDescription?: string | null;
  ogImageUrl?: string | null;
  canonicalUrl?: string | null;
  galleryImageUrls?: string[];
};

type SitePageRow = {
  slug: string;
  title: string;
  hero_subheading?: string | null;
  hero_supporting_line?: string | null;
  body_html: string;
  faq_heading?: string | null;
  faq_item_ids?: string[] | null;
  seo_title?: string | null;
  meta_description?: string | null;
  og_image_url?: string | null;
  canonical_url?: string | null;
  gallery_image_urls?: string[] | null;
};

export type ManagedSitePageFaqSection = {
  heading: string;
  items: FaqContent[];
};

export type HomeCandyOption = {
  label: string;
  href: string;
  image: string;
};

export const LANDING_GALLERY_PAGE_SLUGS = [
  "design/wedding-candy",
  "design/custom-text-candy",
  "design/branded-logo-candy",
] as const;

export const HERO_INTRO_SITE_PAGE_SLUGS = [
  ...LANDING_GALLERY_PAGE_SLUGS,
  "contact",
  "custom-orders",
  "pre-made-candy",
] as const;

export const HERO_ONLY_SITE_PAGE_SLUGS = ["pre-made-candy"] as const;

export const EDITABLE_SITE_PAGE_SLUGS = [
  "home",
  "about",
  "faq",
  "blog",
  "design",
  "design/wedding-candy",
  "design/custom-text-candy",
  "design/branded-logo-candy",
  "pre-made-candy",
  "contact",
  "custom-orders",
  "privacy",
  "terms-and-conditions",
] as const;

export const CATCH_ALL_SITE_PAGE_SLUGS = [
  "contact",
  "design/wedding-candy",
  "design/custom-text-candy",
  "design/branded-logo-candy",
] as const;

type ManagedSeoField = "seoTitle" | "metaDescription" | "ogImageUrl" | "canonicalUrl";

export const DEFAULT_HOME_CANDY_OPTIONS: HomeCandyOption[] = [
  { label: "Branded", href: buildDesignerPath({ orderType: "branded", categoryId: "branded" }), image: "/quote/subtypes/branded.jpg" },
  { label: "Both Names", href: buildDesignerPath({ orderType: "weddings", categoryId: "weddings-both-names" }), image: "/quote/subtypes/weddings-both-names.jpg" },
  { label: "Initials", href: buildDesignerPath({ orderType: "weddings", categoryId: "weddings-initials" }), image: "/quote/subtypes/weddings-initials.jpg" },
  { label: "Custom Text 1-6 Letters", href: buildDesignerPath({ orderType: "text", categoryId: "custom-1-6" }), image: "/quote/subtypes/custom-1-6.jpg" },
  { label: "Custom Text 7-14 Letters", href: buildDesignerPath({ orderType: "text", categoryId: "custom-7-14" }), image: "/quote/subtypes/custom-7-14.jpeg" },
  { label: "Pre-made candy", href: "/pre-made-candy", image: "/quote/subtypes/premade.jpg" },
];

const DEFAULT_SITE_PAGES: Record<string, ManagedSitePage> = {
  home: {
    slug: "home",
    title: "Personalised Rock Candy",
    heroSubheading: null,
    heroSupportingLine: null,
    bodyHtml:
      "<h2>Branded, Wedding and Text Lollies</h2><p>Artisan handmade candy made in Australia for weddings, branded campaigns, gifts, and celebrations.</p>",
    faqHeading: null,
    faqItemIds: [],
    seoTitle: "Personalised Rock Candy Australia | Wedding, Branded & Custom Candy",
    metaDescription:
      "Personalised handmade rock candy for weddings, branded events and custom gifts. Vegan, gluten free and dairy free, delivered Australia-wide.",
    ogImageUrl: "/landing/home-feature-poster.jpg",
    canonicalUrl: null,
    galleryImageUrls: [],
  },
  about: {
    slug: "about",
    title: "A Little About Us",
    heroSubheading: null,
    heroSupportingLine: null,
    bodyHtml: `
<p><strong>Welcome to Roc Candy - Your Source for Exquisite Handmade Personalised Candy!</strong></p>
<p>Established in 1999 we have been creating for all occasions: Corporate functions, weddings, birthdays, christenings, and special event days such as NAIDOC, Pride, Idahobit, and R U OK? to name a few.</p>
<p>At Roc Candy, we believe in the power of sweetness and the joy it brings to people's lives in a visual and tasty way. Our passion for crafting delectable handmade candies is matched only by our dedication to creating personalised treats that are as unique as the individuals who savor them.</p>
<p>With our roots deeply embedded in the art of traditional candy-making, Roc Candy has evolved into a modern confectionery brand, combining time-honored techniques with innovative flavors and custom designs.</p>
<p>We handcraft each and every piece of candy with meticulous attention to detail, using only the finest ingredients sourced from trusted suppliers, 98% of which are Australian.</p>
<p>With Roc Candy, you have the freedom to <a href="/design">design your own candy</a>, tailored to match your unique style and event theme.</p>
<p>Whether you're looking for elegant <a href="/design/wedding-candy">wedding candy</a>, eye-catching <a href="/design/branded-logo-candy">branded candy</a>, or memorable <a href="/design/custom-text-candy">custom text candy</a>, Roc Candy has you covered.</p>
<p>We ship Australia-wide, delivering our delicious rock candy to all major cities, including Sydney, Melbourne, Brisbane, Perth, Adelaide, and beyond.</p>
<p>You can also browse our <a href="/pre-made-candy">pre-made candy range</a> for ready-to-order options.</p>
    `,
    faqHeading: null,
    faqItemIds: [],
    seoTitle: "About Roc Candy | Handmade Personalised Rock Candy Since 1999",
    metaDescription:
      "Learn about Roc Candy, Australian artisan confectioners creating handmade personalised rock candy for weddings, events, gifts, and branded campaigns since 1999.",
    ogImageUrl: "/about-carousel/about-1.jpg",
    canonicalUrl: null,
    galleryImageUrls: [],
  },
  faq: {
    slug: "faq",
    title: "Frequently Asked Questions",
    heroSubheading: null,
    heroSupportingLine: null,
    bodyHtml: "<p>Find answers about ordering, delivery, ingredients, lead times, and personalised rock candy options.</p>",
    faqHeading: null,
    faqItemIds: [],
    seoTitle: "FAQ | Personalised Rock Candy Questions | Roc Candy",
    metaDescription:
      "Answers to common questions about Roc Candy personalised rock candy, including ordering, delivery, ingredients, lead times, and custom designs.",
    ogImageUrl: null,
    canonicalUrl: null,
    galleryImageUrls: [],
  },
  blog: {
    slug: "blog",
    title: "Roc Candy Blog",
    heroSubheading: null,
    heroSupportingLine: null,
    bodyHtml:
      "<p>Stories, inspiration, product ideas, and behind-the-scenes updates from Roc Candy.</p>",
    faqHeading: null,
    faqItemIds: [],
    seoTitle: "Roc Candy Blog | Personalised Rock Candy Ideas, Events & News",
    metaDescription:
      "Read Roc Candy blog posts for personalised rock candy ideas, event inspiration, branded candy tips, wedding styling, and product updates.",
    ogImageUrl: "/landing/home-feature-poster.jpg",
    canonicalUrl: null,
    galleryImageUrls: [],
  },
  design: {
    slug: "design",
    title: "Design Your Candy",
    heroSubheading: null,
    heroSupportingLine: null,
    bodyHtml:
      "<p>Choose colours, flavours, packaging, and design options for personalised rock candy orders across Australia.</p>",
    faqHeading: null,
    faqItemIds: [],
    seoTitle: "Design Personalised Rock Candy | Wedding, Branded & Text Candy | Roc Candy",
    metaDescription:
      "Design personalised rock candy for weddings, branded events, gifts, and custom text orders. Choose colours, flavours, packaging, and styling online.",
    ogImageUrl: "/landing/design-top.webp",
    canonicalUrl: null,
    galleryImageUrls: [],
  },
  "design/wedding-candy": {
    slug: "design/wedding-candy",
    title: "Wedding Candy",
    heroSubheading: "Create wedding rock candy",
    heroSupportingLine: "customise colours and packaging",
    bodyHtml: `
<p>Roc Candy creates personalised wedding rock candy for bonbonniere, wedding favours, table styling, and custom guest gifts. Choose from initials, both names, colours, and packaging options to match your wedding theme.</p>
<h2>Personalised wedding rock candy</h2>
<p>Our wedding candy can be made with initials, names, and colour combinations designed to suit your event. Whether you want elegant classic styling or something bright and playful, we can help create a personalised result that fits your day.</p>
<h2>Why couples order wedding candy</h2>
<p>Wedding candy works well when you want a favour that feels personal, looks polished in photos, and ties into the broader styling of the event. It can sit on place settings, be packed into bonbonniere, or be added to gift bags for guests and bridal party members.</p>
<h2>Popular uses</h2>
<ul>
  <li>Wedding favours and bonbonniere</li>
  <li>Place settings and table styling</li>
  <li>Bridal shower and engagement events</li>
  <li>Gift boxes and welcome bags</li>
</ul>
<p><a href="${buildDesignerPath({ orderType: "weddings", categoryId: "weddings-initials" })}">Start a wedding candy design</a> or <a href="/contact">contact us</a> if you need help with quantities and delivery timing.</p>
    `,
    faqHeading: "Wedding candy questions",
    faqItemIds: [],
    seoTitle: "Wedding Candy Australia | Personalised Wedding Rock Candy | Roc Candy",
    metaDescription:
      "Create personalised wedding rock candy in Australia with names, initials, colours, and packaging for bonbonniere, favours, and wedding tables.",
    ogImageUrl: "/quote/subtypes/weddings-initials.jpg",
    canonicalUrl: null,
    galleryImageUrls: [
      "/quote/subtypes/weddings-both-names.jpg",
      "/quote/subtypes/weddings-initials.jpg",
      "/quote/subtypes/weddings-both-names.jpg",
      "/quote/subtypes/weddings-initials.jpg",
      "/quote/subtypes/weddings-both-names.jpg",
      "/quote/subtypes/weddings-initials.jpg",
    ],
  },
  "design/custom-text-candy": {
    slug: "design/custom-text-candy",
    title: "Custom Text Candy",
    heroSubheading: "Create text rock candy",
    heroSupportingLine: "customise colours and packaging",
    bodyHtml: `
<p>Custom text rock candy is ideal for names, initials, short words, event details, and fun personalised gifts. Roc Candy creates handmade text candy for parties, weddings, milestones, and branded events across Australia.</p>
<h2>Personalised text candy for events and gifts</h2>
<p>Whether you want a name, short phrase, initials, or a special message, custom text candy creates something highly personal and memorable. It suits both private events and larger celebrations where custom details matter.</p>
<h2>Popular custom text uses</h2>
<ul>
  <li>Birthday parties and milestone celebrations</li>
  <li>Wedding welcome gifts and bonbonniere</li>
  <li>Baby showers and christenings</li>
  <li>Event favours and personalised gift boxes</li>
</ul>
<h2>Choosing the right text option</h2>
<p>The designer includes different options depending on the length of text you want to use. Shorter text is usually the best option for visual clarity, but longer word ranges are also available.</p>
<p><a href="${buildDesignerPath({ orderType: "text", categoryId: "custom-1-6" })}">Start a custom text design</a> or <a href="/contact">contact us</a> if you want help choosing the right format.</p>
    `,
    faqHeading: "Custom text candy questions",
    faqItemIds: [],
    seoTitle: "Custom Text Rock Candy Australia | Personalised Letter Candy | Roc Candy",
    metaDescription:
      "Create personalised text rock candy with names, words, initials, and custom colours for gifts, parties, weddings, and events across Australia.",
    ogImageUrl: "/quote/subtypes/custom-1-6.jpg",
    canonicalUrl: null,
    galleryImageUrls: [
      "/quote/subtypes/custom-1-6.jpg",
      "/quote/subtypes/custom-7-14.jpeg",
      "/quote/subtypes/custom-1-6.jpg",
      "/quote/subtypes/custom-7-14.jpeg",
      "/quote/subtypes/custom-1-6.jpg",
      "/quote/subtypes/custom-7-14.jpeg",
    ],
  },
  "design/branded-logo-candy": {
    slug: "design/branded-logo-candy",
    title: "Branded Logo Candy",
    heroSubheading: "Create branded rock candy",
    heroSupportingLine: "customise colours and packaging",
    bodyHtml: `
<p>Branded logo candy is a memorable way to promote your business, campaign, product launch, or event. Roc Candy creates custom rock candy that showcases your brand in a colourful, edible format.</p>
<h2>Branded candy for events and campaigns</h2>
<p>Our branded rock candy is suitable for expos, conferences, client gifting, retail promotions, and event activations. We can help you match colours as closely as possible and choose packaging that suits the occasion.</p>
<h2>Why branded candy works</h2>
<p>Branded candy is tactile, easy to hand out, and highly memorable compared with generic promotional merchandise. It suits launches, conferences, hospitality gifting, and client thank-you packs where you want a product that feels distinctive rather than disposable.</p>
<h2>Common branded uses</h2>
<ul>
  <li>Corporate events and trade shows</li>
  <li>Client gifts and welcome packs</li>
  <li>Product launches and activations</li>
  <li>Retail promotions and hospitality events</li>
</ul>
<p><a href="${buildDesignerPath({ orderType: "branded", categoryId: "branded" })}">Start a branded candy design</a> or <a href="/contact">contact us</a> if you need advice on branding, quantities, or lead times.</p>
    `,
    faqHeading: "Branded candy questions",
    faqItemIds: [],
    seoTitle: "Branded Logo Candy Australia | Custom Rock Candy for Events | Roc Candy",
    metaDescription:
      "Order branded logo candy in Australia for promotions, launches, client gifts, and events. Custom rock candy designed with your branding.",
    ogImageUrl: "/quote/subtypes/branded.jpg",
    canonicalUrl: null,
    galleryImageUrls: [
      "/quote/subtypes/branded.jpg",
      "/quote/subtypes/branded.jpg",
      "/quote/subtypes/branded.jpg",
      "/quote/subtypes/branded.jpg",
      "/quote/subtypes/branded.jpg",
      "/quote/subtypes/branded.jpg",
    ],
  },
  "pre-made-candy": {
    slug: "pre-made-candy",
    title: "Pre-made candy",
    heroSubheading: "Ready-to-order rock candy",
    heroSupportingLine:
      "Choose from our range of pre-made candy for multiple occasions, available for pickup or delivery across Australia.",
    bodyHtml: "",
    faqHeading: null,
    faqItemIds: [],
    seoTitle: "Pre-Made Rock Candy Australia | Ready To Order Candy | Roc Candy",
    metaDescription:
      "Browse Roc Candy's pre-made rock candy collection with ready-to-order flavours, pack sizes, and Australia-wide delivery.",
    ogImageUrl: "/quote/subtypes/premade.jpg",
    canonicalUrl: null,
    galleryImageUrls: [],
  },
  contact: {
    slug: "contact",
    title: "Contact Roc Candy",
    heroSubheading: "Talk to our team",
    heroSupportingLine: "email, call, or get help with your order",
    bodyHtml: `
<p>Need help choosing the right personalised rock candy for your event, campaign, or celebration? Contact Roc Candy for advice on colours, flavours, packaging, delivery timing, and order quantities.</p>
<h2>Get in touch</h2>
<p><strong>Email:</strong> <a href="mailto:enquiries@roccandy.com.au">enquiries@roccandy.com.au</a></p>
<p><strong>Phone:</strong> <a href="tel:0414519211">0414 519 211</a></p>
<p><strong>Location:</strong> Australia-wide delivery from North Perth, Western Australia.</p>
<h2>What we can help with</h2>
<ul>
  <li>Wedding candy and bomboniere ideas</li>
  <li>Branded / logo candy for events and promotions</li>
  <li>Custom text candy for parties and gifts</li>
  <li>Delivery timing, lead times, and urgent orders</li>
  <li>Pre-made candy product questions</li>
</ul>
<p>If you already know what you need, you can also <a href="/design">start your custom candy order online</a> or browse our <a href="/pre-made-candy">pre-made candy range</a>.</p>
    `,
    faqHeading: null,
    faqItemIds: [],
    seoTitle: "Contact Roc Candy | Personalised Rock Candy Australia",
    metaDescription:
      "Contact Roc Candy for personalised rock candy orders, wedding candy, branded candy, delivery questions, and lead time advice.",
    ogImageUrl: "/landing/home-feature-poster.jpg",
    canonicalUrl: null,
    galleryImageUrls: [],
  },
  "custom-orders": {
    slug: "custom-orders",
    title: "Custom Candy Orders",
    heroSubheading: "Have an idea? We'll help bring it to life.",
    heroSupportingLine: null,
    bodyHtml: `
<p>We will help:</p>
<ul>
  <li>Explore an idea</li>
  <li>Work with your deadline</li>
  <li>Packaging and quantity guidance</li>
  <li>Colours and styling to suit your theme</li>
  <li>Which is best? Names, initials or text?</li>
  <li>Delivery times and urgent orders advice</li>
  <li>All other enquiries.</li>
</ul>
    `,
    faqHeading: null,
    faqItemIds: [],
    seoTitle: "Custom Candy Orders Australia | Personalised Rock Candy Help | Roc Candy",
    metaDescription:
      "Have an idea for personalised rock candy? Tell Roc Candy about your event, colours, packaging or timing and we will help shape the right custom order.",
    ogImageUrl: "/landing/home-feature-poster.jpg",
    canonicalUrl: null,
    galleryImageUrls: [],
  },
  privacy: {
    slug: "privacy",
    title: "Privacy Policy",
    heroSubheading: null,
    heroSupportingLine: null,
    bodyHtml: "<p>Add privacy policy content in admin.</p>",
    faqHeading: null,
    faqItemIds: [],
    seoTitle: null,
    metaDescription: null,
    ogImageUrl: null,
    canonicalUrl: null,
    galleryImageUrls: [],
  },
  "terms-and-conditions": {
    slug: "terms-and-conditions",
    title: "Terms & Conditions",
    heroSubheading: null,
    heroSupportingLine: null,
    bodyHtml: "<p>Terms and conditions content is managed separately. Use this SEO entry to control the page title and metadata.</p>",
    faqHeading: null,
    faqItemIds: [],
    seoTitle: "Terms and Conditions | Roc Candy",
    metaDescription:
      "Read Roc Candy's terms and conditions covering orders, production, delivery, payments, refunds, and website use.",
    ogImageUrl: null,
    canonicalUrl: null,
    galleryImageUrls: [],
  },
};

const LEGACY_SITE_PAGE_DEFAULTS: Partial<Record<string, Partial<Record<ManagedSeoField, readonly string[]>>>> = {
  home: {
    metaDescription: [
      "Personalised handmade rock candy for weddings, branded events, custom text gifts, and celebrations across Australia. Vegan, gluten free, dairy free, and delivered Australia wide.",
    ],
  },
};

function normalizeText(value: string | null | undefined) {
  return (value ?? "").replace(/\r\n/g, "\n").trim();
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = normalizeText(value);
  return normalized || null;
}

const LEGACY_FAQ_HEADING_MAP: Record<string, string> = {
  "Wedding Candy FAQs": "Wedding candy questions",
  "Custom Text Candy FAQs": "Custom text candy questions",
  "Branded Candy FAQs": "Branded candy questions",
};

function normalizeFaqHeadingValue(value: string | null | undefined) {
  const normalized = normalizeOptionalText(value);
  if (!normalized) return null;
  return LEGACY_FAQ_HEADING_MAP[normalized] ?? normalized;
}

function normalizeGalleryImageUrls(values: string[] | null | undefined) {
  return (values ?? [])
    .map((value) => normalizeText(value))
    .filter(Boolean);
}

export function serializeHomeCandyOption(option: HomeCandyOption) {
  return JSON.stringify({
    label: normalizeText(option.label),
    href: normalizeText(option.href),
    image: normalizeText(option.image),
  });
}

export function parseHomeCandyOptions(values: string[] | null | undefined) {
  const parsed = (values ?? [])
    .map((value) => {
      try {
        const candidate = JSON.parse(value) as Partial<HomeCandyOption>;
        const label = normalizeText(candidate.label);
        const href = normalizeText(candidate.href);
        const image = normalizeText(candidate.image);
        if (!label || !href || !image) return null;
        return { label, href, image } satisfies HomeCandyOption;
      } catch {
        return null;
      }
    })
    .filter((value): value is HomeCandyOption => Boolean(value));

  if (parsed.length === 0) {
    return DEFAULT_HOME_CANDY_OPTIONS;
  }

  return DEFAULT_HOME_CANDY_OPTIONS.map((fallback, index) => parsed[index] ?? fallback);
}

function normalizeFaqItemIds(values: string[] | null | undefined) {
  return (values ?? [])
    .map((value) => normalizeText(value))
    .filter(Boolean);
}

function isMissingTableError(message: string) {
  return message.includes("site_pages") || message.includes("relation") || message.includes("schema cache");
}

function normalizeRow(row: SitePageRow): ManagedSitePage {
  return {
    slug: row.slug,
    title: normalizeText(row.title),
    heroSubheading: normalizeOptionalText(row.hero_subheading),
    heroSupportingLine: normalizeOptionalText(row.hero_supporting_line),
    bodyHtml: normalizeText(row.body_html),
    faqHeading: normalizeFaqHeadingValue(row.faq_heading),
    faqItemIds: normalizeFaqItemIds(row.faq_item_ids),
    seoTitle: normalizeOptionalText(row.seo_title),
    metaDescription: normalizeOptionalText(row.meta_description),
    ogImageUrl: normalizeOptionalText(row.og_image_url),
    canonicalUrl: normalizeOptionalText(row.canonical_url),
    galleryImageUrls: normalizeGalleryImageUrls(row.gallery_image_urls),
  };
}

function resolveSeoFieldValue(
  slug: string,
  field: ManagedSeoField,
  value: string | null,
  fallback: string | null,
) {
  if (!value) return fallback;
  const legacyValues = LEGACY_SITE_PAGE_DEFAULTS[slug]?.[field] ?? [];
  return legacyValues.includes(value) ? fallback : value;
}

function hydrateManagedSitePage(existing: ManagedSitePage, fallback?: ManagedSitePage | null): ManagedSitePage {
  if (!fallback) return existing;

  return {
    ...existing,
    heroSubheading: existing.heroSubheading || fallback.heroSubheading,
    heroSupportingLine: existing.heroSupportingLine || fallback.heroSupportingLine,
    seoTitle: resolveSeoFieldValue(existing.slug, "seoTitle", existing.seoTitle, fallback.seoTitle),
    metaDescription: resolveSeoFieldValue(existing.slug, "metaDescription", existing.metaDescription, fallback.metaDescription),
    ogImageUrl: resolveSeoFieldValue(existing.slug, "ogImageUrl", existing.ogImageUrl, fallback.ogImageUrl),
    canonicalUrl: resolveSeoFieldValue(existing.slug, "canonicalUrl", existing.canonicalUrl, fallback.canonicalUrl),
  };
}

function areManagedSitePagesEqual(left: ManagedSitePage, right: ManagedSitePage) {
  return (
    left.slug === right.slug &&
    left.title === right.title &&
    left.heroSubheading === right.heroSubheading &&
    left.heroSupportingLine === right.heroSupportingLine &&
    left.bodyHtml === right.bodyHtml &&
    left.faqHeading === right.faqHeading &&
    left.faqItemIds.length === right.faqItemIds.length &&
    left.faqItemIds.every((value, index) => value === right.faqItemIds[index]) &&
    left.seoTitle === right.seoTitle &&
    left.metaDescription === right.metaDescription &&
    left.ogImageUrl === right.ogImageUrl &&
    left.canonicalUrl === right.canonicalUrl &&
    left.galleryImageUrls.length === right.galleryImageUrls.length &&
    left.galleryImageUrls.every((value, index) => value === right.galleryImageUrls[index])
  );
}

async function readSitePage(slug: string): Promise<ManagedSitePage | null> {
  const result = await supabasePublicClient
    .from(SITE_PAGES_TABLE)
    .select(SITE_PAGES_SELECT)
    .eq("slug", slug)
    .maybeSingle();

  if (result.error) {
    const message = result.error.message.toLowerCase();
    if (isMissingTableError(message)) {
      return null;
    }
    throw new Error(result.error.message);
  }

  return result.data ? normalizeRow(result.data as SitePageRow) : null;
}

async function upsertSitePage(page: ManagedSitePage) {
  const payload: SitePageRow = {
    slug: page.slug,
    title: normalizeText(page.title),
    hero_subheading: normalizeOptionalText(page.heroSubheading),
    hero_supporting_line: normalizeOptionalText(page.heroSupportingLine),
    body_html: normalizeText(page.bodyHtml),
    faq_heading: normalizeOptionalText(page.faqHeading),
    faq_item_ids: normalizeFaqItemIds(page.faqItemIds),
    seo_title: normalizeOptionalText(page.seoTitle),
    meta_description: normalizeOptionalText(page.metaDescription),
    og_image_url: normalizeOptionalText(page.ogImageUrl),
    canonical_url: normalizeOptionalText(page.canonicalUrl),
    gallery_image_urls: normalizeGalleryImageUrls(page.galleryImageUrls),
  };

  const result = await supabaseAdminClient.from(SITE_PAGES_TABLE).upsert(payload, {
    onConflict: "slug",
  });

  if (result.error) {
    throw new Error(result.error.message);
  }
}

export function buildManagedSitePageHref(slug: string) {
  if (slug === "home") return "/";
  if (slug === "faq") return "/faqs";
  return `/${slug.replace(/^\/+/, "")}`;
}

export function getDefaultManagedSitePage(slug: string): ManagedSitePage {
  return DEFAULT_SITE_PAGES[slug] ?? {
    slug,
    title: slug,
    heroSubheading: null,
    heroSupportingLine: null,
    bodyHtml: "",
    faqHeading: null,
    faqItemIds: [],
    seoTitle: null,
    metaDescription: null,
    ogImageUrl: null,
    canonicalUrl: null,
    galleryImageUrls: [],
  };
}

export function listDefaultManagedSitePages(slugs: readonly string[] = EDITABLE_SITE_PAGE_SLUGS) {
  return slugs.map((slug) => getDefaultManagedSitePage(slug));
}

export async function getManagedSitePage(slug: string): Promise<ManagedSitePage> {
  const existing = await readSitePage(slug);
  const fallback = getDefaultManagedSitePage(slug);

  if (!existing) {
    return fallback;
  }

  return hydrateManagedSitePage(existing, fallback);
}

export async function getManagedSitePages(slugs: readonly string[]) {
  const pages = await Promise.all(slugs.map((slug) => getManagedSitePage(slug)));
  return pages;
}

export async function syncManagedSitePages(slugs: readonly string[] = EDITABLE_SITE_PAGE_SLUGS) {
  const synced: ManagedSitePage[] = [];

  for (const slug of slugs) {
    const fallback = getDefaultManagedSitePage(slug);
    const existing = await readSitePage(slug);
    const next = existing ? hydrateManagedSitePage(existing, fallback) : fallback;

    if (!existing || !areManagedSitePagesEqual(existing, next)) {
      await upsertSitePage(next);
    }

    synced.push(next);
  }

  return synced;
}

export async function saveManagedSitePage(page: ManagedSitePageInput) {
  const current = await getManagedSitePage(page.slug);

  const next: ManagedSitePage = {
    slug: page.slug,
    title: page.title !== undefined ? normalizeText(page.title) : current.title,
    heroSubheading:
      page.heroSubheading !== undefined ? normalizeOptionalText(page.heroSubheading) : current.heroSubheading,
    heroSupportingLine:
      page.heroSupportingLine !== undefined
        ? normalizeOptionalText(page.heroSupportingLine)
        : current.heroSupportingLine,
    bodyHtml: page.bodyHtml !== undefined ? normalizeText(page.bodyHtml) : current.bodyHtml,
    faqHeading: page.faqHeading !== undefined ? normalizeOptionalText(page.faqHeading) : current.faqHeading,
    faqItemIds: page.faqItemIds !== undefined ? normalizeFaqItemIds(page.faqItemIds) : current.faqItemIds,
    seoTitle: page.seoTitle !== undefined ? normalizeOptionalText(page.seoTitle) : current.seoTitle,
    metaDescription:
      page.metaDescription !== undefined ? normalizeOptionalText(page.metaDescription) : current.metaDescription,
    ogImageUrl: page.ogImageUrl !== undefined ? normalizeOptionalText(page.ogImageUrl) : current.ogImageUrl,
    canonicalUrl:
      page.canonicalUrl !== undefined ? normalizeOptionalText(page.canonicalUrl) : current.canonicalUrl,
    galleryImageUrls:
      page.galleryImageUrls !== undefined ? normalizeGalleryImageUrls(page.galleryImageUrls) : current.galleryImageUrls,
  };

  await upsertSitePage(next);
}

export async function getManagedSitePageFaqSection(
  pageOrSlug: ManagedSitePage | string,
): Promise<ManagedSitePageFaqSection | null> {
  const page = typeof pageOrSlug === "string" ? await getManagedSitePage(pageOrSlug) : pageOrSlug;
  if (page.faqItemIds.length === 0) return null;

  const items = await getFaqContentItemsByIds(page.faqItemIds);
  if (items.length === 0) return null;

  return {
    heading: page.faqHeading || "Common Questions",
    items,
  };
}
