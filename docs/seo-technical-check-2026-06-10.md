# SEO Technical Checklist

Date: 2026-06-10
Checked against: live `https://roccandy.com.au` and local code.

## Summary

Most of the requested technical setup is already implemented. The main gaps are not critical blockers:

- `LocalBusiness` schema is not present.
- `BreadcrumbList` schema is not present.
- `VideoObject` schema is not present for the home/production video.
- `humans.txt` is not present, but it is optional.

Google Search Console was not checked because this local environment does not have authenticated access to the Roc Candy Search Console property.

## Checklist

| Item | Status | Evidence / note |
|---|---|---|
| `robots.txt` | Pass | Live file allows `/`, blocks only `/admin/` and `/api/`, points to `https://roccandy.com.au/sitemap.xml`. It does not block image folders, Googlebot, Google-Extended, CSS, or JS. |
| `sitemap.xml` | Pass | Live sitemap contains `24` public URLs: homepage, design, wedding, branded, custom text, pre-made collection, individual pre-made products, FAQs, about, contact, blog, important blog posts, privacy, and terms. |
| Exclude private/internal URLs from sitemap | Pass | Sitemap does not include admin, API, checkout/cart, quote-step internals, staging, or `vercel.app` URLs. |
| Canonicals | Pass | Public pages have clean canonicals on `roccandy.com.au`. Tested `?srsltid=AfmBOoqTestTrackingParam`; canonical still points to the clean product URL. |
| Titles and descriptions | Pass | Checked key public pages. Each has a distinct title and meta description. |
| Organization schema | Pass | Present globally. Includes business name, URL, logo, email, phone, address, social profiles, and area served. |
| LocalBusiness schema | Gap | Not currently present. Organization schema covers much of the same information, but it is not typed as `LocalBusiness`. |
| Product schema | Pass | Present on individual pre-made product pages with `Product`, `Brand`, `Offer`, price, currency, availability, image, SKU/category where available. |
| Custom category Product schema | Not applicable / cautious | Design and custom candy landing pages use page/service style schema, not Product schema. This is appropriate unless fixed pricing/availability is clear enough. |
| FAQPage schema | Pass | Present where FAQ sections are rendered from page FAQ data. |
| BreadcrumbList schema | Gap | Not currently present on product/category/blog pages. |
| ImageObject schema | Partial pass | Present for logo inside Organization schema. Product image data is present as `Product.image`, but standalone page image objects are not broadly used. |
| VideoObject schema | Optional gap | Not present for the home feature video. Useful if the video is intended as indexable/search-visible content. |
| `humans.txt` | Optional gap | `https://roccandy.com.au/humans.txt` returns `404`. Harmless to leave absent. |
| `llms.txt` | Pass / optional | `https://roccandy.com.au/llms.txt` exists. It is factual, short, points to preferred public pages, and is not keyword stuffed. |
| AI keyword stuffing files | Pass | No obvious keyword-stuffing file or hidden block found. |
| Blocking Google AI/image crawlers | Pass | No `robots.txt` block for Googlebot, Google-Extended, images, CSS, or JavaScript. |
| Checkout/admin indexing | Pass | `/checkout` returns `noindex, nofollow`; `/admin` redirects to login and includes `noindex, nofollow, nocache`. |

## Live Schema Seen On Sample Pages

- Home: `Organization`, `WebSite`, `WebPage`, `FAQPage`, `ImageObject`.
- Design: `Organization`, `WebSite`, `WebPage`, `Service`, `ImageObject`.
- Wedding/branded/custom text pages: `Organization`, `WebSite`, `WebPage`, `FAQPage`, `ImageObject`.
- Pre-made collection: `Organization`, `WebSite`, `WebPage`, `CollectionPage`, `ItemList`, `ListItem`, `ImageObject`.
- Product page: `Organization`, `WebSite`, `WebPage`, `Product`, `Brand`, `Offer`, `ImageObject`.
- Blog post: `Organization`, `WebSite`, `WebPage`, `BlogPosting`, `ImageObject`.

## Recommended Next Steps

1. Add `LocalBusiness` schema, either by changing the global business node from `Organization` to a more specific local business type or by adding a linked `LocalBusiness` node.
2. Add `BreadcrumbList` schema to key hierarchy pages: product pages, design landing pages, blog posts.
3. Add `VideoObject` only if the home/production video is meant to be an indexed content asset.
4. Leave `humans.txt` low priority.
5. Keep `llms.txt` as-is; do not expand it into keyword spam.
