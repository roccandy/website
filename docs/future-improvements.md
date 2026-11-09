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

The administrator is satisfied with the current GTM/GA4 setup. Broad tag or
conversion changes are not proposed. The reported GA4 ecommerce item-revenue
discrepancy remains deferred until the administrator chooses to investigate it.
Compare emitted purchase/item values with the corresponding order and GA4
report before proposing a change; no new live payment is authorised by this item.

Owner: business/marketing administrator, with the development maintainer
investigating the purchase payload when requested.

### Production checks

These are validation tasks, not missing features:

- Re-run representative mobile Lighthouse checks after meaningful homepage or
  asset changes.
- Manually check sticky design and checkout controls at supported phone widths
  after layout changes.
- Continue the monthly/quarterly provider, payment, email, backup, and role
  checks in the operations guide.

## Optional engineering hardening

### Admin design and order workflow review

The following are proposals from the 2026-11-07 repository review, awaiting the
administrator's choice of scope. Owner: development maintainer; the business
administrator prioritises user-facing workflow changes. These proposals add no
mandatory daily checklist or customer-approval gate.

1. **Browser regression coverage.** Prioritise the automated delivery checks
   below around normal-login draft save/resume/discard, navigation and refresh,
   multi-tab orders, Studio save/copy, private artwork, print and exports. The
   latest local unit/build checks passed; a complete signed-in browser
   click-through and production deployment verification remain unverified.
2. **Recovery for each design.** Studio currently has one global browser recovery
   key, and embedded Studio editing does not use that recovery mechanism. Scope
   recovery to each design/edit session and preserve unfinished embedded artwork.
   Consider quiet autosave of already-saved order drafts with a clear saved time;
   retain explicit discard and ensure autosave cannot send mail or create invoices.
3. **Precise canvas tools.** Add a flat face editing view alongside the 3D preview,
   centre/snap guides, alignment, layer locking, and multiple-layer selection and
   movement. Existing duplication, zoom and keyboard nudging remain available.
   These tools should reduce repeated numeric adjustments for advanced mockups.
4. **Catalogue navigation.** Search is currently by design name only. Expose the
   source-order link already stored for imports, add order/customer lookup and
   optional favourites/archive controls. Preserve order snapshots and revisions;
   do not require staff to manually categorise historical designs.
5. **Customer proof export.** Add an optional, clearly formatted proof with the
   flat face, 3D preview, design/order name and revision. Generate useful filenames
   automatically. Email-thread integration belongs to the separately planned mail
   system; proof approval must not become a required step to create an order.
6. **Interrupted submission recovery.** Draft claims currently protect against
   repeated submissions but an ambiguous write can leave a manual reconciliation
   lock. Explore atomic order-write/draft completion and a stable submission ID
   for ordinary unsaved new orders too. Any recovery UI must verify the saved
   result before allowing a retry; never blindly unlock an uncertain write.
7. **Smaller order/editor modules.** The order form and order actions each exceed
   3,000 lines. Extract draft persistence, invoice submission and artwork handling
   into focused modules with regression coverage as those areas change, retaining
   current behaviour. This is developer maintenance with no extra admin steps.

### Automated delivery checks

If development cadence warrants it, add a dedicated CI change that runs
`npm ci`, tests, lint, and build on pushes and pull requests. Consider a small
preview-only browser suite, Dependabot alerts without auto-merge, independent
uptime monitoring, and environment-variable name validation. These are not
required for the live application to operate.

### Runtime dependency maintenance

The 2026-11-07 verification still reports two high-severity audit findings in
the existing Nodemailer/NextAuth dependency chain. A dedicated dependency
upgrade should follow the controlled process in the operations guide, including
SMTP and authentication regression checks; the Design Studio change does not
upgrade these packages. Owner: development maintainer, with the business
administrator choosing the maintenance window.

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

The mail system is a separate administrator-intended project. Its brief may
include enquiry handling, email threads and the currently unused Today page;
implementation is not authorised by the Studio/draft changes. Mailbox ingestion
and AI drafting need an explicit brief within that project.

The following were previously proposed but are not planned work: operations
automation/outbox queues, automatic schedule
proposals, inventory and purchasing workflows, QR/barcode fulfilment,
carrier-label integration, a customer self-service portal, and automated
customer communications. Re-open any of these only with a new approved brief.

## Change log

- 2026-11-07 — Reviewed the implemented admin workflow and recorded seven
  unapproved improvement proposals, prioritising browser regression coverage,
  recovery, precise editing, catalogue access and interrupted submissions.
  Corrected the analytics/mail scope to reflect the administrator's existing
  preferences: defer the item-revenue discrepancy and keep the planned mail
  system separate. No application behaviour changed in this review.

- 2026-11-07 — Added persistent, explicitly unsent admin order drafts, schedule
  resume/discard controls, and leave-page save/discard choices. Existing-order
  drafts preserve the live order; revision/source checks and submission claims
  protect against stale changes and duplicate submissions. Current behaviour and
  recovery procedure are in the architecture and operations guides.
- 2026-11-07 — Imported all 208 eligible historical custom designs into the
  catalogue using order titles, preserving two existing entries and all source
  orders. Added order-title naming for new mockups/snapshots. Made original
  artwork private with authenticated previews and embedded exports before import.
- 2026-11-07 — Reviewed earlier local smoke-test access and removed both
  temporary credential-loading helpers. Changed local preview to loopback only;
  documented normal-login testing and the limit that generated sessions were not
  individually revoked. No signing-secret rotation was performed.

- 2026-11-07 — Aligned new Studio designs, added layers, presets, and basic-order
  imports with the public designer's neutral palette, font stack, sizing,
  spacing, wedding/long-text layouts and artwork footprint. Added explicit
  layer/jacket reset controls; saved artwork retains its existing settings.

- 2026-11-07 — Corrected Custom Segments jacket rendering so each visible side
  panel continues the colour of its adjoining face segment in previews and
  exports. Other jacket modes retain their existing mapping.

- 2026-11-07 — Implemented the admin Design Studio: editable layered artwork,
  protected versioned library, order snapshots, exports, production/print
  specifications and customer-safe confirmation summaries. Advanced mockups no
  longer require using the branded-logo field. Current behaviour and operating
  instructions are recorded in the system and release guides.
- 2026-11-07 — Rechecked the runtime dependency audit during Studio validation;
  retained the existing mail/auth dependency upgrade as separate maintenance.

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
