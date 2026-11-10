# Roc Candy Future Improvements Control

Status: deferred improvements and external verification only

Last reviewed against the repository: 2026-11-10

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
   Studio now has isolated Playwright integration coverage using the real library
   actions, image validation, font layout and export routes against mocked auth
   and storage/database adapters. The combined-order integration test covers
   Studio saves, unsent drafts, order creation, remakes and resent confirmation
   PNGs. Broader normal-login regressions remain an optional extension.
2. **Order-draft autosave.** Studio recovery is now scoped to each design/order
   tab and browser tab, including embedded editing and migration of older browser
   recovery. Quiet autosave of already-saved server order drafts remains optional;
   retain explicit discard and ensure autosave cannot send mail or create invoices.
3. **Remaining precise canvas tools.** The supplied admin experience now has
   direct canvas tools, inline layer editing, resize/rotation handles, position
   locking, opacity, duplication, whole-design scaling and keyboard nudging.
   Multiple-layer selection/movement and alignment between layers remain optional.
4. **Catalogue navigation.** Search is currently by design name only. Expose the
   source-order link already stored for imports, add order/customer lookup and
   optional favourites/archive controls. Preserve order snapshots and revisions;
   do not require staff to manually categorise historical designs.
5. **Interrupted submission recovery.** Draft claims currently protect against
   repeated submissions but an ambiguous write can leave a manual reconciliation
   lock. Explore atomic order-write/draft completion and a stable submission ID
   for ordinary unsaved new orders too. Any recovery UI must verify the saved
   result before allowing a retry; never blindly unlock an uncertain write.
6. **Smaller order/editor modules.** The order form and order actions each exceed
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

- 2026-11-10 — Corrected the previously incomplete Studio interface integration.
  Ported the supplied tool rail, stage, collapsible settings, colour targets and
  inline layer controls, including its direct selection/recolour/eraser/paint
  interactions. Removed the prototype's candy renderer and browser export path;
  the application renderer, private assets, library revisions and order snapshots
  remain authoritative. Added label-mode visibility, per-layer clipping and
  whole-design scaling to the shared schema, plus compatibility/browser checks.

- 2026-11-10 — Completed the Studio follow-up: separate library-save/order-apply
  state, scoped recovery, source-resolution private assets and portable project
  envelopes, shared canonical glyph geometry with clipping warnings, numbered
  jacket colour specifications, prototype import, bundled fonts/palettes and
  native/cropped/JPEG exports. The administrator chose an optional per-order
  complexity charge (default $0), rather than element-based pricing, and approved
  viewer/colour specifications rather than requiring an unwrapped jacket model.
  Added real-code isolated integration coverage; server order-draft autosave and
  remaining multi-selection/alignment tools retain their optional scope.

- 2026-11-10 — Recorded the follow-up Studio review before pushing the initial
  integration: saved-versus-applied order state, the reproduced image/project
  round-trip failure, source resolution, rendering/production parity and missing
  prototype compatibility remain unresolved. Migration application and complete
  normal-login deployment verification remain outstanding.

- 2026-11-10 — Implemented admin Studio v2 with shared vector complex jackets,
  richer layers/text, flat/3D editing, raster selection/paint tools, immutable
  asset persistence and portable projects. Completed the optional customer proof
  PDF and part of the precise-tools proposal. Added mocked browser component
  coverage plus snapshot/export/email/print/draft/remake regression checks.
  Normal-login production verification remains external; no customer order or
  email was created for validation. The public designer is unchanged.

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
