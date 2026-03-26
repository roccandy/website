# SEO Recommendations Checklist

This document turns Damien's SEO email into a working checklist.

How to use it:

- `Repo status` = what is true in the current codebase/staging setup.
- `Project decision` = what you decide to do next.
- Use `Pending`, `Done`, or `Deferred`.
- If you defer something, write why in `Reason / next step`.

## Sitemap / Page Structure

| Recommendation | Repo status | What exists now | Project decision | Reason / next step |
| --- | --- | --- | --- | --- |
| Staging site available | Implemented | `https://roccandy.vercel.app` exists and is reviewable. | Pending | |
| Homepage `/` | Implemented | Exists with SEO metadata, schema, CTA, and editable SEO/content fields. | Pending | Finalise homepage copy, SEO title, meta description, and share image in admin. |
| Design Your Candy `/design/` | Implemented | Exists and is editable from the SEO panel. | Pending | Finalise intro/meta copy and verify live canonical output on the production domain. |
| Wedding Candy `/design/wedding-candy/` | Implemented | Exists as a proper landing page and links into the designer. | Pending | Final content/SEO review and launch QA. |
| Branded / Logo Candy `/design/branded-logo-candy/` | Implemented | Exists as a proper landing page. | Pending | Final content/SEO review and launch QA. |
| Custom Text Candy `/design/custom-text-candy/` | Implemented | Exists as a proper landing page. | Pending | Final content/SEO review and launch QA. |
| Occasions hub `/occasions/` | Not implemented | No occasions hub page exists. | Pending | Create only if you want a real content program for occasions. |
| Occasion subpages like `/occasions/baby-shower/`, corporate, birthday, anniversary, Christmas, Halloween | Not implemented | These pages do not exist. | Pending | Only build if you can write useful unique copy; avoid thin pages. |
| Pre Made Candy `/pre-made-candy/` | Implemented | Exists and is SEO-editable at collection-page level. | Pending | Final collection-page content/meta review. |
| Each pre-made product has its own page | Implemented | Individual product pages exist. | Pending | Fill in per-product SEO fields for priority products. |
| About Us `/about/` | Implemented | Exists and is editable from the SEO panel. | Pending | Final content/metadata review. |
| FAQs `/faqs/` | Implemented | FAQ page now lives at `/faqs`, with `/faq` kept as a compatibility redirect. | Pending | Final content/metadata review and launch QA. |
| Blog `/blog/` | Partially implemented | A real `/blog` route now exists and is editable from the SEO panel as a fixed site page. | Pending | Decide whether to keep it as a landing page or later add individual article publishing. |
| Destination pages `/sydney/`, `/melbourne/`, `/perth/` etc | Not implemented | These pages do not exist. | Pending | Only build if there is a real local-content plan. |
| Contact Us `/contact/` | Implemented | Exists and is editable from the SEO panel. | Pending | Final content/metadata review. |

## SEO & UX

| Recommendation | Repo status | What exists now | Project decision | Reason / next step |
| --- | --- | --- | --- | --- |
| Clear homepage value proposition above the fold + CTA | Implemented | Homepage has headline, supporting copy, and strong design CTA. | Pending | Final wording polish only. |
| USP on homepage | Partially implemented | Homepage has USP-style messaging and benefit labels. | Pending | Review whether the final wording is exactly what you want. |
| H-tag structure | Implemented | Core public templates now use a single visible H1 per page more consistently, the main designer no longer duplicates H1s, and the SEO editor now steers content authors to H2/H3 only. | Pending | Do a final rendered QA pass on key pages after content is finalised. |
| URLs short, lowercase, hyphenated, descriptive | Implemented | SEO landing pages are clean, and internal designer state URLs now use a tidier `type` + `variant` scheme. | Pending | Keep using landing pages as SEO/ad entry points rather than raw designer URLs. |
| Static rather than dynamic URLs | Implemented | Landing pages are the intended public/indexable URLs; stateful designer variants are now normalised and treated as utility URLs. | Pending | Do a final live-domain QA pass to confirm canonicals and noindex behave as expected. |
| 300-500 words minimum on product/category pages | Partially implemented | Landing pages have meaningful body copy; not every page has been audited against this target. | Pending | Review and expand thin priority pages. |
| FAQs at the bottom of category/product pages | Implemented | Site pages can now select shared FAQ library items and render them at the bottom of the page with page-specific FAQ schema. | Pending | Apply the new site-page FAQ migration, then choose the most relevant FAQ items for the key landing/category pages in admin. |
| Image optimisation | Partially implemented | Many assets are handled well, the homepage feature video has now been re-encoded from roughly `10 MB` down to about `3.1 MB`, and superseded homepage media variants / unused starter assets have been removed from the repo. Not every image/video asset has been fully audited yet. | Pending | Continue compressing oversized assets and checking performance, especially any remaining landing/product media. |
| Descriptive file names | Partially implemented | Some assets are good; this has not been fully audited sitewide. | Pending | Review key landing/product images. |
| Alt text includes meaningful product description / keywords naturally | Partially implemented | Some alt text is fine; no full audit has been completed. | Pending | Review important landing/product images manually. |
| Page speed / caching / minification / CDN | Implemented | Next.js + Vercel gives a strong baseline, public pages now use ISR-style caching instead of forced `no-store`, static assets have long-lived cache headers, and Next image delivery is configured for AVIF/WebP plus a longer cache TTL. The cart store no longer wraps the entire app at the root, and the cart drawer is now lazy-loaded as a separate client chunk. The homepage feature video has also been re-encoded from roughly `10 MB` to about `3.1 MB`. Lab checks are strong: `roccandy.vercel.app` home desktop `90`, home mobile `91`, wedding landing desktop `93`; local production build home desktop `99`, home mobile `92`. | Done | Only re-run on the final production domain for launch sign-off. The remaining measurable issue is a modest shared unused-JS chunk, but there is no obvious major performance bottleneck left in the public path. |
| Core Web Vitals targets | Partially implemented | No confirmed live CWV pass yet. | Pending | Test on the live domain after cutover. |
| Mobile first / mobile-friendly | Partially implemented | The site has had clear mobile work, but still needs formal QA. | Pending | Run device QA and Google mobile testing. |
| Custom 404 page | Implemented | A proper custom 404 page exists with useful links back into the site. | Pending | Launch QA only. |

## Additional UX / Marketing Recommendations

| Recommendation | Repo status | What exists now | Project decision | Reason / next step |
| --- | --- | --- | --- | --- |
| Google Reviews floating widget sitewide (Trustindex) | Not implemented | No Trustindex / floating reviews widget is present. | Pending | Add only if you want the paid widget and accept the UX impact. |
| Social links in the footer | Implemented | Footer includes Facebook, Instagram, phone, and email links. | Pending | No major work needed beyond launch QA. |
| Strip banner at the top like `Free Delivery Australia-Wide` | Partially implemented | There is a top links bar, but not really the promo banner he described. | Pending | Decide whether to replace/augment the current top bar with a real promo strip. |
| Add USPs across all top-level pages | Implemented | The homepage, key top-level pages, and main landing/fixed public pages now share a consistent USP block highlighting Vegan, Gluten Free, Dairy Free, Handmade, Aust Made, and Free Delivery. | Done | Do a final content/design QA pass on the live domain after launch. |

## Notes

- The current app is much closer to Damien's requested structure than the original version he reviewed.
- A core hardening/simplification pass has now landed underneath the public site: explicit Supabase admin/public clients, explicit managed-content sync instead of write-on-read behavior, centralized paid-order finalization, a shared public header shell, and a real `npm test` gate.
- The biggest remaining gaps are not core technical SEO anymore; they are missing content sections and launch validation.
- The most obvious still-missing items from his email are:
  - individual blog article publishing if you want the blog to become an active content channel
  - occasions pages
  - location pages
  - reviews widget
  - full USP rollout across top-level pages
  - live-domain validation for speed, indexing, ads, and tracking
