# SEO Setup

## Implemented

- `sitemap.xml` is generated from public routes and active pre-made product pages.
- `robots.txt` points to the sitemap and blocks `/admin/` and `/api/`.
- Public pages now expose page-specific metadata, canonical URLs, Open Graph, and Twitter cards.
- Structured data is included for:
  - `Organization`
  - `WebSite`
  - `WebPage`
  - `FAQPage`
  - `CollectionPage`
  - `Product`
  - `Service`
- `manifest.webmanifest` is generated.
- `/llms.txt` is available for AI/GEO crawlers.
- Redirect-only aliases are marked `noindex`.
- Admin, checkout, docs, and 404 surfaces are marked `noindex`.
- `vercel.app` preview hosts now return `X-Robots-Tag: noindex, nofollow, noarchive`.
- Google Analytics 4 and Google Tag Manager can be enabled by env var without more code changes.
- The analytics loader prefers GTM over direct GA4 when both IDs are present, reducing duplicate-tracking risk.
- Search engine verification tags can be enabled by env var without more code changes.
- The SEO workspace now covers both fixed site pages and individual pre-made product pages.
- `view_item`, `add_to_cart`, `begin_checkout`, and `purchase` ecommerce events are implemented in the app.
- Public canonicals and sitemap host no longer fall back to ad-hoc `VERCEL_URL` preview hosts.

## Env Vars For SEO

Set these in production if they are not already configured:

- `NEXT_PUBLIC_SITE_URL`
  - Example: `https://roccandy.com.au`
  - Used for canonical URLs, schema URLs, sitemap entries, and social metadata.

- `GOOGLE_SITE_VERIFICATION`
  - Google Search Console verification token.

- `BING_SITE_VERIFICATION`
  - Bing Webmaster Tools verification token.

- `YANDEX_SITE_VERIFICATION`
  - Yandex verification token, if needed.

- `NEXT_PUBLIC_GA_MEASUREMENT_ID`
  - Example: `G-XXXXXXXXXX`
  - Enables GA4.

- `NEXT_PUBLIC_GTM_ID`
  - Example: `GTM-XXXXXXX`
  - Enables Google Tag Manager.

## Notes For SEO Review

- The main SEO landing pages are:
  - `/`
  - `/design`
  - `/design?type=branded`
  - `/design?type=weddings`
  - `/design?type=text`
  - `/pre-made-candy`
  - `/pre-made-candy/[item]`
  - `/about`
  - `/faqs`
  - `/blog`

- `/quote` and `/premade` are redirect aliases and should not be indexed.

- Product schema is generated from the `premade_candies` table. If richer data is needed, the most useful additions would be:
  - review/rating data
  - GTIN/MPN
  - richer shipping/return policy data

- Pre-made product metadata can now be edited in the SEO workspace, but the actual product pricing / stock / content still live in the pre-made admin.

- The codebase still has unrelated lint issues in older page/components files. The SEO additions themselves pass focused lint and TypeScript validation.
