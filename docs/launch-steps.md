# Roc Candy Operations and Release Guide

Status: authoritative current operations document
Last reviewed against the repository: 2026-11-07

The site is launched and in production. Use it with `docs/architecture-notes.md`. Deferred or optional work belongs only in `docs/future-improvements.md`.

## Current Production Baseline

Verified without mutating production on 2026-08-26:

- `https://roccandy.com.au` serves the storefront; `www` redirects to the apex domain.
- Checkout is live and marked `noindex`.
- `/admin` redirects to the login page for an unauthenticated browser; admin pages are marked `noindex`.
- `robots.txt`, `sitemap.xml`, `manifest.webmanifest`, and `llms.txt` respond successfully. The sitemap currently contains 36 URLs.
- Vercel preview hosts return `X-Robots-Tag: noindex, nofollow, noarchive`.
- The Apple Pay association file and Square invoice webhook health GET respond successfully.
- `/design` has a self-canonical URL, and Google site verification metadata is present.
- The active GTM container includes the expected ecommerce and enquiry event names.
- Old `/api/woo/*` URLs return 404, as intended.

Not proven by a read-only website check:

- A real Square, wallet, or PayPal payment completes end to end.
- Customer/admin email delivery reaches inboxes rather than spam.
- An authenticated admin can complete every role-specific workflow.
- Square invoice webhook delivery is configured in the Square dashboard.
- GA4, Search Console, Merchant Center, and Ads show fresh production data.

Those items require authenticated console checks or controlled transactions. They are ongoing operations, not evidence that the website is unfinished.

## Safe Change and Release Process

This process is designed so checks do not mutate production data.

1. Before editing, inspect `git status` and preserve unrelated work.
2. Make the smallest scoped change. Database, payment, auth, email, and image-processing changes require extra review.
3. Run locally:

   ```bash
   npm test
   npm run lint
   npm run build
   npm audit --omit=dev
   ```

4. Treat `npm audit` as a triage report, not an instruction to run `npm audit fix`. Review the proposed package and breaking-change risk.
5. Deploy to a Vercel preview first. Confirm the preview remains `noindex` and uses safe credentials/provider modes.
6. Perform the read-only smoke checks below. For checkout-related changes, also complete a deliberate provider sandbox or approved low-value production transaction with a reconciliation plan.
7. Promote only after the preview checks pass. Do not make dependency PRs auto-merge or auto-deploy to production.
8. Repeat production smoke checks and watch Vercel/Supabase/payment/email logs immediately after release.

### Read-only smoke checks

- Load `/`, `/design`, `/pre-made-candy`, one product page, one blog page, `/checkout`, and `/admin/login`.
- Add a product and custom design to a cart; confirm quantity/date/pricing changes update visibly. Stop before payment unless a controlled transaction was planned.
- Confirm public images, a Supabase-hosted product image, and designer preview render.
- Confirm `robots.txt`, `sitemap.xml`, `manifest.webmanifest`, and `llms.txt` respond.
- Confirm a Vercel preview response contains the noindex header.
- Confirm the browser console has no new application errors.

Do not use live checkout, refunds, admin order creation, production scheduling, or webhook replay as casual smoke tests; they create real external or business state.

## Design Studio deployment and use

Apply these additive migrations before deploying the updated admin:
`docs/sql/2026-11-07-private-design-assets.sql`,
`docs/sql/2026-11-07-order-design-catalogue-backfill.sql`, and
`docs/sql/2026-11-07-admin-order-drafts.sql`, after the base Studio migration.
They have been applied to the configured project on 2026-11-07. Original design
artwork must remain private; previews use an authenticated admin route and
exports embed server-downloaded assets. Do not change this bucket to public.

For Studio v2, apply `docs/sql/2026-11-10-candy-design-v2.sql` before deploying
the application update. This adds version 2 to the existing atomic save
function's accepted versions, preserving v1 support, revision conflict checks
and service-role-only access. It does not rewrite existing projects/orders.
The migration is supplied with this change; production application/deployment
must be verified separately. A code rollback remains compatible with v1 data,
but a v1-only application cannot edit newly saved v2 documents: retain the v2
reader or roll forward after any v2 designs have been saved.

`npm run test:studio` runs the isolated Playwright component suite on loopback
with mocked library actions, without signing in or touching real accounts,
orders or email. It covers complex jacket controls, text/transform editing,
paint/selection split, project round trips, legacy upgrades and narrow layout.
Use the normal login flow for additional live admin verification. Never mint
sessions using application secrets. Customer proof/export buttons download
files only; they do not send mail or create orders.

Historical import command: `npx tsx scripts/backfill-order-designs.ts` previews
the eligible count; add `--apply` to import. The 2026-11-07 run imported 208
custom designs, preserved two existing library designs, and verified that source
orders were unchanged. A second pass imported the one legacy ICO image after
adding bounded PNG extraction. No import failures remain.

For unfinished orders, use **Save draft**, then resume from the schedule's
**Draft orders** section. These drafts have not sent a confirmation or created
an invoice. Normal final submission retains the existing confirmation/invoice
workflow. Saving changes to an existing order as a draft leaves the live order
unchanged. Refresh/close has a native warning; explicitly save first.

If a draft displays **Submission in progress** after a failed request, inspect
`admin_order_drafts.published_order_ids`, timestamps and the orders table before
retrying. Only clear `publishing_at` after proving no order write occurred;
otherwise record the corresponding IDs and complete the draft. Never clear this
lock speculatively, as the write response may have been lost.

Local verification must use the normal admin login or mocked authentication in
unit tests. Do not generate signed administrator sessions from application secrets.
The earlier temporary smoke/DB helpers were removed on 2026-11-07. No helper or
test Chromium process remained at inspection; the private asset bucket was empty
before historical import. Signing-secret rotation was not performed because it
would sign out all admins; previously generated sessions were not individually
revoked. Local preview binds to `127.0.0.1`.

Apply `docs/sql/2026-11-07-candy-design-studio.sql` before deploying code that
reads the new `orders.candy_design` column. The additive migration also creates
the design library/revision tables, protected save function, and private
`candy-design-assets` bucket. It is safe to re-run and does not rewrite existing
orders. Include `public/design-fonts/` in the deployment (configured through
Next.js output tracing).

The Design tab saves reusable mockups independently of orders. Start there and
choose Create order, or open Design Studio from a create/edit order form. Saving
to the library alone never edits an order. Save & use in order returns the design
to the form; save/review the order normally to persist its snapshot. To issue an
updated customer confirmation, use Save & resend confirmation on the order.
Exports download files and do not send email automatically. To restore an old
design revision, open it from Previous revisions and save a copy.

Use a preview/sandbox order for a full save/confirmation smoke test. Check its
order preview, print specification and confirmation image match; verify internal
design notes appear only in admin/print. Do not submit a live order or send a
customer email as an incidental test. Existing orders need no migration into
advanced artwork and remain editable with their original controls.

## Dependency Maintenance

The current production dependency audit has known findings. The safest policy is controlled patching, not indefinite avoidance and not blind bulk upgrades.

- Keep the lockfile committed. A deployed build does not silently upgrade because a newer package exists.
- Prioritize Internet-facing/runtime packages first: Next.js, NextAuth, and Sharp. Handle Nodemailer separately because its secure target is a major-version upgrade.
- Put each coherent update group in its own branch/PR, run tests/lint/build, inspect the lockfile, deploy a preview, and smoke-test the affected flow.
- Keep provider/package versions pinned by the lockfile until that review is complete.
- Enable Dependabot alerts/security-update PRs if desired, but require human review and passing checks. Never enable automatic merging to production.
- Review dependency alerts at least monthly and promptly when GitHub/Supabase/Vercel reports a critical issue affecting a used path.

Leaving the tree untouched avoids update-induced regressions today, but retains known denial-of-service, middleware/auth-token, image-processing, and transitive-library risk and makes a later upgrade larger. The application’s actual exposure varies: some reported Nodemailer, OAuth/email-provider, custom-server, rewrite, or low-level library APIs are not used here. Record a deliberate deferral; do not treat “the site still works” as vulnerability remediation.

## Supabase Paid Plan and Keepalive

Supabase paid-plan projects are not automatically paused for inactivity. The daily `.github/workflows/supabase-keepalive.yml` ping is therefore not needed to keep this paid project awake.

The current workflow is harmless when configured: it performs one small read through `/api/keepalive`. It can be left as a very basic health signal, removed in a dedicated housekeeping change, or replaced with real monitoring that alerts on failure. It is not independent monitoring because both the endpoint and database must work, but the workflow currently sends no purpose-built alert beyond the GitHub job failure.

Before removing it, confirm the production project is inside the paid Supabase organization—not merely that a different organization is paid. Removing the workflow does not affect application runtime, checkout, auth, database connections, backups, or performance.

Paid Supabase reduces inactivity risk but does not remove operational work:

- Keep billing/payment details current; overdue billing can still restrict service.
- Review usage and spend-cap behavior.
- Confirm automated backup availability and retention in the project dashboard; use PITR only if the business recovery objective justifies the extra cost.
- Periodically test a documented restore/export process without overwriting production.

## Payment and Order Recovery

### Website payment succeeded but no Supabase order appears

1. Do not ask the customer to pay again until the provider transaction is checked.
2. Search Square/PayPal by the transaction ID, email, amount, and time.
3. Check `payment_failures`, Vercel logs, and the orders mailbox alert for the saved checkout snapshot.
4. Reconstruct the order in admin only after verifying the exact successful charge. Record the provider/transaction ID and notes to avoid double handling.
5. If appropriate, refund from the provider/admin flow and record the reason.

### Email failed after payment/order save

- Treat the payment and Supabase order as authoritative.
- Confirm SMTP configuration/provider logs, then resend or contact the customer manually.
- Do not refund or recreate an order merely because an email failed.

### Admin Square invoice issue

- The Supabase order remains authoritative and unpaid when invoice creation fails.
- Review `square_invoice_error`, correct provider/configuration data, then use the invoice review/recovery workflow.
- For direct deposit, staff must verify the bank transfer and update the order according to the admin process; no automated bank webhook exists.

### Webhook issue

- Confirm the Square dashboard notification URL exactly matches the configured signature URL and includes `invoice.payment_made`.
- Check signature failures and provider delivery logs before replaying an event.
- The handler is idempotent enough to avoid re-emailing orders already marked paid, but replay only a known event deliberately.

## Routine Operations

Weekly or after meaningful changes:

- Review Vercel errors, payment failures, SMTP failures, and Square webhook delivery.
- Check the orders queue and overdue unpaid admin invoices.
- Review failed GitHub workflows if the keepalive/health job remains.

Monthly:

- Review dependency/security alerts and schedule controlled patches.
- Check Supabase usage, billing/spend cap, backup status, and storage growth.
- Confirm Square/PayPal/SMTP credentials are healthy and remove obsolete admin accounts.
- Check GA4/GTM, Search Console indexing, Merchant Center diagnostics, and Ads landing pages in their external consoles.
- Update the two authoritative docs when behavior changed.

Quarterly or after checkout/auth/invoice changes:

- Run one planned end-to-end transaction per active payment route, confirm the Supabase order and both emails, then refund or retain it according to the test plan.
- Test admin invoice publishing/direct deposit and the signed Square payment webhook in sandbox or with a controlled real invoice.
- Exercise role-based admin access and a non-destructive backup/export/restore rehearsal.

## Documentation and Historical Files

For future LLM work, provide only:

- `README.md`
- `docs/architecture-notes.md`
- `docs/launch-steps.md`
- the specific code/schema/migration file relevant to the requested change

The following are useful history but are not current general context: `infrastructure-map.md`, `admin-simple-map.*`, rollback references, and old pricing/schema snapshots. They may describe WooCommerce, pre-launch tasks, old test counts, old routes, or temporary file paths that are no longer valid.

When behavior changes, update the two authoritative guides in the same PR. Do not duplicate a third full architecture or launch checklist.
