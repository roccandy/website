# Launch Steps

Single ordered runbook for launching Roc Candy.

Rule for this document:

- `roccandy.vercel.app` must keep working right up until cutover.
- Admin auth must keep working right up until cutover.
- Any change that would break `roccandy.vercel.app` stays in the post-cutover section.

Last reviewed against the live production site on `2026-04-29`.

## Use This Document

Work from top to bottom.

- Do not skip ahead.
- Do not change post-cutover items early.
- Tick each item off only after it is actually done.

## Phase 1: Finish Launch Content And Redirect Prep

- [x] Complete the editable site pages in `/admin/settings/pages`.
- [x] Finalise homepage content, SEO title, meta description, and share image.
- [x] Finalise About page content and metadata.
- [x] Finalise FAQ page intro and metadata.
- [x] Finalise Blog landing page content and metadata.
- [x] Finalise Design page intro and metadata.
- [x] Finalise Pre-made Candy page intro and metadata.
- [x] Finalise Wedding landing page content and metadata.
- [x] Finalise Custom Text landing page content and metadata.
- [x] Finalise Branded landing page content and metadata.
- [x] Finalise Contact page content and metadata.
- [x] Finalise Shipping and Returns content and metadata.
- [x] Finalise Privacy page content and metadata.
- [x] Finalise Terms page metadata.
- [x] Fill in pre-made product SEO fields for priority products.
- [x] Upload final page/product social images where needed.
- [x] Choose relevant FAQ items for the key landing/category pages.
- [x] Gather old live URLs that need redirects.
- [x] Gather Google Ads landing page URLs.
- [x] Gather important indexed URLs and known campaign/backlink URLs.
- [x] Enter the redirect map into the SEO workspace.
- [x] Check business phone, email, and contact details across edited pages.

## Phase 2: Confirm Database And Admin Preconditions

- [x] Confirm the live Supabase schema is aligned with `docs/sql/`.
- [x] Run [2026-03-24-schema-health-check.sql](/Users/joeconlin/dev/roccandy/docs/sql/2026-03-24-schema-health-check.sql) if you want a final DB confidence pass.
- [x] Confirm the `SEO` role exists in admin if needed.
- [x] Confirm any SEO-only user can access `/admin/settings/pages`.
- [x] Confirm any SEO-only user is read-only everywhere else intended.
- [x] Finalise production settings and blocked dates in `/admin/settings/production`.

## Phase 3: Set Safe Pre-Cutover Production Env Vars

These are the env-var changes you can make before cutover without breaking `roccandy.vercel.app`.

### Core Site / Auth

- [x] Set `NEXT_PUBLIC_SITE_URL=https://roccandy.com.au` in Vercel `Production`.
- [x] Set `SITE_URL=https://roccandy.com.au` only if you intentionally use that fallback env in Vercel.
- [x] Confirm `NEXTAUTH_SECRET` is set in Vercel `Production`.
- [x] Do not change `NEXTAUTH_URL` yet.

### Preview Crawl / Temporary SEO Audit Flags

- [x] Confirm `ALLOW_PREVIEW_CRAWL` is unset or `false` for normal production use.
- [x] Confirm `PREVIEW_SITE_URL` is not left on for launch mode.
- [x] Confirm `NEXT_PUBLIC_PREVIEW_SITE_URL` is not left on for launch mode.

### Tracking / Verification

- [ ] Set `NEXT_PUBLIC_GA_MEASUREMENT_ID` if using direct GA4.
- [X] Set `NEXT_PUBLIC_GTM_ID` if using GTM.
- [x] Decide whether GTM or direct GA4 is the source of truth.
- [ ] Set `GOOGLE_SITE_VERIFICATION` if using HTML-tag verification.
- [ ] Set `BING_SITE_VERIFICATION` if needed.
- [ ] Set `YANDEX_SITE_VERIFICATION` if needed.

### Square

- [x] Replace `NEXT_PUBLIC_SQUARE_APP_ID` with the live app ID.
- [x] Replace `NEXT_PUBLIC_SQUARE_LOCATION_ID` with the live location ID.
- [x] Set `NEXT_PUBLIC_SQUARE_ENV=production`.
- [x] Replace `SQUARE_ACCESS_TOKEN` with the live access token.
- [x] Replace `SQUARE_LOCATION_ID` with the live location ID.
- [x] Clear `SQUARE_API_BASE` if it still points at sandbox, or set it to `https://connect.squareup.com`. #set to squareup

### PayPal

- [x] Replace `NEXT_PUBLIC_PAYPAL_CLIENT_ID` with the live client ID.
- [x] Set `NEXT_PUBLIC_PAYPAL_ENV=production`.
- [x] Set `PAYPAL_ENV=production` if you use the server-side env explicitly.
- [x] Replace `PAYPAL_SECRET` with the live secret.
- [x] Clear `PAYPAL_API_BASE` if it still points at sandbox, or set it to `https://api-m.paypal.com`.

### Supabase

- [x] Confirm `NEXT_PUBLIC_SUPABASE_URL`.
- [x] Confirm `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- [x] Confirm `SUPABASE_SERVICE_ROLE_KEY`.

### WooCommerce

- [x] Confirm `WOO_BASE_URL=https://woo.roccandy.com.au`.
- [x] Confirm `WOO_CONSUMER_KEY`.
- [x] Confirm `WOO_CONSUMER_SECRET`.
- [x] Confirm `WOO_AUTH_METHOD`.
- [x] Confirm `WOO_CUSTOM_PRODUCT_ID`.
- [x] Confirm `WOO_WEBHOOK_SECRET`.

### Email

- [x] Confirm `SMTP_HOST`.
- [x] Confirm `SMTP_PORT`.
- [x] Confirm `SMTP_USER`.
- [x] Confirm `SMTP_PASS`.
- [x] Confirm `SMTP_FROM`.
- [x] Confirm `SMTP_SECURE`.
- [x] Confirm `SMTP_ENABLED`.
- [x] Confirm `ORDERS_EMAIL`.
- [x] Confirm `ENQUIRIES_EMAIL`. #not added.

## Phase 4: Prepare Vercel Domains Without Cutting Over

- [x] Add `roccandy.com.au` to Vercel.
- [x] Add `www.roccandy.com.au` to Vercel.
- [x] Make `roccandy.com.au` the intended primary domain in Vercel.
- [x] Configure `www` to redirect to the apex domain.
- [x] Do not change DNS yet.

## Phase 5: Redeploy Production And Test On `roccandy.vercel.app`

- [x] Redeploy Vercel `Production` after the safe env changes above.
- [x] Open the production deployment on `roccandy.vercel.app`.
- [x] Confirm the public site still works on `roccandy.vercel.app`.
- [x] Confirm admin still works on `roccandy.vercel.app`.
- [x] Confirm the admin no longer shows the sandbox banner.
- [x] Confirm `/sitemap.xml` loads.
- [x] Confirm `/robots.txt` loads.
- [x] Confirm canonicals use `roccandy.com.au` and not a random preview host.
- [x] Confirm preview hosts remain non-indexable.

## Phase 6: Run Pre-Cutover Functional QA On `roccandy.vercel.app`

- [x] Test homepage on desktop and mobile.
- [x] Test About page.
- [x] Test FAQ page.
- [x] Test Design page.
- [x] Test Wedding landing page.
- [x] Test Custom Text landing page.
- [x] Test Branded landing page.
- [x] Test Pre-made Candy listing page.
- [x] Test several pre-made product pages.
- [x] Test Contact page.
- [x] Test Shipping and Returns page.
- [x] Test Privacy page.
- [x] Test Terms page.
- [x] Test 404 page.
- [x] Test cart add / remove / update.
- [x] Test custom order flow from designer to checkout.
- [x] Test pre-made order flow from product page to checkout.
- [X] Test redirects already entered in the SEO workspace.

## Phase 7: Run Pre-Cutover Payment QA On `roccandy.vercel.app`

- [x] Run one live Square payment on `roccandy.vercel.app` if operationally safe.
- [x] Run one live PayPal payment on `roccandy.vercel.app` if operationally safe.
- [x] Confirm successful payments create Woo orders.
- [x] Confirm successful payments create Supabase order rows.
- [x] Confirm Woo order totals, line items, and statuses look correct.
- [X] Confirm admin email notifications are received.
- [X] Confirm customer email notifications are received.
- [X] Confirm refunds / payment-failure handling are acceptable.

## Phase 8: Run Pre-Cutover Analytics QA On `roccandy.vercel.app`

- [ ] Confirm `add_to_cart` in GA4 DebugView.
- [ ] Confirm `begin_checkout` in GA4 DebugView.
- [ ] Confirm `purchase` in GA4 DebugView.
- [ ] Confirm purchase transaction IDs are present and stable.
- [ ] Link GA4 and Google Ads if required.
- [ ] Mark `purchase` as a GA4 key event if that is your conversion source.
- [ ] Import the GA4 `purchase` conversion into Google Ads if required.

## Phase 9: Prepare External Services, But Do Not Cut Them Over Yet

### Search Console

- [x] Create the real-domain property for `roccandy.com.au`.
- [x] Verify it now if you are using DNS verification.
- [x] Do not treat `roccandy.vercel.app` as the main indexed property.
- [x] Do not submit the final-domain sitemap yet unless the domain is already live.

### Merchant Center

- [ ] Decide whether Merchant Center will cover pre-made products only.
- [ ] Prepare the account/feed/crawl setup.
- [ ] Do not point Merchant product URLs at `vercel.app`.
- [ ] Do not claim the staging host as the real website.
- [ ] Wait until cutover before refreshing the live crawl/feed.
- [ ] Damien to work on Google Merchant Center account and product feed on Tuesday, May 5, 2026.

### Google Ads

- [ ] Inventory any ad URLs or assets using `roccandy.vercel.app`.
- [ ] Prepare to switch them after cutover if needed.

### Cloudflare

- [x] Prepare the DNS change plan for `@` and `www`.
- [x] Do not move DNS yet.

### GitHub Actions

- [x] Note that `KEEPALIVE_URL` must stay on the current working host until cutover.

### Woo / WordPress

- [x] Note that Woo webhook delivery URL must stay on the current working host until cutover.
- [x] Note that the Woo return/success URL must stay on the current working host until cutover.
- [x] Confirm the current plugin source is [roccandy-woo-redirect.php](/Users/joeconlin/dev/roccandy/wordpress/roccandy-woo-redirect/roccandy-woo-redirect.php).
- [x] Confirm the packaged plugin zips that will need updating after cutover are:
  - [roccandy-woo-redirect.zip](/Users/joeconlin/dev/roccandy/wordpress/roccandy-woo-redirect.zip)
  - [roccandy-woo-redirect-clean.zip](/Users/joeconlin/dev/roccandy/wordpress/roccandy-woo-redirect-clean.zip)

### Square Apple Pay

- [x] Confirm the verification file exists at [apple-developer-merchantid-domain-association](/Users/joeconlin/dev/roccandy/public/.well-known/apple-developer-merchantid-domain-association).
- [x] Wait until cutover before verifying Apple Pay against `roccandy.com.au`.

### Supabase Auth

- [x] If you use Supabase Auth email links or redirect URLs anywhere, note that Site URL / Redirect URLs should be changed after cutover.

## Phase 10: Final Go / No-Go Check Before DNS Cutover

- [x] `roccandy.vercel.app` public site is working.
- [x] `roccandy.vercel.app` admin is working.
- [x] Live payments are working on `roccandy.vercel.app`.
- [x] Woo sync is working.
- [x] Supabase order inserts are working.
- [x] Admin and customer emails are working.
- [ ] GA4 purchase tracking is working.
- [x] Redirect map is entered.
- [x] Vercel domains are prepared.
- [x] Cloudflare DNS plan is ready.
- [x] You are ready to perform the cutover immediately after the next section starts.

If any of the above is false, stop here and fix it before cutover.

## Phase 11: Cutover Actions

Do these in order once you are ready to switch.

### Host / Auth Switch

- [x] In Vercel `Production`, set `NEXTAUTH_URL=https://roccandy.com.au`.
- [x] Redeploy `Production` immediately after changing `NEXTAUTH_URL`.

### DNS Switch

- [x] Update Cloudflare DNS so `@` points to Vercel.
- [x] Update Cloudflare DNS so `www` points to Vercel.
- [x] Confirm `www` redirects to `roccandy.com.au`.
- [x] Keep `woo.roccandy.com.au` unchanged if Woo stays on its current host.

### GitHub Actions

- [ ] Change the GitHub `KEEPALIVE_URL` secret to `https://roccandy.com.au/api/keepalive`.

### Woo / WordPress

- [x] Change the Woo webhook delivery URL to `https://roccandy.com.au/api/woo/webhook`.
- [x] Update the Woo return/success URL from `https://roccandy.vercel.app/checkout/success` to `https://roccandy.com.au/checkout/success`.
- [x] Update [roccandy-woo-redirect.php](/Users/joeconlin/dev/roccandy/wordpress/roccandy-woo-redirect/roccandy-woo-redirect.php) to the live domain.
- [x] Rebuild or replace:
  - [roccandy-woo-redirect.zip](/Users/joeconlin/dev/roccandy/wordpress/roccandy-woo-redirect.zip)
  - [roccandy-woo-redirect-clean.zip](/Users/joeconlin/dev/roccandy/wordpress/roccandy-woo-redirect-clean.zip)
- [x] Re-upload or update the installed WordPress plugin if needed.

### Square Apple Pay

- [x] Verify Apple Pay against `https://roccandy.com.au/.well-known/apple-developer-merchantid-domain-association`.
- [ ] Complete one low-value live Apple Pay checkout in Safari and confirm the Square payment, Roc Candy order, and emails.

### Search Console

- [x] Submit `https://roccandy.com.au/sitemap.xml`.
- [ ] Use URL inspection on the homepage and key landing/product pages.

### Merchant Center

- [ ] Switch the website/product URLs to `https://roccandy.com.au`.
- [ ] Refresh or fetch the feed / crawl.
- [ ] Confirm website claim / verification is tied to the real domain.
- [ ] Damien to work on Merchant Center account and product feed on Tuesday, May 5, 2026.

### Supabase Auth

- [x] If used, set Supabase Auth Site URL to `https://roccandy.com.au` or confirm Supabase Auth is not used.
- [x] If used, add Supabase Auth Redirect URLs for `https://roccandy.com.au/**` or confirm Supabase Auth is not used.

### External Links Still Using `vercel.app`

- [ ] Switch any Google Ads final URLs still using `vercel.app`.
- [ ] Switch any Merchant Center URLs still using `vercel.app`.
- [ ] Switch any email-template, campaign, or profile links under your control that still use `vercel.app`.

## Phase 12: Immediate Post-Cutover Smoke Test

- [x] Homepage loads on `https://roccandy.com.au`.
- [ ] Admin login works on `https://roccandy.com.au`.
- [ ] Admin logout works on `https://roccandy.com.au`.
- [x] Core landing pages load.
- [x] Key pre-made product pages load.
- [x] Old high-value URLs redirect correctly.
- [x] Checkout loads.
- [ ] Run one live payment on the live domain if operationally safe.
- [ ] Confirm Woo order creation from the live domain.
- [ ] Confirm Supabase order rows from the live domain.
- [ ] Confirm admin email delivery from the live domain.
- [ ] Confirm customer email delivery from the live domain.
- [ ] Confirm `purchase` appears in GA4 for the live-domain order.

## Phase 13: Post-Cutover Validation Over The Next 24-72 Hours

### SEO / Indexing

- [x] Confirm `https://roccandy.com.au/sitemap.xml` loads.
- [x] Confirm `https://roccandy.com.au/robots.txt` loads.
- [x] Confirm canonicals point to `roccandy.com.au`.
- [x] Confirm no important pages point canonicals at preview hosts.
- [x] Confirm Open Graph metadata is correct.
- [x] Confirm structured data is present on key pages.
- [x] Confirm preview deployments remain non-indexable.
- [ ] Resolve or intentionally document the non-critical `/design` canonical warning between `/design` and `/design/wedding-candy`.

### Analytics / Ads / Merchant

- [x] Check GA4 Realtime.
- [ ] Check GA4 DebugView.
- [ ] Check Google Ads conversion diagnostics.
- [ ] Check Merchant Center diagnostics.
- [ ] Check Search Console coverage and URL inspection.
- [x] Confirm GTM / GA4 page-view tracking fires on the live domain.
- [x] Enable Vercel Speed Insights and confirm live data is coming in.
- [x] Enable Vercel Web Analytics and confirm the live site injects the analytics script.

### Operations

- [ ] Check payment failures.
- [ ] Check Woo order consistency.
- [ ] Check email delivery.
- [ ] Check 404s and missing redirects.
- [ ] Check the mobile journey again.

### Performance

- [x] Re-run Lighthouse / CWV checks on `roccandy.com.au`.
- [x] Use the live production domain as the benchmark, not `roccandy.vercel.app`.

## Deferred / Not Required For Launch

- [ ] Occasion hub pages and occasion subpages.
- [ ] Location pages.
- [ ] Review widget / Trustindex.
- [ ] Enhanced conversions.
- [ ] Broader product-list `view_item` tracking.
- [ ] Deeper Merchant feed enrichment.
- [ ] A larger ongoing blog publishing cadence.

## Launch Complete When All Of These Are True

- [x] `roccandy.vercel.app` worked all the way up until cutover.
- [x] `roccandy.com.au` is now the live public domain.
- [ ] Admin works on the live domain.
- [ ] Live payments work.
- [ ] Woo and Supabase both receive orders.
- [ ] Admin and customer emails send.
- [ ] GA4 purchase tracking works.
- [x] Important old URLs redirect correctly.
- [ ] Search Console and Merchant are tied to the real domain, not `vercel.app`.
