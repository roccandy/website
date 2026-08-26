# Roc Candy Operations and Release Guide

Status: authoritative current operations document
Last verified against the repository and production: 2026-08-26

The site is launched and in production. This document replaces the old pre-launch checklist. Use it with `docs/architecture-notes.md`; old audits and rollout plans are historical evidence, not open launch work.

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

## Dependency Maintenance

The current production dependency audit has known findings. The safest policy is controlled patching, not indefinite avoidance and not blind bulk upgrades.

- Keep the lockfile committed. A deployed build does not silently upgrade because a newer package exists.
- Prioritize Internet-facing/runtime packages first: Next.js, NextAuth, and Sharp. Handle Nodemailer separately because its secure target is a major-version upgrade.
- Put each coherent update group in its own branch/PR, run tests/lint/build, inspect the lockfile, deploy a preview, and smoke-test the affected flow.
- Keep provider/package versions pinned by the lockfile until that review is complete.
- Enable Dependabot alerts/security-update PRs if desired, but require human review and passing checks. Never enable automatic merging to production.
- Review dependency alerts at least monthly and promptly when GitHub/Supabase/Vercel reports a critical issue affecting a used path.

Leaving the tree untouched avoids update-induced regressions today, but retains known denial-of-service, middleware/auth-token, image-processing, and transitive-library risk and makes a later upgrade larger. The application’s actual exposure varies: some reported Nodemailer, OAuth/email-provider, custom-server, rewrite, or low-level library APIs are not used here. Record a deliberate deferral; do not treat “the site still works” as vulnerability remediation.

## Automated Checks: Sensible Baseline

The recommended baseline is additive and does not change production application behavior:

- On pull requests and pushes, run `npm ci`, `npm test`, `npm run lint`, and `npm run build` in GitHub Actions.
- Enable Dependabot alerts and security-update PRs without auto-merge.
- Add a small Playwright/browser suite for public navigation, cart/pricing behavior, checkout validation before payment, and unauthenticated admin redirects. Mock or sandbox payment providers; never automate real production charges.
- Add an independent read-only uptime check for the homepage and one health endpoint. Alert on repeated failure rather than mutating production.
- Add an environment-variable validation module or documented example containing names only, never secret values.

Risk and cost:

- CI runs against a checked-out build and cannot break the already deployed site. A failing check can block a future merge only if branch rules make it required.
- Dependabot opens reviewable PRs; it changes nothing until a human merges one.
- Browser tests can only create business state if they are pointed at production and allowed to submit real actions. Keep them on local/preview with provider mocks or sandbox credentials.
- Standard GitHub-hosted Actions are free for public repositories. Private repositories receive a monthly minute allowance based on the GitHub plan; excess usage can cost money. A modest Linux-only baseline usually fits the included allowance, but confirm the repository owner’s billing budget.
- Dependabot security updates are available for all repositories.
- Manual maintenance is limited to reviewing failures/PRs and occasionally updating brittle assertions. Budget roughly 15–30 minutes per week during active development and a monthly security review when the site is quiet.

Do not add these workflows automatically as part of an unrelated site change. Introduce them in a dedicated PR so a workflow mistake can be corrected without touching production code.

## Supabase Paid Plan and Keepalive

Supabase paid-plan projects are not automatically paused for inactivity. The daily `.github/workflows/supabase-keepalive.yml` ping is therefore not needed to keep this paid project awake.

The current workflow is harmless when configured: it performs one small read through `/api/keepalive`. It can be left as a very basic health signal, removed in a dedicated housekeeping change, or replaced with real monitoring that alerts on failure. It is not independent monitoring because both the endpoint and database must work, but the workflow currently sends no purpose-built alert beyond the GitHub job failure.

Before removing it, confirm the production project is inside the paid Supabase organization—not merely that a different organization is paid. Removing the workflow does not affect application runtime, checkout, auth, database connections, backups, or performance.

Paid Supabase reduces inactivity risk but does not remove operational work:

- Keep billing/payment details current; overdue billing can still restrict service.
- Review usage and spend-cap behavior.
- Confirm automated backup availability and retention in the project dashboard; use PITR only if the business recovery objective justifies the extra cost.
- Periodically test a documented restore/export process without overwriting production.

## Image Fetching Safety

Next.js customer-facing optimized images are already restricted to the configured Supabase public-storage host. The remaining concern is server-side preview/email code that can fetch a supplied HTTP(S) image URL.

A safe future restriction should:

1. Allow `data:` images used by normal customer uploads.
2. Allow the production Roc Candy domain and the configured Supabase public-storage origin.
3. Inventory/log any existing order image hosts before enforcement.
4. For an unapproved legacy URL, render a placeholder or safe text link rather than failing checkout, order saving, or email sending.
5. Enforce response timeout, byte limit, content type, and redirect limits.

With that design, ordinary customers will still see their uploaded images. The only likely visible difference is for a legacy saved order/cart whose logo or label points directly to an unrelated third-party host; it would show a placeholder until migrated or explicitly allowed. Do not implement a blanket “Supabase only” rejection without first checking legacy data.

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

The following are useful history but are not current general context: `infrastructure-map.md`, `admin-simple-map.*`, `README_Roadmap.rtf`, dated SEO/performance/mobile audits, rollback references, and old pricing/schema snapshots. They may describe WooCommerce, pre-launch tasks, old test counts, old routes, or temporary file paths that are no longer valid.

When behavior changes, update the two authoritative guides in the same PR. Do not duplicate a third full architecture or launch checklist.
