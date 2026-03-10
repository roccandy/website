import { supabaseServerClient } from "@/lib/supabase/server";

const MANAGED_PAGES_BUCKET = "site-content";
const MANAGED_PAGES_PATH = "managed-pages.json";

const RESERVED_EXACT_PATHS = new Set([
  "about",
  "admin",
  "api",
  "checkout",
  "design",
  "docs",
  "faq",
  "manifest.webmanifest",
  "pre-made-candy",
  "premade",
  "privacy",
  "quote",
  "robots.txt",
  "sitemap.xml",
  "terms-and-conditions",
]);

const RESERVED_ROOT_SEGMENTS = new Set([
  "admin",
  "api",
  "checkout",
  "docs",
  "pre-made-candy",
]);

export type ManagedPage = {
  id: string;
  slugPath: string;
  title: string;
  bodyHtml: string;
  seoTitle: string | null;
  metaDescription: string | null;
  ogImageUrl: string | null;
  canonicalUrl: string | null;
  isPublished: boolean;
  isIndexable: boolean;
  createdAt: string;
  updatedAt: string;
};

type StoredManagedPage = {
  id?: string;
  slugPath?: string;
  title?: string;
  bodyHtml?: string;
  seoTitle?: string | null;
  metaDescription?: string | null;
  ogImageUrl?: string | null;
  canonicalUrl?: string | null;
  isPublished?: boolean;
  isIndexable?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type ManagedPageInput = {
  id?: string | null;
  slugPath: string;
  title: string;
  bodyHtml: string;
  seoTitle?: string | null;
  metaDescription?: string | null;
  ogImageUrl?: string | null;
  canonicalUrl?: string | null;
  isPublished?: boolean;
  isIndexable?: boolean;
};

export type ManagedPageSaveResult =
  | { ok: true; page: ManagedPage; previousPath: string | null }
  | { ok: false; error: string };

function normalizeText(value: string | null | undefined) {
  return (value ?? "").replace(/\r\n/g, "\n").trim();
}

function normalizeSlugSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeManagedPagePath(value: string) {
  return value
    .split("/")
    .map((segment) => normalizeSlugSegment(segment))
    .filter(Boolean)
    .join("/");
}

function buildIsoTimestamp(value?: string) {
  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function looksLikeMissingStorage(message: string) {
  return (
    message.includes("not found") ||
    message.includes("does not exist") ||
    message.includes("no such bucket") ||
    message.includes("the resource was not found")
  );
}

function getPathValidationError(path: string) {
  if (!path) return "Path is required.";
  if (RESERVED_EXACT_PATHS.has(path)) return "That path is already used by a built-in page.";

  const [root] = path.split("/");
  if (root && RESERVED_ROOT_SEGMENTS.has(root)) {
    return `Paths starting with "${root}" are reserved.`;
  }

  return null;
}

function buildDefaultManagedPages(): ManagedPage[] {
  const now = new Date().toISOString();

  return normalizeManagedPages([
    {
      id: "managed-contact",
      slugPath: "contact",
      title: "Contact Roc Candy",
      seoTitle: "Contact Roc Candy | Personalised Rock Candy Australia",
      metaDescription:
        "Contact Roc Candy for personalised rock candy orders, wedding candy, branded candy, delivery questions, and lead time advice.",
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
      ogImageUrl: "/landing/home-feature-poster.png",
      canonicalUrl: null,
      isPublished: true,
      isIndexable: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "managed-shipping-returns",
      slugPath: "shipping-and-returns",
      title: "Shipping and Returns",
      seoTitle: "Shipping and Returns | Roc Candy Australia",
      metaDescription:
        "Read Roc Candy shipping and returns information for personalised and pre-made rock candy orders across Australia.",
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
      ogImageUrl: "/landing/home-feature-poster.png",
      canonicalUrl: null,
      isPublished: true,
      isIndexable: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "managed-wedding-candy",
      slugPath: "design/wedding-candy",
      title: "Wedding Candy",
      seoTitle: "Wedding Candy Australia | Personalised Wedding Rock Candy | Roc Candy",
      metaDescription:
        "Create personalised wedding rock candy in Australia with names, initials, colours, and packaging for bonbonniere, favours, and wedding tables.",
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
<h2>How the process works</h2>
<ol>
  <li>Choose a wedding style in the designer.</li>
  <li>Select your preferred text, colours, and packaging.</li>
  <li>Review pricing and submit the order details.</li>
  <li>We produce the candy and arrange dispatch for your required date.</li>
</ol>
<h2>Wedding candy FAQs</h2>
<p><strong>Can I order initials or both names?</strong><br />Yes. The wedding designer includes initials and both-names options so you can choose the format that suits your event.</p>
<p><strong>Can the colours match my wedding palette?</strong><br />Yes. We aim to match your chosen colours as closely as possible for a cohesive finish.</p>
<p><strong>Do you deliver across Australia?</strong><br />Yes. Roc Candy offers Australia-wide delivery, but custom orders should allow enough lead time for production and shipping.</p>
<p><a href="/design?type=weddings&subtype=weddings-initials">Start a wedding candy design</a> or <a href="/contact">contact us</a> if you need help with quantities and delivery timing.</p>
      `,
      ogImageUrl: "/quote/subtypes/weddings-initials.jpg",
      canonicalUrl: null,
      isPublished: true,
      isIndexable: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "managed-branded-candy",
      slugPath: "design/branded-logo-candy",
      title: "Branded Logo Candy",
      seoTitle: "Branded Logo Candy Australia | Custom Rock Candy for Events | Roc Candy",
      metaDescription:
        "Order branded logo candy in Australia for promotions, launches, client gifts, and events. Custom rock candy designed with your branding.",
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
<h2>What to prepare before ordering</h2>
<ul>
  <li>Your preferred event date or delivery window</li>
  <li>Your logo or artwork direction</li>
  <li>Brand colours or reference materials</li>
  <li>An estimate of the quantity required</li>
</ul>
<h2>Branded candy FAQs</h2>
<p><strong>Is branded candy suitable for corporate events?</strong><br />Yes. It is commonly used for activations, conferences, launches, hospitality, and gifting.</p>
<p><strong>Can you match brand colours?</strong><br />We aim to match brand colours as closely as possible and can advise on the best approach for production.</p>
<p><strong>What if I need help before ordering?</strong><br />Use the contact page if you need advice on quantities, timing, or whether your branding concept is suitable.</p>
<p><a href="/design?type=branded">Start a branded candy design</a> or <a href="/contact">contact us</a> if you need advice on branding, quantities, or lead times.</p>
      `,
      ogImageUrl: "/quote/subtypes/branded.jpg",
      canonicalUrl: null,
      isPublished: true,
      isIndexable: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "managed-custom-text-candy",
      slugPath: "design/custom-text-candy",
      title: "Custom Text Candy",
      seoTitle: "Custom Text Candy Australia | Personalised Letter Rock Candy | Roc Candy",
      metaDescription:
        "Create custom text rock candy in Australia with names, words, initials, and personalised colours for gifts, parties, and events.",
      bodyHtml: `
<p>Custom text candy is a simple way to personalise a celebration, gift, or event. Roc Candy can create rock candy with names, short words, initials, and customised colour combinations.</p>
<h2>Personalised candy with your text</h2>
<p>Custom text candy is popular for birthdays, baby showers, hens parties, thank-you gifts, event favours, and special occasions where you want something more memorable than standard sweets.</p>
<h2>When custom text candy makes sense</h2>
<p>These products work well when you want a personalised item without needing a full logo or large corporate brief. They are a good fit for names, short words, nicknames, and simple event messages that feel tailored to the person or celebration.</p>
<h2>Popular custom text uses</h2>
<ul>
  <li>Birthdays and milestone parties</li>
  <li>Baby showers and christenings</li>
  <li>Thank-you gifts and favours</li>
  <li>Small runs for special events</li>
</ul>
<h2>Choosing the right text option</h2>
<p>If your wording is short, start with the 1 to 6 letter option. Longer names or phrases can be configured in the designer as you move through the product setup.</p>
<h2>Custom text candy FAQs</h2>
<p><strong>Can I use names or initials?</strong><br />Yes. This is one of the most common uses for custom text candy.</p>
<p><strong>Is it suitable for baby showers and birthdays?</strong><br />Yes. Custom text candy is frequently ordered for milestone events and gift-style occasions.</p>
<p><strong>Can I choose the colours?</strong><br />Yes. The designer lets you select colour combinations that suit the event or theme.</p>
<p><a href="/design?type=text&subtype=custom-1-6">Start a custom text candy design</a> or <a href="/contact">contact us</a> if you need help choosing the best option.</p>
      `,
      ogImageUrl: "/quote/subtypes/custom-1-6.jpg",
      canonicalUrl: null,
      isPublished: true,
      isIndexable: true,
      createdAt: now,
      updatedAt: now,
    },
  ]);
}

function normalizeManagedPages(items: StoredManagedPage[]): ManagedPage[] {
  const seenPaths = new Set<string>();
  return items
    .map((item) => {
      const slugPath = normalizeManagedPagePath(item.slugPath ?? "");
      const title = normalizeText(item.title);
      if (!slugPath || !title || seenPaths.has(slugPath)) return null;
      seenPaths.add(slugPath);
      return {
        id: normalizeText(item.id) || crypto.randomUUID(),
        slugPath,
        title,
        bodyHtml: normalizeText(item.bodyHtml),
        seoTitle: normalizeText(item.seoTitle ?? "") || null,
        metaDescription: normalizeText(item.metaDescription ?? "") || null,
        ogImageUrl: normalizeText(item.ogImageUrl ?? "") || null,
        canonicalUrl: normalizeText(item.canonicalUrl ?? "") || null,
        isPublished: item.isPublished !== false,
        isIndexable: item.isIndexable !== false,
        createdAt: buildIsoTimestamp(item.createdAt),
        updatedAt: buildIsoTimestamp(item.updatedAt),
      } satisfies ManagedPage;
    })
    .filter((item): item is ManagedPage => Boolean(item))
    .sort((a, b) => a.slugPath.localeCompare(b.slugPath));
}

async function readManagedPagesFromStorage(): Promise<ManagedPage[] | null> {
  let data: Blob | null = null;
  let error: { message?: string } | null = null;

  try {
    const response = await supabaseServerClient.storage.from(MANAGED_PAGES_BUCKET).download(MANAGED_PAGES_PATH);
    data = response.data ?? null;
    error = response.error ? { message: response.error.message } : null;
  } catch (err) {
    const message = err instanceof Error ? err.message.toLowerCase() : "";
    if (looksLikeMissingStorage(message) || message.includes('"url"')) {
      return null;
    }
    throw err;
  }

  if (error || !data) {
    const message = (error?.message ?? "").toLowerCase();
    if (looksLikeMissingStorage(message) || message.includes('"url"')) return null;
    throw new Error(error?.message ?? "Unable to read managed page data.");
  }

  const raw = await data.text();
  if (!raw.trim()) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed)) return null;
  return normalizeManagedPages(parsed as StoredManagedPage[]);
}

async function ensureManagedPagesBucket() {
  const { error } = await supabaseServerClient.storage.createBucket(MANAGED_PAGES_BUCKET, {
    public: false,
  });
  if (error) {
    const message = error.message.toLowerCase();
    if (!message.includes("already exists")) {
      throw new Error(error.message);
    }
  }
}

async function writeManagedPagesToStorage(items: ManagedPage[]) {
  const payload = JSON.stringify(items, null, 2);
  const upload = async () =>
    supabaseServerClient.storage.from(MANAGED_PAGES_BUCKET).upload(MANAGED_PAGES_PATH, payload, {
      upsert: true,
      contentType: "application/json; charset=utf-8",
      cacheControl: "0",
    });

  let result = await upload();
  if (result.error && looksLikeMissingStorage(result.error.message.toLowerCase())) {
    await ensureManagedPagesBucket();
    result = await upload();
  }

  if (result.error) {
    throw new Error(result.error.message);
  }
}

export function buildManagedPageHref(slugPath: string) {
  return `/${normalizeManagedPagePath(slugPath)}`;
}

export async function getManagedPages(): Promise<ManagedPage[]> {
  const stored = await readManagedPagesFromStorage();
  return stored ?? buildDefaultManagedPages();
}

export async function getManagedPageByPath(slugPath: string) {
  const normalizedPath = normalizeManagedPagePath(slugPath);
  if (!normalizedPath) return null;
  const pages = await getManagedPages();
  return pages.find((page) => page.slugPath === normalizedPath) ?? null;
}

export async function saveManagedPage(input: ManagedPageInput): Promise<ManagedPageSaveResult> {
  const pages = await getManagedPages();
  const normalizedPath = normalizeManagedPagePath(input.slugPath);
  const title = normalizeText(input.title);
  const bodyHtml = normalizeText(input.bodyHtml);
  const seoTitle = normalizeText(input.seoTitle ?? "") || null;
  const metaDescription = normalizeText(input.metaDescription ?? "") || null;
  const ogImageUrl = normalizeText(input.ogImageUrl ?? "") || null;
  const canonicalUrl = normalizeText(input.canonicalUrl ?? "") || null;

  if (!title) return { ok: false, error: "Page title is required." };
  if (!bodyHtml) return { ok: false, error: "Page content is required." };

  const pathError = getPathValidationError(normalizedPath);
  if (pathError) return { ok: false, error: pathError };

  const existing = input.id ? pages.find((page) => page.id === input.id) ?? null : null;
  const duplicate = pages.find((page) => page.slugPath === normalizedPath && page.id !== existing?.id);
  if (duplicate) {
    return { ok: false, error: "Another page already uses that path." };
  }

  const now = new Date().toISOString();
  const nextPage: ManagedPage = {
    id: existing?.id ?? crypto.randomUUID(),
    slugPath: normalizedPath,
    title,
    bodyHtml,
    seoTitle,
    metaDescription,
    ogImageUrl,
    canonicalUrl,
    isPublished: input.isPublished !== false,
    isIndexable: input.isIndexable !== false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const nextPages = normalizeManagedPages(
    (existing
      ? pages.map((page) => (page.id === existing.id ? nextPage : page))
      : [...pages, nextPage]) as StoredManagedPage[]
  );
  await writeManagedPagesToStorage(nextPages);
  return { ok: true, page: nextPage, previousPath: existing?.slugPath ?? null };
}

export async function deleteManagedPage(id: string) {
  const pages = await getManagedPages();
  const page = pages.find((item) => item.id === id);
  if (!page) {
    return { ok: false as const, error: "Page not found." };
  }
  const nextPages = pages.filter((item) => item.id !== id);
  await writeManagedPagesToStorage(nextPages);
  return { ok: true as const, page };
}
