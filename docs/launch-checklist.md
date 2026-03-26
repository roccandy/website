# Launch Checklist

This is the main go-live checklist for moving Roc Candy from the current live website to the new Next.js site.

Use this file as the primary working document.

Related docs:
- [domain-switch-checklist.md](/Users/joeconlin/dev/roccandy/docs/domain-switch-checklist.md)
- [architecture-notes.md](/Users/joeconlin/dev/roccandy/docs/architecture-notes.md)
- [seo-setup.md](/Users/joeconlin/dev/roccandy/docs/seo-setup.md)
- [seo-recommendations-checklist.md](/Users/joeconlin/dev/roccandy/docs/seo-recommendations-checklist.md)
- [2026-03-24-schema-health-check.sql](/Users/joeconlin/dev/roccandy/docs/sql/2026-03-24-schema-health-check.sql)
- [2026-03-25-function-search-path-hardening.sql](/Users/joeconlin/dev/roccandy/docs/sql/2026-03-25-function-search-path-hardening.sql)
- [2026-03-25-rls-audit.sql](/Users/joeconlin/dev/roccandy/docs/sql/2026-03-25-rls-audit.sql)
- [2026-03-24-rls-hardening.sql](/Users/joeconlin/dev/roccandy/docs/sql/2026-03-24-rls-hardening.sql)
- [2026-03-24-policy-cleanup.sql](/Users/joeconlin/dev/roccandy/docs/sql/2026-03-24-policy-cleanup.sql)
- [2026-03-10-admin-users-seo-role.sql](/Users/joeconlin/dev/roccandy/docs/sql/2026-03-10-admin-users-seo-role.sql)
- [2026-03-10-site-pages-seo-fields.sql](/Users/joeconlin/dev/roccandy/docs/sql/2026-03-10-site-pages-seo-fields.sql)
- [2026-03-10-site-redirects.sql](/Users/joeconlin/dev/roccandy/docs/sql/2026-03-10-site-redirects.sql)
- [2026-03-24-premade-candies-seo-fields.sql](/Users/joeconlin/dev/roccandy/docs/sql/2026-03-24-premade-candies-seo-fields.sql)
- [2026-03-25-site-pages-faq-selection.sql](/Users/joeconlin/dev/roccandy/docs/sql/2026-03-25-site-pages-faq-selection.sql)

## Current Repo Status

These items are already implemented in code:

- [x] Generated `sitemap.xml`, `robots.txt`, canonicals, Open Graph, Twitter cards, and structured data.
- [x] Added `/llms.txt` for AI/GEO crawlers.
- [x] `vercel.app` hosts now send `X-Robots-Tag: noindex, nofollow, noarchive`.
- [x] Public canonical/sitemap base URL no longer falls back to ad-hoc `VERCEL_URL` preview hosts.
- [x] Public marketing/product pages now use ISR-style caching instead of forced `no-store` rendering.
- [x] Static public assets have long-lived cache headers, and Next image delivery is configured for modern formats plus a higher cache TTL.
- [x] The homepage feature video now uses a re-encoded full-length web asset at roughly `3.1 MB` instead of the older `10 MB` file, while still eager-loading for fast playback.
- [x] Cart state no longer wraps the entire app in the root layout, and the cart drawer now loads as a deferred client chunk instead of inflating the main public render path.
- [x] Supabase access is now split into explicit admin and public clients, and the server/admin client no longer falls back to the anon key if `SUPABASE_SERVICE_ROLE_KEY` is missing.
- [x] Public managed-content and redirect reads now use the explicit public Supabase client, while privileged writes stay on the explicit admin client.
- [x] Site pages, FAQs, and terms are now pure reads at request time; built-in content sync/backfill happens explicitly via `npm run sync-managed-content`.
- [x] Square and PayPal now share one paid-order finalization service for Woo creation, Supabase inserts, and email sending.
- [x] The repeated public top-bar/header shell now lives in one shared component instead of being duplicated across major public pages.
- [x] `QuoteBuilder` and `OrdersTable` have been broken up with extracted shared modules/components to reduce monolith risk without changing public behavior.
- [x] A real test gate now exists with `npm test` (Vitest) covering designer URL logic, redirect normalization, managed-content sync, and paid-order finalization.
- [x] Unused starter SVGs, dead GSAP-based components, and superseded homepage media variants have been removed from the repo.
- [x] SEO/admin workspace for fixed site pages.
- [x] Site pages can now select shared FAQ library items to render page-specific FAQ sections without duplicating FAQ copy.
- [x] SEO role with read-only access outside SEO-editable sections.
- [x] Redirect manager in the SEO workspace.
- [x] SEO workspace simplified to direct image uploads on pages/products, without a separate media-library tab.
- [x] Individual SEO landing pages for wedding, custom text, branded, contact, shipping/returns.
- [x] Public FAQ now uses `/faqs`, with `/faq` redirected for compatibility.
- [x] A real `/blog` route now exists as an editable fixed site page.
- [x] Core public pages now use a cleaner heading hierarchy, with the main designer duplicate-H1 issue removed.
- [x] Main public landing and top-level pages now share a consistent USP block.
- [x] Designer state URLs now use a tidier `type` + `variant` scheme, with legacy params redirected.
- [x] Stateful designer URLs are treated as utility URLs with canonical/noindex behavior pointing back to the main landing pages.
- [x] Individual pre-made product pages with Product schema.
- [x] Per-product SEO fields for pre-made product pages in the SEO workspace.
- [x] Ecommerce events for `view_item` on pre-made product pages, plus `add_to_cart`, `begin_checkout`, and `purchase`.
- [x] Analytics loader now prefers GTM over direct GA4 when both IDs are configured, reducing duplicate tracking risk.

## Supabase Status

The current live Supabase project has been checked directly against the app.

- [x] Core SEO/content tables exist: `site_pages`, `site_faqs`, `site_terms_items`, `site_redirects`, `admin_users`.
- [x] Current SEO/product schema columns exist, including pre-made product SEO fields.
- [x] `flavors`, `label_types`, and `payment_failures` now have the expected RLS/policies.
- [x] Public helper functions `is_admin` and `set_admin_users_updated_at` now use an explicit `search_path` to satisfy Security Advisor hardening warnings.
- [x] The schema health check currently returns all `OK` on the live project.
- [x] Redundant duplicate policies on `orders` and `production_slots` have a cleanup script.
- [x] Cleanup audit found no safe public-table deletions to make right now.
- [x] The active website/admin paths now use `admin_users` + NextAuth with the explicit server admin client, and no active app path relies on `user_roles` / `is_admin()` for its normal behavior.
- [ ] Transitional DB SQL/RLS artifacts still reference `is_admin(auth.uid())`.
- [ ] Transitional compatibility objects like `user_roles` and `is_admin()` still exist in the database and legacy SQL docs.

Important caveat:

- This is no longer an active app-path blocker because the app now uses explicit server-admin writes and `admin_users` + NextAuth.
- It does mean the DB still contains legacy transitional admin-policy artifacts that are independent from the website login model.
- Do not delete `user_roles` or rewrite `is_admin()` casually before a dedicated transitional cleanup/replacement pass.

These items are still manual / launch work:

- [x] Required core SQL/schema changes are present on the live project.
- [ ] Enter final page and product SEO content in admin.
- [ ] Set production env vars.
- [ ] Validate payments, Woo mirroring, and emails.
- [ ] Configure GA4 / Google Ads / Search Console / Merchant on the real domain.
- [ ] Build the redirect map from old URLs.
- [ ] Switch the real domain to the new site and validate live behavior.

## Remaining High-Priority Actions

If you want the shortest realistic list between now and launch, it is:

- [ ] Finish page and product SEO content in admin.
- [ ] Set all production env vars in Vercel.
- [ ] Validate live payment config, Woo mirroring, and emails.
- [ ] Verify GA4/Ads setup on the real domain.
- [ ] Build and enter the redirect map from the old site.
- [ ] Cut the domain over and run launch-day QA.

## Principles

- Do not change active Google Ads final URLs to the temporary domain.
- Do not build Google Merchant around the temporary domain.
- Prepare everything on staging first, then switch the real domain.
- Keep old URL paths alive with redirects where needed.
- Validate live tracking only after `roccandy.com.au` is serving the new site.

## Phase 1: Database + Admin Setup

- [x] Add explicit admin/public Supabase clients and remove the service-role-to-anon fallback.
- [x] Run [2026-03-24-schema-health-check.sql](/Users/joeconlin/dev/roccandy/docs/sql/2026-03-24-schema-health-check.sql) against the live project and confirm it returns all `OK`.
- [x] Add [2026-03-25-rls-audit.sql](/Users/joeconlin/dev/roccandy/docs/sql/2026-03-25-rls-audit.sql) for quickly separating real app RLS issues from Supabase internal-schema alerts.
- [x] Apply [2026-03-25-function-search-path-hardening.sql](/Users/joeconlin/dev/roccandy/docs/sql/2026-03-25-function-search-path-hardening.sql) to address Security Advisor function warnings.
- [x] Apply [2026-03-24-rls-hardening.sql](/Users/joeconlin/dev/roccandy/docs/sql/2026-03-24-rls-hardening.sql) to the live project.
- [x] Apply [2026-03-24-policy-cleanup.sql](/Users/joeconlin/dev/roccandy/docs/sql/2026-03-24-policy-cleanup.sql) to remove redundant duplicate policies.
- [x] Confirm the live project includes the outcomes from [2026-03-10-admin-users-seo-role.sql](/Users/joeconlin/dev/roccandy/docs/sql/2026-03-10-admin-users-seo-role.sql).
- [x] Confirm the live project includes the outcomes from [2026-03-10-site-pages-seo-fields.sql](/Users/joeconlin/dev/roccandy/docs/sql/2026-03-10-site-pages-seo-fields.sql).
- [x] Confirm the live project includes the outcomes from [2026-03-10-site-redirects.sql](/Users/joeconlin/dev/roccandy/docs/sql/2026-03-10-site-redirects.sql).
- [x] Confirm the live project includes the outcomes from [2026-03-24-premade-candies-seo-fields.sql](/Users/joeconlin/dev/roccandy/docs/sql/2026-03-24-premade-candies-seo-fields.sql).
- [x] Apply [2026-03-25-site-pages-faq-selection.sql](/Users/joeconlin/dev/roccandy/docs/sql/2026-03-25-site-pages-faq-selection.sql) to add page-level FAQ selection fields.
- [ ] Confirm the `SEO` role appears in the admin users screen.
- [ ] Assign the SEO person the `SEO` role.
- [ ] Confirm the SEO user can access `/admin/settings/pages`.
- [ ] Confirm the SEO user has read-only access everywhere else intended.

## Phase 2: Content + SEO Content Entry

- [x] Site pages, FAQs, and terms now render without mutating the database during normal reads.
- [x] Built-in content sync/backfill now exists as an explicit command: `npm run sync-managed-content`.
- [ ] Review and complete the editable site pages in `/admin/settings/pages`.
- [ ] Fill in homepage title, visible intro content, SEO title, meta description, and share image.
- [x] Default homepage meta description in code is now within typical SERP length.
- [ ] Review the final homepage meta description in admin and keep it roughly 150-155 characters.
- [ ] Fill in About page content and metadata.
- [ ] Fill in FAQ page intro and metadata.
- [ ] Select relevant FAQ library items on the key landing and category pages that should show FAQs on-page.
- [ ] Fill in Blog page content and metadata.
- [ ] Fill in Design page intro and metadata.
- [ ] Fill in Pre-made Candy page intro and metadata.
- [ ] Fill in Wedding landing page content and metadata.
- [ ] Fill in Custom Text landing page content and metadata.
- [ ] Fill in Branded landing page content and metadata.
- [ ] Fill in Contact page content and metadata.
- [ ] Fill in Shipping and Returns content and metadata.
- [ ] Fill in Privacy page title/content/metadata.
- [ ] Fill in Terms page title/metadata.
- [ ] Fill in pre-made product SEO title / meta description / social image where needed.
- [ ] Upload final social/share images directly within the relevant page/product SEO editors if needed.
- [ ] Check all copy for phone number, email address, and business details accuracy.

## Phase 3: Production Environment Configuration

- [ ] Set `NEXT_PUBLIC_SITE_URL` in production.
- [ ] Set `NEXTAUTH_URL` to the final live domain.
- [ ] Set `GOOGLE_SITE_VERIFICATION` if using Search Console verification.
- [ ] Set `BING_SITE_VERIFICATION` if needed.
- [ ] Set `YANDEX_SITE_VERIFICATION` if needed.
- [ ] Set `NEXT_PUBLIC_GA_MEASUREMENT_ID`.
- [ ] Set `NEXT_PUBLIC_GTM_ID` if GTM will be used.
- [ ] Decide whether GA4 is controlled directly or via GTM.
- [x] Code now avoids loading direct GA4 when GTM is present.
- [ ] Set live Square credentials.
- [ ] Set live PayPal credentials.
- [ ] Set all email-related env vars and recipients.
- [ ] Confirm WooCommerce API credentials are correct for production.
- [ ] Confirm Supabase production env vars are correct.

## Phase 4: Payments + Order Flow

- [x] Square and PayPal paid-order routes now share one finalization service for Woo order creation, Supabase inserts, and email sending.
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

- [x] `view_item` is implemented for pre-made product pages.
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
- [x] Run lab Lighthouse checks on the staging/live deployment and record a baseline.
  Current baseline on `roccandy.vercel.app`: home desktop `90`, home mobile `91`, wedding landing desktop `93`.
- [x] Run a local production-build performance check after the deeper bundle cleanup.
  Current local production baseline on `127.0.0.1`: home desktop `99`, home mobile `92`.
- [ ] Confirm sitemap includes homepage, core pages, landing pages, and active pre-made products.
- [ ] Confirm admin, checkout, docs, and non-index pages are excluded or `noindex`.
- [ ] Confirm staging / preview deployments are not indexable by search engines.
- [ ] Confirm canonical URLs are correct.
- [ ] Confirm no canonical tags point at ad-hoc Vercel preview hosts.
- [ ] Confirm Open Graph / share metadata renders correctly.
- [ ] Confirm structured data is present on key pages.
- [x] Public pages now revalidate on a short cache window rather than bypassing caching entirely.
- [ ] Confirm the temporary domain is not the domain you will submit to Google systems as the real site.
- [x] Publish `/llms.txt` for AI/GEO crawler guidance.
- [ ] Re-run Lighthouse / CWV checks on the final production domain after cutover, because the real benchmark is `roccandy.com.au` with production CDN and CrUX behavior.

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
- [ ] Confirm pre-made product SEO fields have been filled for the priority products.
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
- [x] `npm test` now exists and should be run alongside `npm run lint` and `npm run build` before major merges or launch changes.
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
- [ ] Expand `view_item` tracking if you want collection-page/product-list coverage as well.
- [ ] Replace remaining public-page `<img>` usage where performance matters.
- [ ] Review Merchant feed quality and product metadata depth.
- [ ] Review whether Woo is still needed after the new stack stabilizes.
- [ ] Plan a dedicated admin auth/RLS migration if you want DB-native admin permissions to match the website admin login.

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
