# Roc Candy Future Improvements Control

Status: deferred improvements and external verification only

Last reviewed against the repository: 2026-11-07

The website and its current admin workspace are implemented. This is the single
place for work that is deliberately deferred, optional, or dependent on an
external service. It is not a product roadmap and does not imply a commitment
to build every item.

## How to use this document

- Add an item only when there is an owner, reason, and an intended decision.
- Move an item to the current system or operations guide when it becomes active
  behaviour or a routine procedure.
- Delete an item when it is declined. Do not keep completed work as a backlog.
- Verify third-party dashboards directly; repository code cannot prove their
  configuration or data collection.
- When an item changes, update this document in the same change and append a
  dated note to the Change log below. `AGENTS.md` makes this mandatory for
  repository agents.

## External verification

### Analytics and advertising

The website emits `view_item`, `add_to_cart`, `begin_checkout`, `purchase`,
`enquiry_form_start`, and `generate_lead` data-layer events. The remaining
work, if measurement is required, is in GTM/GA4/Google Ads rather than this
repository:

- Create and publish GTM event tags for `enquiry_form_start` and
  `generate_lead`, including `lead_type` and `source_page`.
- Submit a test enquiry and verify `generate_lead` in GA4 without customer
  personal data in analytics payloads.
- Run an approved controlled payment and verify one `purchase` event with a
  non-empty `transaction_id`.
- Mark the intended lead and purchase events as GA4 key events and configure
  the corresponding Google Ads conversions if Ads optimisation uses them.

Owner: business/marketing administrator with access to the external accounts.

### Production checks

These are validation tasks, not missing features:

- Re-run representative mobile Lighthouse checks after meaningful homepage or
  asset changes.
- Manually check sticky design and checkout controls at supported phone widths
  after layout changes.
- Continue the monthly/quarterly provider, payment, email, backup, and role
  checks in the operations guide.

## Optional engineering hardening

### Automated delivery checks

If development cadence warrants it, add a dedicated CI change that runs
`npm ci`, tests, lint, and build on pushes and pull requests. Consider a small
preview-only browser suite, Dependabot alerts without auto-merge, independent
uptime monitoring, and environment-variable name validation. These are not
required for the live application to operate.

### Server-side image fetching

Customer-facing image optimisation already restricts remote hosts. Server-side
email and preview helpers can still fetch supplied HTTP(S) image URLs. Before
restricting those fetches, inventory existing image hosts and preserve normal
`data:` uploads, the Roc Candy host, and the Supabase storage host. Apply
timeouts, byte/content-type/redirect limits, and a safe placeholder for legacy
unapproved URLs.

### Optional SEO enhancements

The current technical SEO implementation is sufficient for the live site.
Only add these when there is a specific search or content reason:

- `LocalBusiness` structured data.
- `BreadcrumbList` structured data.
- `VideoObject` structured data if the feature video is intended to rank as
  standalone video content.
- `humans.txt` (entirely optional).

## Explicitly out of scope unless re-opened

The following were previously proposed but are not planned work: operations
automation/outbox queues, mailbox ingestion or AI drafting, automatic schedule
proposals, inventory and purchasing workflows, QR/barcode fulfilment,
carrier-label integration, a customer self-service portal, and automated
customer communications. Re-open any of these only with a new approved brief.

## Change log

- 2026-11-07 — Created as the sole control document for future improvements;
  consolidated remaining external verification and optional hardening work.
- 2026-11-07 — Added final-admin protection and an admin payment-recovery
  workspace (requires the matching SQL migration on deployment). Deferred
  enquiry handling to the planned mail system; declined a daily exception
  email, extra dispatch fields, completion checklists, and further GA4 work
  for now.
- 2026-11-07 — Limited payment recovery to successful-payment order-finalisation
  failures, excluding browser payment telemetry that does not require order
  reconciliation.
- 2026-11-07 — Added resolved payment-recovery history, including resolution
  date, resolver, and reconciliation note.
