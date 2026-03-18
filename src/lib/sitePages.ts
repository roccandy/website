import { supabaseServerClient } from "@/lib/supabase/server";

const SITE_PAGES_TABLE = "site_pages";

export type ManagedSitePage = {
  slug: string;
  title: string;
  heroSubheading: string | null;
  heroSupportingLine: string | null;
  bodyHtml: string;
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
  seo_title?: string | null;
  meta_description?: string | null;
  og_image_url?: string | null;
  canonical_url?: string | null;
  gallery_image_urls?: string[] | null;
};

export const LANDING_GALLERY_PAGE_SLUGS = [
  "design/wedding-candy",
  "design/custom-text-candy",
  "design/branded-logo-candy",
] as const;

export const EDITABLE_SITE_PAGE_SLUGS = [
  "home",
  "about",
  "faq",
  "design",
  "design/wedding-candy",
  "design/custom-text-candy",
  "design/branded-logo-candy",
  "pre-made-candy",
  "contact",
  "shipping-and-returns",
  "privacy",
  "terms-and-conditions",
] as const;

export const CATCH_ALL_SITE_PAGE_SLUGS = [
  "contact",
  "shipping-and-returns",
  "design/wedding-candy",
  "design/custom-text-candy",
  "design/branded-logo-candy",
] as const;

const DEFAULT_SITE_PAGES: Record<string, ManagedSitePage> = {
  home: {
    slug: "home",
    title: "Personalised Rock Candy",
    heroSubheading: null,
    heroSupportingLine: null,
    bodyHtml:
      "<h2>Branded, Wedding and Text Lollies</h2><p>Artisan handmade candy made in Australia for weddings, branded campaigns, gifts, and celebrations.</p>",
    seoTitle: "Personalised Rock Candy Australia | Wedding, Branded & Custom Candy",
    metaDescription:
      "Personalised handmade rock candy for weddings, branded events, custom text gifts, and celebrations across Australia. Vegan, gluten free, dairy free, and delivered Australia wide.",
    ogImageUrl: "/landing/home-feature-poster.png",
    canonicalUrl: null,
    galleryImageUrls: [],
  },
  about: {
    slug: "about",
    title: "A Little About Us",
    heroSubheading: null,
    heroSupportingLine: null,
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
    galleryImageUrls: [],
  },
  faq: {
    slug: "faq",
    title: "Frequently Asked Questions",
    heroSubheading: null,
    heroSupportingLine: null,
    bodyHtml: "<p>Find answers about ordering, delivery, ingredients, lead times, and personalised rock candy options.</p>",
    seoTitle: "FAQ | Personalised Rock Candy Questions | Roc Candy",
    metaDescription:
      "Answers to common questions about Roc Candy personalised rock candy, including ordering, delivery, ingredients, lead times, and custom designs.",
    ogImageUrl: null,
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
<h2>Wedding candy FAQs</h2>
<p><strong>Can I order initials or both names?</strong><br />Yes. The wedding designer includes initials and both-names options so you can choose the format that suits your event.</p>
<p><strong>Can the colours match my wedding palette?</strong><br />Yes. We aim to match your chosen colours as closely as possible for a cohesive finish.</p>
<p><strong>Do you deliver across Australia?</strong><br />Yes. Roc Candy offers Australia-wide delivery, but custom orders should allow enough lead time for production and shipping.</p>
<p><a href="/design?type=weddings&subtype=weddings-initials">Start a wedding candy design</a> or <a href="/contact">contact us</a> if you need help with quantities and delivery timing.</p>
    `,
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
<h2>Custom text candy FAQs</h2>
<p><strong>Can I create candy with a name or short message?</strong><br />Yes. Roc Candy offers custom text options for names, initials, and short words.</p>
<p><strong>Can I choose colours and packaging too?</strong><br />Yes. You can select colours, packaging, and other presentation details within the designer.</p>
<p><strong>Is this available Australia-wide?</strong><br />Yes. Roc Candy delivers across Australia, but lead times should be checked for custom orders.</p>
<p><a href="/design?type=text&subtype=custom-1-6">Start a custom text design</a> or <a href="/contact">contact us</a> if you want help choosing the right format.</p>
    `,
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
<h2>Branded candy FAQs</h2>
<p><strong>Is branded candy suitable for corporate events?</strong><br />Yes. It is commonly used for activations, conferences, launches, hospitality, and gifting.</p>
<p><strong>Can you match brand colours?</strong><br />We aim to match brand colours as closely as possible and can advise on the best approach for production.</p>
<p><strong>What if I need help before ordering?</strong><br />Use the contact page if you need advice on quantities, timing, or whether your branding concept is suitable.</p>
<p><a href="/design?type=branded">Start a branded candy design</a> or <a href="/contact">contact us</a> if you need advice on branding, quantities, or lead times.</p>
    `,
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
    heroSubheading: null,
    heroSupportingLine: null,
    bodyHtml:
      "<p>Choose from our range of pre-made candy for multiple occasions, available for pickup or delivery across Australia.</p>",
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
    heroSubheading: null,
    heroSupportingLine: null,
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
    seoTitle: "Contact Roc Candy | Personalised Rock Candy Australia",
    metaDescription:
      "Contact Roc Candy for personalised rock candy orders, wedding candy, branded candy, delivery questions, and lead time advice.",
    ogImageUrl: "/landing/home-feature-poster.png",
    canonicalUrl: null,
    galleryImageUrls: [],
  },
  "shipping-and-returns": {
    slug: "shipping-and-returns",
    title: "Shipping and Returns",
    heroSubheading: null,
    heroSupportingLine: null,
    bodyHtml: `
<p>Roc Candy ships across Australia. Delivery timing depends on the type of order, production volume, and your required date.</p>
<h2>Shipping</h2>
<p>Pre-made candy orders are packed and dispatched as ready-to-order products. Custom personalised candy orders are produced to order and should be booked with enough time for production and delivery.</p>
<p>For urgent requirements, contact us before ordering so we can confirm whether your date can be accommodated.</p>
<h2>Returns</h2>
<p>Because personalised candy is made to order, returns are generally not available for change-of-mind purchases once production has started. If there is an issue with your order, contact us as soon as possible so we can review the matter and help.</p>
<h2>Need help before ordering?</h2>
<p>If you are unsure about lead times, shipping options, or the best product for your event, <a href="/contact">contact us</a> and we will help you plan the order properly.</p>
    `,
    seoTitle: "Shipping and Returns | Roc Candy Australia",
    metaDescription:
      "Read Roc Candy shipping and returns information for personalised and pre-made rock candy orders across Australia.",
    ogImageUrl: "/landing/home-feature-poster.png",
    canonicalUrl: null,
    galleryImageUrls: [],
  },
  privacy: {
    slug: "privacy",
    title: "Privacy Policy",
    heroSubheading: null,
    heroSupportingLine: null,
    bodyHtml: "<p>Add privacy policy content in admin.</p>",
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
    seoTitle: "Terms and Conditions | Roc Candy",
    metaDescription:
      "Read Roc Candy's terms and conditions covering orders, production, delivery, payments, refunds, and website use.",
    ogImageUrl: null,
    canonicalUrl: null,
    galleryImageUrls: [],
  },
};

function normalizeText(value: string | null | undefined) {
  return (value ?? "").replace(/\r\n/g, "\n").trim();
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function normalizeGalleryImageUrls(values: string[] | null | undefined) {
  return (values ?? [])
    .map((value) => normalizeText(value))
    .filter(Boolean);
}

function isMissingTableError(message: string) {
  return message.includes("site_pages") || message.includes("relation") || message.includes("schema cache");
}

function isMissingGalleryColumnError(message: string) {
  return message.includes("gallery_image_urls") || message.includes("schema cache");
}

function isMissingLandingHeroColumnError(message: string) {
  return message.includes("hero_subheading") || message.includes("hero_supporting_line") || message.includes("schema cache");
}

function normalizeRow(row: SitePageRow): ManagedSitePage {
  return {
    slug: row.slug,
    title: normalizeText(row.title),
    heroSubheading: normalizeOptionalText(row.hero_subheading),
    heroSupportingLine: normalizeOptionalText(row.hero_supporting_line),
    bodyHtml: normalizeText(row.body_html),
    seoTitle: normalizeOptionalText(row.seo_title),
    metaDescription: normalizeOptionalText(row.meta_description),
    ogImageUrl: normalizeOptionalText(row.og_image_url),
    canonicalUrl: normalizeOptionalText(row.canonical_url),
    galleryImageUrls: normalizeGalleryImageUrls(row.gallery_image_urls),
  };
}

async function readSitePage(slug: string): Promise<ManagedSitePage | null> {
  const selectAttempts = [
    {
      columns:
        "slug,title,hero_subheading,hero_supporting_line,body_html,seo_title,meta_description,og_image_url,canonical_url,gallery_image_urls",
      normalize: (row: SitePageRow) => row,
    },
    {
      columns: "slug,title,body_html,seo_title,meta_description,og_image_url,canonical_url,gallery_image_urls",
      normalize: (row: SitePageRow) => ({
        ...row,
        hero_subheading: null,
        hero_supporting_line: null,
      }),
    },
    {
      columns: "slug,title,hero_subheading,hero_supporting_line,body_html,seo_title,meta_description,og_image_url,canonical_url",
      normalize: (row: SitePageRow) => ({
        ...row,
        gallery_image_urls: [],
      }),
    },
    {
      columns: "slug,title,body_html,seo_title,meta_description,og_image_url,canonical_url",
      normalize: (row: SitePageRow) => ({
        ...row,
        hero_subheading: null,
        hero_supporting_line: null,
        gallery_image_urls: [],
      }),
    },
  ] as const;

  for (const attempt of selectAttempts) {
    const result = await supabaseServerClient
      .from(SITE_PAGES_TABLE)
      .select(attempt.columns)
      .eq("slug", slug)
      .maybeSingle();

    if (!result.error) {
      return result.data ? normalizeRow(attempt.normalize(result.data as unknown as SitePageRow)) : null;
    }

    const message = result.error.message.toLowerCase();
    if (isMissingTableError(message)) {
      return null;
    }

    if (!isMissingGalleryColumnError(message) && !isMissingLandingHeroColumnError(message)) {
      throw new Error(result.error.message);
    }
  }

  return null;
}

async function upsertSitePage(page: ManagedSitePage) {
  const payload: SitePageRow = {
    slug: page.slug,
    title: normalizeText(page.title),
    hero_subheading: normalizeOptionalText(page.heroSubheading),
    hero_supporting_line: normalizeOptionalText(page.heroSupportingLine),
    body_html: normalizeText(page.bodyHtml),
    seo_title: normalizeOptionalText(page.seoTitle),
    meta_description: normalizeOptionalText(page.metaDescription),
    og_image_url: normalizeOptionalText(page.ogImageUrl),
    canonical_url: normalizeOptionalText(page.canonicalUrl),
    gallery_image_urls: normalizeGalleryImageUrls(page.galleryImageUrls),
  };

  const upsertAttempts = [
    payload,
    {
      slug: payload.slug,
      title: payload.title,
      body_html: payload.body_html,
      seo_title: payload.seo_title,
      meta_description: payload.meta_description,
      og_image_url: payload.og_image_url,
      canonical_url: payload.canonical_url,
      gallery_image_urls: payload.gallery_image_urls,
    },
    {
      slug: payload.slug,
      title: payload.title,
      hero_subheading: payload.hero_subheading,
      hero_supporting_line: payload.hero_supporting_line,
      body_html: payload.body_html,
      seo_title: payload.seo_title,
      meta_description: payload.meta_description,
      og_image_url: payload.og_image_url,
      canonical_url: payload.canonical_url,
    },
    {
      slug: payload.slug,
      title: payload.title,
      body_html: payload.body_html,
      seo_title: payload.seo_title,
      meta_description: payload.meta_description,
      og_image_url: payload.og_image_url,
      canonical_url: payload.canonical_url,
    },
  ] as const;

  for (const attempt of upsertAttempts) {
    const result = await supabaseServerClient.from(SITE_PAGES_TABLE).upsert(attempt, {
      onConflict: "slug",
    });

    if (!result.error) {
      return;
    }

    const message = result.error.message.toLowerCase();
    if (!isMissingGalleryColumnError(message) && !isMissingLandingHeroColumnError(message)) {
      throw new Error(result.error.message);
    }
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
    heroSubheading: null,
    heroSupportingLine: null,
    bodyHtml: "",
    seoTitle: null,
    metaDescription: null,
    ogImageUrl: null,
    canonicalUrl: null,
    galleryImageUrls: [],
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
    heroSubheading:
      page.heroSubheading !== undefined ? normalizeOptionalText(page.heroSubheading) : current.heroSubheading,
    heroSupportingLine:
      page.heroSupportingLine !== undefined
        ? normalizeOptionalText(page.heroSupportingLine)
        : current.heroSupportingLine,
    bodyHtml: page.bodyHtml !== undefined ? normalizeText(page.bodyHtml) : current.bodyHtml,
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
