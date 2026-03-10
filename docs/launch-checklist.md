# Launch Checklist

This is the main go-live checklist for moving Roc Candy from the current live website to the new Next.js site.

Use this file as the primary working document.

Related docs:
- [domain-switch-checklist.md](/Users/joeconlin/dev/roccandy/docs/domain-switch-checklist.md)
- [seo-setup.md](/Users/joeconlin/dev/roccandy/docs/seo-setup.md)
- [2026-03-10-admin-users-seo-role.sql](/Users/joeconlin/dev/roccandy/docs/sql/2026-03-10-admin-users-seo-role.sql)
- [2026-03-10-site-pages-seo-fields.sql](/Users/joeconlin/dev/roccandy/docs/sql/2026-03-10-site-pages-seo-fields.sql)
- [2026-03-10-site-redirects.sql](/Users/joeconlin/dev/roccandy/docs/sql/2026-03-10-site-redirects.sql)

## Principles

- Do not change active Google Ads final URLs to the temporary domain.
- Do not build Google Merchant around the temporary domain.
- Prepare everything on staging first, then switch the real domain.
- Keep old URL paths alive with redirects where needed.
- Validate live tracking only after `roccandy.com.au` is serving the new site.

## Phase 1: Database + Admin Setup

- [ ] Run [2026-03-10-admin-users-seo-role.sql](/Users/joeconlin/dev/roccandy/docs/sql/2026-03-10-admin-users-seo-role.sql) in Supabase.
- [ ] Run [2026-03-10-site-pages-seo-fields.sql](/Users/joeconlin/dev/roccandy/docs/sql/2026-03-10-site-pages-seo-fields.sql) in Supabase.
- [ ] Run [2026-03-10-site-redirects.sql](/Users/joeconlin/dev/roccandy/docs/sql/2026-03-10-site-redirects.sql) in Supabase.
- [ ] Confirm the `SEO` role appears in admin users.
- [ ] Assign the SEO person the `SEO` role.
- [ ] Confirm the SEO user can access `/admin/settings/pages`.
- [ ] Confirm the SEO user has read-only access everywhere else intended.

## Phase 2: Content + SEO Content Entry

- [ ] Review and complete the editable site pages in `/admin/settings/pages`.
- [ ] Fill in homepage title, visible intro content, SEO title, meta description, and share image.
- [ ] Fill in About page content and metadata.
- [ ] Fill in FAQ page intro and metadata.
- [ ] Fill in Design page intro and metadata.
- [ ] Fill in Pre-made Candy page intro and metadata.
- [ ] Fill in Wedding landing page content and metadata.
- [ ] Fill in Custom Text landing page content and metadata.
- [ ] Fill in Branded landing page content and metadata.
- [ ] Fill in Contact page content and metadata.
- [ ] Fill in Shipping and Returns content and metadata.
- [ ] Fill in Privacy page title/content/metadata.
- [ ] Fill in Terms page title/metadata.
- [ ] Upload final social/share images to the SEO media library if needed.
- [ ] Check all copy for phone number, email address, and business details accuracy.

## Phase 3: Production Environment Configuration

- [ ] Set `NEXT_PUBLIC_SITE_URL` in production.
- [ ] Set `NEXTAUTH_URL` to the final live domain.
- [ ] Set `GOOGLE_SITE_VERIFICATION` if using Search Console verification.
- [ ] Set `BING_SITE_VERIFICATION` if needed.
- [ ] Set `YANDEX_SITE_VERIFICATION` if needed.
- [ ] Set `NEXT_PUBLIC_GA_MEASUREMENT_ID`.
- [ ] Set `NEXT_PUBLIC_GTM_ID` if GTM will be used.
- [ ] Decide whether GA4 is controlled directly, via GTM, or both.
- [ ] Avoid double tracking between direct GA4 and GTM.
- [ ] Set live Square credentials.
- [ ] Set live PayPal credentials.
- [ ] Set all email-related env vars and recipients.
- [ ] Confirm WooCommerce API credentials are correct for production.
- [ ] Confirm Supabase production env vars are correct.

## Phase 4: Payments + Order Flow

- [ ] Confirm the site is not using sandbox payment configuration in production.
- [ ] Test a Square payment on staging if possible.
- [ ] Test a PayPal payment on staging if possible.
- [ ] Confirm successful payments create Woo orders.
- [ ] Confirm successful payments create Supabase orders.
- [ ] Confirm Woo order totals, line items, and statuses look correct.
- [ ] Confirm admin email notifications are received.
- [ ] Confirm customer email notifications are received.
- [ ] Confirm refunds / payment failure flow are acceptable.

## Phase 5: Tracking + Ads Conversion Setup

- [ ] Confirm `add_to_cart` is firing in GA4 DebugView.
- [ ] Confirm `begin_checkout` is firing in GA4 DebugView.
- [ ] Confirm `purchase` is firing in GA4 DebugView after successful payment.
- [ ] Confirm purchase transaction IDs are present and stable.
- [ ] Link GA4 and Google Ads if not already linked.
- [ ] Mark `purchase` as a GA4 key event.
- [ ] Import the GA4 `purchase` conversion into Google Ads.
- [ ] Enable auto-tagging in Google Ads.
- [ ] Decide whether the imported purchase conversion should be primary for bidding.
- [ ] Do not point active ads to `vercel.app`.
- [ ] Do not switch ad landing page URLs to the new structure until live validation is complete.
- [ ] Plan enhanced conversions as a follow-up task after base purchase tracking is validated.

## Phase 6: SEO Technical Checks

- [ ] Confirm `/sitemap.xml` loads on staging.
- [ ] Confirm `/robots.txt` loads on staging.
- [ ] Confirm sitemap includes homepage, core pages, landing pages, and active pre-made products.
- [ ] Confirm admin, checkout, docs, and non-index pages are excluded or `noindex`.
- [ ] Confirm canonical URLs are correct.
- [ ] Confirm Open Graph / share metadata renders correctly.
- [ ] Confirm structured data is present on key pages.
- [ ] Confirm the temporary domain is not the domain you will submit to Google systems as the real site.

## Phase 7: Redirect Mapping

- [ ] Export or list all important old live URLs.
- [ ] Gather current Google Ads landing page URLs.
- [ ] Gather important SEO/indexed URLs from the old site.
- [ ] Gather any high-value backlinks / campaign pages if known.
- [ ] Add redirect rules in the SEO admin for each old URL that will no longer exist.
- [ ] Prioritize old ad landing pages first.
- [ ] Test each redirect manually on staging or preview if possible.
- [ ] Avoid redirecting everything to the homepage.
- [ ] Send each old URL to the closest matching new URL.

## Phase 8: Merchant Center Preparation

- [ ] Decide whether Merchant will use only pre-made products.
- [ ] Confirm pre-made product pages are live-ready and indexable.
- [ ] Confirm shipping / returns page is complete.
- [ ] Confirm contact page is complete.
- [ ] Confirm product pricing, availability, brand, and category data are correct.
- [ ] Confirm Merchant Center website claim/verification is tied to the real domain, not staging.
- [ ] Prepare feed / crawl strategy for Merchant Center.
- [ ] Do not point Merchant product URLs at `vercel.app`.

## Phase 9: Search Console Preparation

- [ ] Add or confirm the Search Console property for the real domain.
- [ ] Verify the property using token or DNS.
- [ ] Prepare to submit `/sitemap.xml` after cutover.
- [ ] Do not treat the temporary domain as the main indexed property.

## Phase 10: Vercel + Domain + Infrastructure

- [ ] Add `roccandy.com.au` and `www.roccandy.com.au` to Vercel.
- [ ] Confirm which domain is primary.
- [ ] Confirm apex vs `www` redirect behavior.
- [ ] Update `KEEPALIVE_URL` in GitHub Actions if applicable.
- [ ] Update Cloudflare DNS to point the live domain at Vercel when ready.
- [ ] Keep `woo.roccandy.com.au` pointing where it currently needs to point.
- [ ] Confirm Supabase Auth site URL / redirect URLs if used.
- [ ] Confirm Apple Pay domain verification file exists on the live site path.

## Phase 11: Pre-Launch QA On Staging

- [ ] Test homepage on desktop and mobile.
- [ ] Test About page on desktop and mobile.
- [ ] Test FAQ page on desktop and mobile.
- [ ] Test Design page on desktop and mobile.
- [ ] Test Wedding landing page on desktop and mobile.
- [ ] Test Custom Text landing page on desktop and mobile.
- [ ] Test Branded landing page on desktop and mobile.
- [ ] Test Pre-made Candy listing page on desktop and mobile.
- [ ] Test several pre-made product pages.
- [ ] Test Contact page.
- [ ] Test Shipping and Returns page.
- [ ] Test Privacy page.
- [ ] Test Terms page.
- [ ] Test 404 page.
- [ ] Test cart add/remove/update.
- [ ] Test custom order flow from designer to checkout.
- [ ] Test pre-made order flow from product page to checkout.
- [ ] Test payment success flow.
- [ ] Test redirect rules that are already entered.

## Phase 12: Launch Day

- [ ] Freeze non-essential changes before cutover.
- [ ] Confirm final env vars are present in production.
- [ ] Confirm production deployment is healthy before DNS cutover.
- [ ] Switch the real domain to the new site.
- [ ] Confirm the homepage loads on the live domain.
- [ ] Confirm top landing pages load on the live domain.
- [ ] Confirm top pre-made product pages load on the live domain.
- [ ] Confirm old ad landing pages redirect correctly on the live domain.
- [ ] Confirm checkout loads on the live domain.
- [ ] Run a live payment test if operationally safe.
- [ ] Confirm `purchase` appears in GA4 for the live-domain order.
- [ ] Confirm Woo order is created for the live-domain order.
- [ ] Confirm emails send for the live-domain order.
- [ ] Submit or resubmit `/sitemap.xml` in Search Console.
- [ ] Refresh or fetch Merchant data after cutover if using Merchant Center.

## Phase 13: First 24-72 Hours After Launch

- [ ] Check GA4 realtime and DebugView.
- [ ] Check Google Ads conversion diagnostics.
- [ ] Check Merchant diagnostics.
- [ ] Check Search Console coverage and URL inspection.
- [ ] Check for 404s and missing redirects.
- [ ] Check payment failures.
- [ ] Check Woo order creation consistency.
- [ ] Check admin/customer email delivery.
- [ ] Check mobile usability and live customer journey again.
- [ ] Only after validation, consider updating ad final URLs directly to the preferred new landing pages.

## Phase 14: Follow-Up Improvements After Stable Launch

- [ ] Add enhanced conversions for Google Ads.
- [ ] Add `view_item` event for fuller ecommerce tracking.
- [ ] Add product-level editable SEO fields for pre-made product pages if required.
- [ ] Replace remaining public-page `<img>` usage where performance matters.
- [ ] Review Merchant feed quality and product metadata depth.
- [ ] Review whether Woo is still needed after the new stack stabilizes.

## Final Go/No-Go Questions

- [ ] Can a customer land on the live domain and browse key pages successfully?
- [ ] Can a customer add products and custom orders to cart successfully?
- [ ] Can a customer complete payment successfully?
- [ ] Is the order saved in Supabase and mirrored into Woo?
- [ ] Are admin and customer emails being sent?
- [ ] Are purchase conversions being recorded?
- [ ] Are old important URLs redirecting correctly?
- [ ] Are the core SEO pages editable by the SEO user?
- [ ] Is the live domain, not the temp domain, the one connected to Google systems?

If all of the above are true, the site is in a workable state to go live.
