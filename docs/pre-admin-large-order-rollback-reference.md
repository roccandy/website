# Pre Admin Large Order Rollback Reference

Created: 2026-06-14 19:26 AWST
Workspace: `/Users/joeconlin/dev/roccandy`
Current branch at capture time: `main`
Captured commit: `12a08310ccfb71b0b831ec1e01345e2e8e849c9f`

This document marks the rollback point immediately before the admin-created large-order workflow work. Keep it until the new workflow has been deployed, verified, and stable.

Post-snapshot implementation notes for the new workflow are in `docs/admin-large-order-workflow.md`.

## Confirmed Product Rules

- Admin-created orders may exceed public website package limits. Admin should be able to enter very large quantities such as `5000` bags if operationally needed.
- Public website limits must remain unchanged.
- A single order may have up to `20` production batch/slot assignments.
- If the calculated split needs more than `20` batches, show a warning and do not allow silent scheduling.
- Large-order auto pricing should use the sum of batch prices.
  - Example: a 20kg order split as `8kg + 8kg + 4kg` prices as the sum of the 8kg, 8kg, and 4kg batch prices.
- Admin pricing may be overridden.
- Admin-created orders should support a percent discount and a fixed-dollar discount.
- Once a Square invoice draft exists, the order price must not silently change when production batch splits are edited.
- Completion remains date-based until admin marks the finished order as shipped or picked up.
- Square invoices should be created as drafts first, ready for admin review/edit/send.
- Square invoice payment is full balance only.
- WooCommerce should match Supabase for record keeping.
- If Square invoice creation fails, keep the Supabase order unpaid and show/admin-surface a warning.

## Local Code State Saved

The committed code state was saved in Git and as a local bundle.

Saved Git refs:

- Branch: `backup/pre-admin-large-order-2026-06-14`
- Tag: `rollback/pre-admin-large-order-2026-06-14`
- Both point to commit `12a08310ccfb71b0b831ec1e01345e2e8e849c9f`.

Saved local artifacts:

- `.rollback/2026-06-14-pre-admin-large-order/current-commit.txt`
- `.rollback/2026-06-14-pre-admin-large-order/git-status-short.txt`
- `.rollback/2026-06-14-pre-admin-large-order/code-history-12a08310.bundle`
- `.rollback/2026-06-14-pre-admin-large-order/working-tree-tracked-changes.patch`
- `.rollback/2026-06-14-pre-admin-large-order/untracked-files.list`
- `.rollback/2026-06-14-pre-admin-large-order/untracked-files.tar.gz`
- `.rollback/2026-06-14-pre-admin-large-order/pre-admin-large-order-rollback-reference.md`
- `.rollback/2026-06-14-pre-admin-large-order/vercel-project-inspect.txt`
- `.rollback/2026-06-14-pre-admin-large-order/vercel-production-deployments.json`
- `.rollback/2026-06-14-pre-admin-large-order/vercel-production-current.json`
- `.rollback/2026-06-14-pre-admin-large-order/supabase-snapshot.tar.gz`
- `.rollback/2026-06-14-pre-admin-large-order/supabase-snapshot.tar.gz.sha256`
- `.rollback/2026-06-14-pre-admin-large-order/restore-public-data-from-snapshot.mjs`

At capture time, there were pre-existing uncommitted documentation changes. They were not included in the Git branch/tag because those refs point to committed code only. They were saved separately in the patch/archive above.

Tracked uncommitted files captured in the patch:

- `README.md`
- `docs/launch-steps.md`

Untracked files captured in the archive:

- `docs/admin-simple-map.md`
- `docs/admin-simple-map.png`
- `docs/admin-simple-map.svg`
- `docs/infrastructure-map.md`
- `docs/seo-technical-check-2026-06-10.md`
- `docs/site-performance-conversion-audit-2026-06-10.md`

The rollback reference was also copied into `.rollback/2026-06-14-pre-admin-large-order/` so the instructions survive local doc resets. The `.rollback/` directory is local and untracked. Do not delete it while rollback may still be needed.

## Live Data And Site State

Live Supabase and Vercel snapshots were captured before implementation.

### Supabase Snapshot

Native `pg_dump` was not available because `pg_dump` was not installed and `npx supabase db dump` requires Docker, which was not running on this machine. A direct Postgres/Supabase snapshot was captured instead.

Captured Supabase artifacts:

- Public schema/table data snapshot: `.rollback/2026-06-14-pre-admin-large-order/supabase/public-schema-data-snapshot.json`
- Public schema/table data checksum: `fc9a87b7c8625889bced3b9c05ca0c5d6de5cb7c5d836b0bddfe00f555a3bba1`
- Public table row counts: `.rollback/2026-06-14-pre-admin-large-order/supabase/public-table-row-counts.json`
- Public sequence values: `.rollback/2026-06-14-pre-admin-large-order/supabase/public-sequence-values.json`
- Supabase Storage metadata: `.rollback/2026-06-14-pre-admin-large-order/supabase/storage/storage-metadata.json`
- Supabase Storage objects: `.rollback/2026-06-14-pre-admin-large-order/supabase/storage/objects/`
- Supabase Storage object manifest: `.rollback/2026-06-14-pre-admin-large-order/supabase/storage/storage-object-manifest.json`
- Supabase Storage manifest checksum: `8bc28f8f871faf5bab7818aea66a9eb29bdc80021dbd343ec1e57d23cf73cc27`
- Compressed Supabase snapshot archive: `.rollback/2026-06-14-pre-admin-large-order/supabase-snapshot.tar.gz`
- Compressed Supabase snapshot archive checksum: `ecd66ea0b807412a8f7064098cb4a9aec3ea254e170c7db539aa8cdca2441b4b`
- Guarded public data restore helper: `.rollback/2026-06-14-pre-admin-large-order/restore-public-data-from-snapshot.mjs`

Snapshot coverage:

- Public database schema metadata, constraints, indexes, policies, table rows, row counts, and exposed public sequence values.
- Supabase Storage buckets and objects: `packaging-images`, `flavor-images`, `premade-images`, `site-content`, and `seo-images`.

Public table row counts at capture time:

- `orders`: 36
- `order_slots`: 14
- `production_slots`: 84
- `production_day_notes`: 1
- `settings`: 1
- `packaging_options`: 14
- `weight_tiers`: 9
- `customers`: 11192
- `customer_order_history`: 10081
- `customer_order_items`: 11731
- `customer_identities`: 35968
- `payment_failures`: 2739

Storage snapshot:

- Buckets: 5
- Objects: 346
- Total bytes: 17357420

### Vercel Snapshot

Vercel project:

- Project name: `roccandy`
- Project ID: `prj_x068Gnw60AOqmGCCImsf7lbhzzea`
- Org ID: `team_lLbalW9BbBP0fhrNxVfDKegB`

Current production deployment:

- Deployment URL: `roccandy-67i4xs3sr-admins-projects-e4944a60.vercel.app`
- Target: `production`
- State: `READY`
- Created at: `2026-06-13T15:08:09Z`
- Ready at: `2026-06-13T15:09:06Z`
- Deployment commit: `12a08310ccfb71b0b831ec1e01345e2e8e849c9f`
- Commit message: `Update design page defaults`
- Git ref: `main`
- Branch alias: `roccandy-git-main-admins-projects-e4944a60.vercel.app`

## Restore Local Code To This Point

Use this only when you intentionally want to discard later code changes. Save or commit any new work first.

To return the local repo to the committed rollback point:

```bash
git switch main
git reset --hard rollback/pre-admin-large-order-2026-06-14
```

To restore the pre-existing tracked uncommitted docs that existed at capture time:

```bash
git apply .rollback/2026-06-14-pre-admin-large-order/working-tree-tracked-changes.patch
```

To restore the pre-existing untracked docs that existed at capture time:

```bash
tar -xzf .rollback/2026-06-14-pre-admin-large-order/untracked-files.tar.gz -C /Users/joeconlin/dev/roccandy
```

If the Git refs are missing but the bundle remains, verify and recover from the bundle:

```bash
git bundle verify .rollback/2026-06-14-pre-admin-large-order/code-history-12a08310.bundle
git fetch .rollback/2026-06-14-pre-admin-large-order/code-history-12a08310.bundle refs/tags/rollback/pre-admin-large-order-2026-06-14:refs/tags/rollback/pre-admin-large-order-2026-06-14
```

## Restore The Site

If no database migrations have been applied, site rollback is a code/deployment rollback:

1. Restore code to `rollback/pre-admin-large-order-2026-06-14`.
2. Redeploy the restored code to production, or promote/redeploy the pre-change Vercel production deployment recorded above.
3. Confirm the public website, checkout, admin login, production schedule, Square payment, and PayPal payment paths still work.

If database migrations have been applied, restore the database first, then redeploy the code.

## Restore Supabase Data

Prefer restoring from the Supabase dashboard backup or point-in-time recovery for the timestamp recorded in this document. This is safer for a live production database than manually replaying a local JSON snapshot.

If dashboard/PITR restore is not available, use the local snapshot only after confirming the target database and maintenance window. Extract the compressed snapshot if needed:

```bash
tar -xzf .rollback/2026-06-14-pre-admin-large-order/supabase-snapshot.tar.gz -C .rollback/2026-06-14-pre-admin-large-order
```

Verify checksums:

```bash
shasum -a 256 -c .rollback/2026-06-14-pre-admin-large-order/supabase-snapshot.tar.gz.sha256
(cd .rollback/2026-06-14-pre-admin-large-order/supabase && shasum -a 256 -c public-schema-data-snapshot.sha256)
(cd .rollback/2026-06-14-pre-admin-large-order/supabase/storage && shasum -a 256 -c storage-object-manifest.sha256)
```

To restore public table data from the JSON snapshot, run the guarded helper. This truncates and reinserts public tables from the captured snapshot, so use only in a deliberate rollback window:

```bash
CONFIRM_ROLLBACK=pre-admin-large-order node .rollback/2026-06-14-pre-admin-large-order/restore-public-data-from-snapshot.mjs
```

After restoring data:

1. Run the existing schema health checks if available.
2. Open `/admin/orders` and verify existing orders and production slots.
3. Verify recent paid orders still have payment metadata.
4. Verify Woo/Square records still match the restored Supabase order records.
5. Run a smoke test on the public checkout before taking new live orders.

## Pre-Implementation Checklist

- Confirm this rollback doc still points to the correct commit.
- Create and record a Supabase production backup.
- Record the current Vercel production deployment.
- Keep public website pricing and quantity limits on the existing path.
- Put admin-only large-order behavior behind admin-only code paths.
- Add tests proving public checkout still enforces existing max package and max kg limits.
- Add tests proving admin pricing can exceed public limits and uses sum-of-batch pricing.
- Add tests for no more than `20` batch assignments per order.
