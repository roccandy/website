# Roc Candy System Guide

Status: authoritative current-state document
Last reviewed against the repository: 2026-11-12

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

### Unfinished admin order drafts

Create/edit forms provide **Save draft** without requiring complete customer,
design, packaging, or price fields. In-app navigation and browser history
navigation with unsaved edits offer Keep editing, Save draft & leave, or Discard
& leave. Discard also closes a previously saved draft; it never deletes the
live order. Browser refresh/close uses the browser's native unsaved warning;
save explicitly before closing because browsers cannot await an async draft
save during unload.

`admin_order_drafts` stores a private, versioned JSON payload containing all
order tabs, shared customer/delivery details, artwork, production notes, batch
inputs and invoice adjustments. These records are separate from `orders`:
draft saves invoke no Square or mail integration. The production schedule shows
them in **Draft orders**, explicitly labelled **not sent to customer**, outside
production capacity, invoice and revenue calculations. An existing order draft
is labelled Draft changes; the original remains live until normal submission.

`draftActions.ts` requires write access, whitelists editable fields, and uses
`save_admin_order_draft` for revision checks and repeat-save idempotency.
Resume links restore each tab and incomplete values. One active draft is
allowed per existing order. A source fingerprint blocks stale drafts when the
live order changes. Normal order submission retains all required-field checks
and atomically claims the draft revision. The draft is closed immediately after
order rows are saved, before invoice/email calls. A submission with an uncertain
write response stays locked for reconciliation rather than risking duplicate
orders. Draft activity records saves/discards without copying customer payloads.

### Admin Design Studio

New designs and basic order imports use the shared public baseline in
`src/lib/siteDesignerDefaults.ts`: the configured light-grey palette entries,
Helvetica/Arial sans-serif stack, bold upright text, the public short-text size
scaling/tracking, wedding names/initials/heart layout, and white fill/pinstripes.
Basic order imports retain their chosen colours/artwork and reproduce the public
stacked/curved long-text layouts. Saved Studio snapshots retain all explicitly
chosen settings. Tools added within the admin workspace follow the supplied
prototype's text/heart defaults; they do not change public designer defaults.
The site's generic font uses bundled Arimo (Arial-compatible) glyphs
for portable server exports; Roboto, Roboto Slab and Roboto Mono remain optional
advanced choices. Public rendering retains its existing baseline behaviour.

`/admin/design` is an independent artwork workspace with text/image/shape layers,
positioning, rotation, text arcs, font family/size/bold/italic/spacing, jacket
segments, fill and pinstripe colours, undo/redo, browser draft recovery, a saved
design library and PNG/PDF/SVG export. The public `QuoteBuilder` keeps its
existing controls and rendering path. Studio designs use `CandyDesignSvg`;
`CandyPreview` selects that renderer only when given an advanced design.

`src/lib/candyDesign.ts` defines and validates version 1 and version 2 JSON
documents. Version 1 snapshots retain their existing geometry. New standalone
Studio designs use v2; old designs enable advanced jacket construction only on
an explicit editor action. Layer-only upgrades preserve the original jacket.
V2 adds 2–16 jacket segments, cycling palettes, proportional pinstripe width,
8–35% jacket ring thickness, body shading and an optional shadow. The vector
construction in `candyJacketGeometry.ts` joins each body band to the matching
face band. `CandyDesignSvg` is shared by editor, order, print and server export.
The public quote designer does not expose or generate Studio v2 documents.

The Studio interface is ported from the administrator's supplied HTML: a slim
left tool rail, central canvas, and right-hand collapsible Whole design, Export,
Jacket, Colours and Layers sections. Selected layer settings expand inside their
row, rather than a separate inspector. The interface is isolated in a same-origin
frame so its supplied styles and keyboard/pointer interactions cannot alter the
admin shell or public site. `studioControls.js` contains its UI/pixel interaction
controller, with the independent prototype candy renderer and export code removed.
`studioExperienceAdapter.ts` maps its state into existing CandyDesign snapshots.
The page opens directly into the Studio without a separate page heading or
library strip. Its toolbar's Library button opens an on-demand drawer; an
authenticated, uncached library API handles search, pagination and revision links
without navigating away from work in progress. Choosing another design or starting
a new one still goes through the unsaved-navigation guard. Embedded order editing
does not expose navigation away to the standalone library.
React renders `StudioCandyPreview` directly in the canvas stage; the extra canvas
is only a colour-sampling buffer and interaction overlay. Fonts, styles and code
are served locally; imported project files are data only.

Resize/rotation handles, position locking, opacity, multiline/uppercase text,
adjustable arc distance/slide, duplication and keyboard nudging follow the supplied
tool experience. Saved independent transforms and semicircle paths are retained.
Whole-design size is distinct from canvas box size: only the former is saved in
artwork and used by shared rendering. Hide-candy label mode and per-layer clipping
also persist into shared SVG/PNG/PDF/order rendering. Unchanged legacy documents,
jackets with more than four colours and unrelated layers remain unchanged when
opened. Presentation mode hides editing panels. Proof background/transparency settings are used only
by explicit Studio exports; order/email previews retain a white background.
The customer proof PDF combines the flat face and 3D preview with the design
name/revision and customer-safe summary. Production printouts include both
views and the full construction/layer specification for v2 snapshots.

The admin raster editor supports brush/eraser, box/lasso/contiguous or global
colour selections, remove/replace colour, tint, eyedropper, selection growth,
shrink/invert, keep/delete/fill, and copy/split into a separate layer. Jacket
paint uses the renderer's actual jacket clip and a scene-coordinate image frame;
face artwork uses face coordinates. Pixel edits run directly on the main stage,
with the supplied contextual selection controls and shared workspace undo/redo.
Edited images are staged through the private asset pipeline after an idle interval;
save/apply/export explicitly await asset preparation. On save they follow the same immutable private-asset pipeline as image
uploads. No browser canvas state is required to reproduce a saved design.
Portable JSON project downloads embed private images after authenticated fetch;
opening a project validates it and creates a separate library identity on save.

Library-save state is tracked separately from artwork applied to an order.
Closing embedded Studio offers apply, keep a recovery draft, discard editor
changes, or continue; a library save alone cannot bypass that choice. Recovery
uses session storage scoped by project/order tab, isolating different browser
tabs. Changed source baselines restore as copies. Existing global v1 browser
recovery remains available for explicit migration. These browser drafts never
create an order, invoice or email.
Recovery is offered through a small Recovered work toolbar control, with its
explanation and restore/dismiss actions inside a drawer. No recovery banner takes
space above the canvas. Routine save/export feedback stays within the toolbar.

Studio uploads use short-lived signed uploads into private staging paths, then
server validation and immutable content hashes. PNG/JPEG/WebP originals retain
their native bytes/resolution up to 6000px and 20MB (36 megapixels); orientation
or oversize images are normalised. References support `.png`, `.jpg` and `.webp`.
The portable project envelope stores the small design plus embedded assets
separately, up to 64MB, avoiding inline design-size limits. Original prototype
`.rcmock.json` imports convert editable layers/jackets and embed imported images;
font substitutions and paint-layout adaptations are explicitly reported.

Browser lettering and server exports share Fontkit glyph geometry. Valid saved
snapshots cache that geometry; editing requests fresh outlines from an
authenticated endpoint when typography changes. The default Studio face uses
bundled Arimo consistently, while the public basic designer retains its original
font stack. Additional prototype fonts are bundled locally with licences.
Geometry-based clipping warnings are advisory. Studio also provides saved colour
swatches, numbered jacket-band previews/specifications, JPEG export, 2×/4×/6× or
source-resolution exports and image-only cropping. Output is capped at 16000px
per side and 36 megapixels; the export controls show the actual dimensions.
The Studio toolbar and the basic admin order designer can copy their PNG preview
directly to the browser clipboard for pasting into email. Administrators set
that image's exact width (100–5000 px; default 1200 px) in Admin / Settings /
Design Studio; the renderer preserves the artwork aspect ratio and applies the
normal export limits.

`candy_designs` holds each library project's latest document;
`candy_design_revisions` holds immutable revisions. `save_candy_design` performs
an atomic revision check and history insert, preventing lost updates between
tabs. Only the server's service role can write these tables, after admin write
permission checks. The library supports name search and pages of 24 designs;
each project shows its latest 30 revision links. Saving a copy gives a design
its own identity.

The create/edit order form opens the Studio in an overlay so unsaved order and
customer fields survive. "Save & use in order" saves the library revision then
copies the design into that order tab's `orders.candy_design` JSONB snapshot.
The snapshot includes its library id/revision; later library edits do not change
saved orders. Each tab on a combined invoice has its own snapshot. Remakes carry
the snapshot forward. Order updates record design changes in activity history.
Saved order details and print views provide direct PNG/PDF/SVG downloads of
their own snapshot, without opening the editor or changing the library.

Studio artwork never forces an order into the branded category. Staff still
select the commercial order type; compatibility text/colour/jacket fields are
derived from the snapshot on save. Custom segmented jackets use the existing
two-colour jacket pricing, with normal admin overrides available. Advanced
artwork is the authoritative preview in order details, production, print and
invoice review. The production printout includes layers, fonts, size/position,
rotation, colours and internal production notes. Confirmations include a PNG
generated from the snapshot plus a readable design summary, excluding internal
notes and layout measurements. Existing orders without snapshots keep their
legacy rendering and summaries.

Admin custom orders have an optional `admin_complexity_charge`, default $0,
charged once per order rather than per batch. It is a separate pricing line,
added after urgency and before discounts; a total override remains final.
Drafts, combined invoices and remakes retain each line's charge. Changing only
that charge on a preserved remake adjusts its quoted total by the charge delta
without recalculating historical batch rates. Default-zero migration values are
ignored in source fingerprints so existing server drafts remain compatible.

Uploaded artwork is validated/optimised and stored once under a content hash in
the private `candy-design-assets` storage bucket; ordinary order documents contain
`candy-asset:<sha256>.<png|jpg|webp>` references rather than large base64 files. The admin
image route requires a session and serves private, uncached responses. Legacy
references to this bucket's former public URLs are mapped to that route. Saved
artwork is immutable. The
server exporter embeds these assets and uses the same bundled Studio fonts as
the browser. The server uses Fontkit to convert
text and arcs into glyph outlines before SVG/PNG/PDF/email rendering, preventing
system-font substitution. The editable document retains the original text and
typography controls. Unsupported characters produce a clear validation error.
The font files and licences live in `public/design-fonts/` and are included in server
deployment tracing. Legacy remote artwork import accepts only the configured
site/Supabase origins, with a timeout and byte limit; each redirect destination
must also be approved. Historical PNG-containing ICO artwork is rasterised.
The exporter downloads original assets using the server client and embeds them;
customer email previews continue to use their separate flattened preview path.

Historical custom order designs are imported insert-only into the catalogue,
named from their order titles, with `source_order_id` provenance and revision 1.
`scripts/backfill-order-designs.ts` defaults to a dry run and verifies source
orders remain unchanged on apply; reruns preserve imported or manually edited
catalogue entries. Orders with no design and premade stock are excluded. An
explicit order title also names its new Studio mockup and saved order snapshot;
renaming an order never renames a reused library master.
Schema version 1 and its bundled font files are compatibility contracts: retain
their rendering semantics for existing snapshots when adding future versions.

## Data and Storage

Important active tables include:

- Commerce/production: `orders`, `payment_failures`, `order_slots`, `production_slots`, `production_blocks`, `production_day_notes`.
- Artwork: `candy_designs`, `candy_design_revisions`, and immutable `orders.candy_design` snapshots.
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
- Server-rendered email/preview helpers can fetch external image URLs. The optional hardening approach is recorded in `docs/future-improvements.md`.
- Dependency alerts exist in the current tree. Update packages only through a preview-tested, reviewed dependency change; do not auto-merge dependency updates to production.
- There is currently no broad pull-request CI gate, browser end-to-end suite, or independent uptime alert. The repository has substantial Vitest coverage plus lint/build commands, but those checks depend on a developer running them.

## Documentation Rule

Update this guide whenever architecture, active integrations, checkout/order behavior, auth roles, data ownership, or required environment-variable groups change. Update `docs/launch-steps.md` whenever release, monitoring, backup, or incident procedures change. Record deferred or optional work only in `docs/future-improvements.md`.
