# Roc Candy System Guide

Status: authoritative current-state document
Last verified against the repository and production: 2026-08-26

This is one of two general source-of-truth documents. Use it with `docs/launch-steps.md` when giving the project to an LLM. If a dated audit, plan, diagram, rollback note, or old roadmap conflicts with this guide, this guide wins.

## Current System at a Glance

```text
Customer/admin browser
        |
Cloudflare DNS -> Vercel -> Next.js application
                              |-- Supabase: database, auth-related admin data, storage
                              |-- Square: website card/wallet payments and admin invoices
                              |-- PayPal: website PayPal payments
                              |-- SMTP: customer/admin/enquiry email
                              |-- GTM/GA4 + Vercel Analytics/Speed Insights
```

- Production: `https://roccandy.com.au`; `www` redirects to the apex domain.
- Hosting: Vercel. Vercel preview hosts are sent `noindex, nofollow, noarchive` unless preview crawling is explicitly enabled.
- Framework: Next.js 16 App Router, React 19, TypeScript, and Tailwind CSS.
- Primary data store: Supabase Postgres. Public media is primarily in Supabase Storage.
- Admin authentication: NextAuth credentials with JWT sessions, backed by `admin_users`.
- Payments: native Square and PayPal website checkout; Square invoices or direct-deposit PDFs for admin-created orders.
- Email: Nodemailer through the configured SMTP provider.

## Deliberate Non-Integration: WooCommerce

WooCommerce and WordPress are not in any active storefront, checkout, payment-finalization, admin-order, or webhook path.

- Website orders are written directly to Supabase after a verified Square or PayPal payment.
- Admin-created orders are written directly to Supabase and can create Square invoice records.
- There are no active `/api/woo/*` routes and no `WOO_*` environment variables are required.
- The `wordpress/` directory and any old Woo-named database columns or documentation references are legacy migration/rollback artifacts only. Do not restore or build on them without a new explicit decision.

## Public Customer Behavior

### Content and shopping

- Public pages, editable page content, FAQs, blog posts, pre-made products, packaging, flavors, palettes, and pricing are read from Supabase, with repository defaults where implemented.
- The cart is browser-side state in `localStorage`.
- The designer supports custom text, branded/logo, wedding, palette, packaging, labels, flavor, quantity, date, pickup/delivery, and pricing selections.
- The public site enforces its configured product, weight, production-date, and packaging constraints. Admin large-order creation has separate rules.
- The test promo code and promo input were removed on 2026-08-26. Checkout has no active discount-code mechanism.

### Website checkout

Both payment routes rebuild and validate the order on the server. Browser totals are never trusted as the charged amount.

1. Validate customer, date, address, item selections, quantities, availability, and maximum weight.
2. Load current Supabase product/settings data and recalculate every line.
3. Square charges the calculated AUD amount with an idempotency key, or PayPal creates an order and later verifies its signed checkout state, approved amount, currency, and capture.
4. After successful payment, the shared finalizer inserts enriched `orders` rows in Supabase with payment transaction data and `status = pending`.
5. The finalizer sends customer and orders-mailbox summaries. Email problems are reported as warnings and do not reverse a successful payment.
6. If payment succeeds but the order cannot be saved after retries, the app records a `payment_failures` recovery snapshot and alerts the orders mailbox. Staff must reconcile the provider transaction.
7. The success page reads a short-lived summary from browser `sessionStorage`; purchase analytics are deduplicated in the browser.

Square, Apple Pay, Google Pay, and PayPal availability still depends on provider configuration and the customer device/browser. Refunds are initiated from admin and use the original provider transaction where supported.

### Enquiries

`POST /api/enquiries` accepts validated form data and up to three supported attachments with a 4 MB combined limit. It applies origin checks, a honeypot/timing spam check, file-signature validation, and an in-memory per-instance rate limit, then emails the customer and enquiries mailbox.

## Admin Behavior

Admin areas cover orders, production, customers/CRM, pre-made products, packaging, labels, flavors, pricing, palette, blocked dates, content pages, FAQs, blog posts, policy pages, analytics summaries, activity, and users.

Roles are:

- `admin`: general write, SEO write, and user management.
- `editor`: general and SEO write access.
- `seo`: SEO/content write access only.
- `production`: restricted to the production area and permitted order print views.
- `viewer`: read-only.

The service-role Supabase key is server-only and is required for privileged operations. The public anon key is used only for permitted public reads.

### Admin-created orders and invoices

1. Admin creates one or more Supabase order rows. Large orders may allocate up to 20 production batches and can use fixed/percentage discounts or a deliberate final-price override.
2. The system creates a Square customer, Square order, and Square invoice draft when invoice integration is requested.
3. Admin reviews the invoice and either publishes a hosted Square payment invoice or sends the generated direct-deposit tax-invoice PDF.
4. The signed Square `invoice.payment_made` webhook marks the Supabase order paid and sends an orders-mailbox notification.
5. If Square invoice creation fails, the Supabase order remains saved and unpaid with the failure recorded in `square_invoice_error` for manual recovery.

Detailed implementation history and migration notes are in `docs/admin-large-order-workflow.md`; this guide remains authoritative for current behavior.

## Data and Storage

Important active tables include:

- Commerce/production: `orders`, `payment_failures`, `order_slots`, `production_slots`, `production_blocks`, `production_day_notes`.
- Catalog/pricing: `premade_candies`, `packaging_options`, `packaging_option_images`, `packaging_lid_colors`, `flavors`, `label_types`, `label_ranges`, `weight_tiers`, `settings`, `color_palette`.
- Admin/content/SEO: `admin_users`, `admin_activity`, `site_pages`, `site_redirects`, FAQs/blog/policy tables used by the data modules.
- CRM/imported history: `customers`, `customer_identities`, `customer_notes`, `customer_contact_events`, `customer_order_history`, `customer_order_items`.

`docs/supabase_schema.sql` and `docs/sql/` are schema references and migration records, not a substitute for checking the live Supabase schema before applying database changes. Never apply an old migration blindly.

Supabase Storage contains public/admin product and content images plus generated email-preview assets. The normal customer logo/label flow uses uploaded data or Roc Candy storage URLs; it does not require arbitrary third-party image hosts.

## Important Routes

- Storefront: `/`, `/design`, `/quote`, `/checkout`, `/checkout/success`, `/pre-made-candy`, product pages, `/blog`, content/policy pages.
- Admin: `/admin` and the nested order, production, catalog, content, customer, settings, stats, and activity pages.
- Checkout APIs: `/api/payments/square`, `/api/payments/paypal/create-order`, `/api/payments/paypal/capture-order`, `/api/payments/refund`.
- Admin invoice webhook: `/api/payments/square/invoice-webhook`.
- Other APIs: `/api/quote`, `/api/enquiries`, `/api/preview/candy`, `/api/preview/candy-image`, `/api/payments/log-failure`, `/api/keepalive`.
- Discovery: `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest`, `/llms.txt`.

`/api/keepalive` performs a small Supabase read. It is not needed to prevent inactivity pausing while the project belongs to a paid Supabase organization; the existing GitHub workflow is optional and may instead be treated as a minimal health check.

## Environment Variable Groups

Never put secret values in documentation or commit `.env.local`.

- Site/preview: `NEXT_PUBLIC_SITE_URL`; optional `SITE_URL`, `NEXT_PUBLIC_PREVIEW_SITE_URL`, `PREVIEW_SITE_URL`, `ALLOW_PREVIEW_CRAWL`.
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; optional server alias `SUPABASE_URL`.
- Admin auth/bootstrap: `NEXTAUTH_SECRET`; bootstrap-only `ADMIN_BOOTSTRAP_EMAIL(S)` and `ADMIN_BOOTSTRAP_PASSWORD`. Older `ADMIN_EMAIL(S)`/`ADMIN_PASSWORD` names are fallback aliases.
- Square browser: `NEXT_PUBLIC_SQUARE_APP_ID`, `NEXT_PUBLIC_SQUARE_LOCATION_ID`, `NEXT_PUBLIC_SQUARE_ENV`.
- Square server/invoices: `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`, optional API base/version/currency settings, and `SQUARE_INVOICE_WEBHOOK_SIGNATURE_KEY`, `SQUARE_INVOICE_WEBHOOK_URL`.
- PayPal browser/server: `NEXT_PUBLIC_PAYPAL_CLIENT_ID`, `NEXT_PUBLIC_PAYPAL_ENV`, `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`, `PAYPAL_ENV`; optional `PAYPAL_API_BASE`.
- Email: `SMTP_ENABLED`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `ORDERS_EMAIL`, `ENQUIRIES_EMAIL`; optional admin-recipient fallbacks.
- Analytics/verification: `NEXT_PUBLIC_GTM_ID` or fallback direct `NEXT_PUBLIC_GA_MEASUREMENT_ID`; optional Google/Bing/Yandex verification values.
- Generated previews: optional `EMAIL_PREVIEW_BUCKET`.

## Analytics and Search

- Google Tag Manager is the intended primary Google measurement container. Direct GA4 is a fallback when GTM is absent.
- Implemented events include `view_item`, `add_to_cart`, `begin_checkout`, `purchase`, enquiry-start, and lead-generation events.
- Vercel Analytics and Speed Insights are also mounted.
- The app generates metadata, canonical URLs, robots rules, a sitemap, structured data, and `llms.txt`.
- Search Console, Merchant Center, Ads, GA4, GTM publishing, and provider dashboards are external state. Code can confirm instrumentation exists but not that those consoles are correctly linked or receiving data.

## Known Operational/Security Constraints

- Rate limiting is process-memory based. It reduces simple abuse but is not a durable distributed limit across Vercel instances.
- Server-rendered email/preview helpers can fetch external image URLs. Restricting them safely requires allowing current Roc Candy/Supabase hosts and handling legacy external URLs with a placeholder; see the operations guide before changing this.
- Dependency alerts exist in the current tree. Update packages only through a preview-tested, reviewed dependency change; do not auto-merge dependency updates to production.
- There is currently no broad pull-request CI gate, browser end-to-end suite, or independent uptime alert. The repository has substantial Vitest coverage plus lint/build commands, but those checks depend on a developer running them.

## Documentation Rule

Update this guide whenever architecture, active integrations, checkout/order behavior, auth roles, data ownership, or required environment-variable groups change. Update `docs/launch-steps.md` whenever release, monitoring, backup, or incident procedures change. Keep dated implementation notes for history, but add a clear historical banner if their old behavior could be mistaken for current behavior.
