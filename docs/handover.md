# Roc Candy Handover Guide

Status: handover reference

Last reviewed against the repository: 2026-11-07

This guide is the secret-free handover index for the complete website. It
combines the architecture reference, operational procedures, ownership
transfer, and acceptance checks. Do not record passwords, API keys, recovery
codes, or customer data here.

## Read first

1. [System guide](architecture-notes.md) — current architecture, customer and
   admin behaviour, integrations, routes, data ownership, and environment
   variable names.
2. [Operations and release guide](launch-steps.md) — releases, monitoring,
   routine operations, and incident recovery.
3. [Future improvements control](future-improvements.md) — the only deferred
   or optional work list; it is not current system behaviour.

Those documents, this guide, the source tree, and the live provider dashboards
form the handover pack. SQL files are migration history, not a replacement for
the live schema.

## System topology

```text
Customers and staff
        |
Cloudflare DNS -> Vercel / Next.js application
        |              |-- Supabase: Postgres and Storage
        |              |-- Square: website payments and admin invoices
        |              |-- PayPal: website payments
        |              |-- SMTP: transactional and enquiry email
        |              |-- GTM/GA4, Vercel Analytics and Speed Insights
        |
Roc Candy production domain: https://roccandy.com.au
```

The storefront and admin workspace share the Next.js application. WooCommerce
and WordPress are not active integrations. See the System Guide for the
payment, order finalisation, admin-invoice, enquiry, role, route, and data-flow
details.

## Source and local setup

- Stack: Next.js App Router, React, TypeScript, Tailwind, Supabase, NextAuth,
  Square, PayPal, and Nodemailer.
- Install and run: `npm install`, provide `.env.local`, then `npm run dev`.
- Before a change or release: `npm test`, `npm run lint`, and `npm run build`.
- Scripts, package versions, and exact commands are in `package.json`.
- Required environment-variable names and their purpose are in the System
  Guide. Transfer values only through the approved password manager or each
  provider's environment-variable interface.

## Provider access transfer

For every account, transfer ownership or administrator access, confirm MFA and
recovery ownership, confirm billing ownership, and remove departed users only
after the successor has tested access. Record account identifiers and owners in
the organisation's password manager or asset register, never in this repository.

| System | Handover confirmation |
| --- | --- |
| Domain / Cloudflare | DNS zone, registrar, billing, and recovery contacts are controlled by the new owner. |
| Vercel | Project, team, production domain, deployment access, environment variables, logs, and billing are accessible. |
| Supabase | Organisation/project ownership, database access, Storage, backups/PITR policy, usage limits, and billing are confirmed. |
| Square | Application, location, production credentials, invoice settings, webhook endpoint/signature key, banking, and refunds access are confirmed. |
| PayPal | Live application, credentials, webhook/payment access, banking, and refund access are confirmed. |
| SMTP provider | Domain verification, sending identity, inbox access, credentials, deliverability logs, and billing are confirmed. |
| Google services | GTM, GA4, Search Console, Merchant Center, and Google Ads ownership/access are confirmed if used. |
| GitHub | Repository administration, branch protection, Actions/workflow access, and billing are confirmed. |

## Data and database handover

- The production source of truth is Supabase Postgres; Storage holds site and
  order/content media.
- `docs/supabase_schema.sql` is a reference snapshot. `docs/sql/` contains
  dated migrations. Compare them with the live database before any change and
  never apply an old migration blindly.
- Preserve the Supabase backup/retention policy and perform a non-destructive
  export/restore rehearsal according to the Operations Guide.
- The key active tables and Storage responsibilities are listed in the System
  Guide's **Data and Storage** section.

## Critical operational flows to demonstrate

The outgoing and incoming owners should jointly demonstrate these without
unplanned production mutations:

1. Public storefront, design flow, pre-made cart, and checkout validation.
2. Square and PayPal payment handling through sandbox or an approved
   controlled transaction, including order creation and email delivery.
3. Admin login for each role, order lookup/editing, production scheduling, and
   invoice review.
4. Square invoice payment webhook handling and direct-deposit reconciliation.
5. Enquiry submission, attachment validation, and customer/admin email flow.
6. Vercel preview deployment and production release smoke checks.
7. Supabase backup/export access and provider-log lookup for a recovery case.

Use the Operations Guide's payment-recovery and webhook procedures if a test
reveals an issue. Do not casually use live refunds, order creation, scheduling,
or webhook replay as a demonstration.

## Completion checklist

- [ ] Incoming owner has repository and provider access listed above.
- [ ] MFA, recovery, billing, and legal/business contacts are transferred.
- [ ] Environment-variable values are available securely; no secrets were
      committed to source control.
- [ ] Current production deployment, DNS, and provider dashboards are checked.
- [ ] One controlled payment path and one email/enquiry path are verified.
- [ ] Backup/restore responsibilities and incident contacts are accepted.
- [ ] Incoming owner has read the System and Operations guides.

## Documentation maintenance

- Update the System Guide for architecture, integrations, routes, environment
  variable groups, roles, payment, or data-ownership changes.
- Update the Operations Guide for release, monitoring, backup, or incident
  procedure changes.
- Update the Future Improvements Control, with a dated Change log entry, when
  deferred/optional work changes.
- Update this guide when the provider set, handover process, or acceptance
  checklist changes.
