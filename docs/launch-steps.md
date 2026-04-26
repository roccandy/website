# Launch Steps

Single ordered runbook for launching Roc Candy.

Rule for this document:

- `roccandy.vercel.app` must keep working right up until cutover.
- Admin auth must keep working right up until cutover.
- Any change that would break `roccandy.vercel.app` stays in the post-cutover section.

Last reviewed against the repo on `2026-04-21`.

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

- [] Replace `NEXT_PUBLIC_SQUARE_APP_ID` with the live app ID.
- [] Replace `NEXT_PUBLIC_SQUARE_LOCATION_ID` with the live location ID.
- [] Set `NEXT_PUBLIC_SQUARE_ENV=production`.
- [] Replace `SQUARE_ACCESS_TOKEN` with the live access token.
- [] Replace `SQUARE_LOCATION_ID` with the live location ID.
- [] Clear `SQUARE_API_BASE` if it still points at sandbox, or set it to `https://connect.squareup.com`. #set to squareup

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

- [ ] Test homepage on desktop and mobile.
- [ ] Test About page.
- [ ] Test FAQ page.
- [ ] Test Design page.
- [ ] Test Wedding landing page.
- [ ] Test Custom Text landing page.
- [ ] Test Branded landing page.
- [ ] Test Pre-made Candy listing page.
- [ ] Test several pre-made product pages.
- [ ] Test Contact page.
- [ ] Test Shipping and Returns page.
- [ ] Test Privacy page.
- [ ] Test Terms page.
- [ ] Test 404 page.
- [ ] Test cart add / remove / update.
- [ ] Test custom order flow from designer to checkout.
- [ ] Test pre-made order flow from product page to checkout.
- [ ] Test redirects already entered in the SEO workspace.

## Phase 7: Run Pre-Cutover Payment QA On `roccandy.vercel.app`

- [ ] Run one live Square payment on `roccandy.vercel.app` if operationally safe.
- [ ] Run one live PayPal payment on `roccandy.vercel.app` if operationally safe.
- [ ] Confirm successful payments create Woo orders.
- [ ] Confirm successful payments create Supabase order rows.
- [ ] Confirm Woo order totals, line items, and statuses look correct.
- [ ] Confirm admin email notifications are received.
- [ ] Confirm customer email notifications are received.
- [ ] Confirm refunds / payment-failure handling are acceptable.

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

- [ ] Create the real-domain property for `roccandy.com.au`.
- [ ] Verify it now if you are using DNS verification.
- [ ] Do not treat `roccandy.vercel.app` as the main indexed property.
- [ ] Do not submit the final-domain sitemap yet unless the domain is already live.

### Merchant Center

- [ ] Decide whether Merchant Center will cover pre-made products only.
- [ ] Prepare the account/feed/crawl setup.
- [ ] Do not point Merchant product URLs at `vercel.app`.
- [ ] Do not claim the staging host as the real website.
- [ ] Wait until cutover before refreshing the live crawl/feed.

### Google Ads

- [ ] Inventory any ad URLs or assets using `roccandy.vercel.app`.
- [ ] Prepare to switch them after cutover if needed.

### Cloudflare

- [ ] Prepare the DNS change plan for `@` and `www`.
- [ ] Do not move DNS yet.

### GitHub Actions

- [ ] Note that `KEEPALIVE_URL` must stay on the current working host until cutover.

### Woo / WordPress

- [ ] Note that Woo webhook delivery URL must stay on the current working host until cutover.
- [ ] Note that the Woo return/success URL must stay on the current working host until cutover.
- [ ] Confirm the current plugin source is [roccandy-woo-redirect.php](/Users/joeconlin/dev/roccandy/wordpress/roccandy-woo-redirect/roccandy-woo-redirect.php).
- [ ] Confirm the packaged plugin zips that will need updating after cutover are:
  - [roccandy-woo-redirect.zip](/Users/joeconlin/dev/roccandy/wordpress/roccandy-woo-redirect.zip)
  - [roccandy-woo-redirect-clean.zip](/Users/joeconlin/dev/roccandy/wordpress/roccandy-woo-redirect-clean.zip)

### Square Apple Pay

- [ ] Confirm the verification file exists at [apple-developer-merchantid-domain-association](/Users/joeconlin/dev/roccandy/public/.well-known/apple-developer-merchantid-domain-association).
- [ ] Wait until cutover before verifying Apple Pay against `roccandy.com.au`.

### Supabase Auth

- [ ] If you use Supabase Auth email links or redirect URLs anywhere, note that Site URL / Redirect URLs should be changed after cutover.

## Phase 10: Final Go / No-Go Check Before DNS Cutover

- [ ] `roccandy.vercel.app` public site is working.
- [ ] `roccandy.vercel.app` admin is working.
- [ ] Live payments are working on `roccandy.vercel.app`.
- [ ] Woo sync is working.
- [ ] Supabase order inserts are working.
- [ ] Admin and customer emails are working.
- [ ] GA4 purchase tracking is working.
- [ ] Redirect map is entered.
- [ ] Vercel domains are prepared.
- [ ] Cloudflare DNS plan is ready.
- [ ] You are ready to perform the cutover immediately after the next section starts.

If any of the above is false, stop here and fix it before cutover.

## Phase 11: Cutover Actions

Do these in order once you are ready to switch.

### Host / Auth Switch

- [ ] In Vercel `Production`, set `NEXTAUTH_URL=https://roccandy.com.au`.
- [ ] Redeploy `Production` immediately after changing `NEXTAUTH_URL`.

### DNS Switch

- [ ] Update Cloudflare DNS so `@` points to Vercel.
- [ ] Update Cloudflare DNS so `www` points to Vercel.
- [ ] Confirm `www` redirects to `roccandy.com.au`.
- [ ] Keep `woo.roccandy.com.au` unchanged if Woo stays on its current host.

### GitHub Actions

- [ ] Change the GitHub `KEEPALIVE_URL` secret to `https://roccandy.com.au/api/keepalive`.

### Woo / WordPress

- [ ] Change the Woo webhook delivery URL to `https://roccandy.com.au/api/woo/webhook`.
- [ ] Update the Woo return/success URL from `https://roccandy.vercel.app/checkout/success` to `https://roccandy.com.au/checkout/success`.
- [ ] Update [roccandy-woo-redirect.php](/Users/joeconlin/dev/roccandy/wordpress/roccandy-woo-redirect/roccandy-woo-redirect.php) to the live domain.
- [ ] Rebuild or replace:
  - [roccandy-woo-redirect.zip](/Users/joeconlin/dev/roccandy/wordpress/roccandy-woo-redirect.zip)
  - [roccandy-woo-redirect-clean.zip](/Users/joeconlin/dev/roccandy/wordpress/roccandy-woo-redirect-clean.zip)
- [ ] Re-upload or update the installed WordPress plugin if needed.

### Square Apple Pay

- [ ] Verify Apple Pay against `https://roccandy.com.au/.well-known/apple-developer-merchantid-domain-association`.

### Search Console

- [ ] Submit `https://roccandy.com.au/sitemap.xml`.
- [ ] Use URL inspection on the homepage and key landing/product pages.

### Merchant Center

- [ ] Switch the website/product URLs to `https://roccandy.com.au`.
- [ ] Refresh or fetch the feed / crawl.
- [ ] Confirm website claim / verification is tied to the real domain.

### Supabase Auth

- [ ] If used, set Supabase Auth Site URL to `https://roccandy.com.au`.
- [ ] If used, add Supabase Auth Redirect URLs for `https://roccandy.com.au/**`.

### External Links Still Using `vercel.app`

- [ ] Switch any Google Ads final URLs still using `vercel.app`.
- [ ] Switch any Merchant Center URLs still using `vercel.app`.
- [ ] Switch any email-template, campaign, or profile links under your control that still use `vercel.app`.

## Phase 12: Immediate Post-Cutover Smoke Test

- [ ] Homepage loads on `https://roccandy.com.au`.
- [ ] Admin login works on `https://roccandy.com.au`.
- [ ] Admin logout works on `https://roccandy.com.au`.
- [ ] Core landing pages load.
- [ ] Key pre-made product pages load.
- [ ] Old high-value URLs redirect correctly.
- [ ] Checkout loads.
- [ ] Run one live payment on the live domain if operationally safe.
- [ ] Confirm Woo order creation from the live domain.
- [ ] Confirm Supabase order rows from the live domain.
- [ ] Confirm admin email delivery from the live domain.
- [ ] Confirm customer email delivery from the live domain.
- [ ] Confirm `purchase` appears in GA4 for the live-domain order.

## Phase 13: Post-Cutover Validation Over The Next 24-72 Hours

### SEO / Indexing

- [ ] Confirm `https://roccandy.com.au/sitemap.xml` loads.
- [ ] Confirm `https://roccandy.com.au/robots.txt` loads.
- [ ] Confirm canonicals point to `roccandy.com.au`.
- [ ] Confirm no important pages point canonicals at preview hosts.
- [ ] Confirm Open Graph metadata is correct.
- [ ] Confirm structured data is present on key pages.
- [ ] Confirm preview deployments remain non-indexable.

### Analytics / Ads / Merchant

- [ ] Check GA4 Realtime.
- [ ] Check GA4 DebugView.
- [ ] Check Google Ads conversion diagnostics.
- [ ] Check Merchant Center diagnostics.
- [ ] Check Search Console coverage and URL inspection.

### Operations

- [ ] Check payment failures.
- [ ] Check Woo order consistency.
- [ ] Check email delivery.
- [ ] Check 404s and missing redirects.
- [ ] Check the mobile journey again.

### Performance

- [ ] Re-run Lighthouse / CWV checks on `roccandy.com.au`.
- [ ] Use the live production domain as the benchmark, not `roccandy.vercel.app`.

## Deferred / Not Required For Launch

- [ ] Occasion hub pages and occasion subpages.
- [ ] Location pages.
- [ ] Review widget / Trustindex.
- [ ] Enhanced conversions.
- [ ] Broader product-list `view_item` tracking.
- [ ] Deeper Merchant feed enrichment.
- [ ] A larger ongoing blog publishing cadence.

## Launch Complete When All Of These Are True

- [ ] `roccandy.vercel.app` worked all the way up until cutover.
- [ ] `roccandy.com.au` is now the live public domain.
- [ ] Admin works on the live domain.
- [ ] Live payments work.
- [ ] Woo and Supabase both receive orders.
- [ ] Admin and customer emails send.
- [ ] GA4 purchase tracking works.
- [ ] Important old URLs redirect correctly.
- [ ] Search Console and Merchant are tied to the real domain, not `vercel.app`.
