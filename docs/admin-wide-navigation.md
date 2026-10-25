# Shared admin navigation and read models

## Navigation

All primary admin tabs and All tools links use `AdminTabLink`, rather than a
Today/Production-specific prefetch rule. Main tabs eagerly preload full read
views into Next's in-memory router cache; All tools links preload on intent,
avoiding a flood of requests when the tools menu opens. The last list URL per tab
is remembered in browser memory.
Pagination, filters, search and sort parameters survive switching tabs. Exact
filter/Clear links still use `AdminLink`, so they do not accidentally restore an
old filter. Native new-tab/modifier-key links continue working.

Other admin links prefetch full read content on hover, keyboard focus or touch.
Entry/edit/password forms are excluded from full prefetch. Same-origin GET forms
use shared client navigation, rather than a document reload that discards warmed
routes. POST/save forms are not intercepted. Logout clears remembered locations.

The shared admin template timestamps every route, so stale read views refresh
quietly on revisit, focus and the existing 30-second timer. Refresh defers during
editing, dirty POST forms, open dialogs, dragging or pending actions. This uses
the router's memory cache; it does not keep every editor mounted or persist
customer records/drafts in localStorage. Existing scroll restoration remains.

## Data and scaling

- Orders uses database-side grouping, filtering, search, sorting, counts and
  pagination through `admin_order_history_page`. Pages contain 50 complete base
  order families (including suffixes beyond `-b`), plus only their assignments
  and slots. Order/label artwork is excluded. Search and sort operate on the
  complete dataset, not only the current page. Invalid pages clamp to bounds.
- Customers already uses bounded database list queries; its summary totals now
  aggregate in PostgreSQL rather than fetching a capped list of profiles.
- Invoices, Insights, legacy stats and production-day/premade read views use
  short-lived server read models. Authentication and role checks remain outside
  these caches; order/payment/edit mutations still read fresh server data.
- Creation/edit screens fetch lightweight calendar-reference orders, while the
  actual order and linked invoice/remake artwork remain full, fresh reads.
- Admin saves share `revalidateAdminPath`, expiring read-model tags and router
  entries. Checkout, refunds and invoice webhooks retain their invalidation hooks.

Apply `docs/sql/2026-10-25-admin-read-pagination.sql` before deploying. It only
adds read-only SQL functions, executable by `service_role` (not public/anon or
authenticated browser roles), and requests a PostgREST schema refresh. It does
not modify order/customer records or their payment state.

## Verification

Unit checks cover route/entry policies, parameter preservation, paged RPC calls,
search limits, failure handling and shared save invalidation. Read-only database
checks verified every real order appears once across the pages, complete split
families, all sort directions, filters, search and restricted SQL execution.
20,000 synthetic orders were tested in session-private temporary tables, then
rolled back; production records were untouched. Browser checks cover all six
primary tabs, pagination/search return state, GET forms without document reload,
responsive navigation and anonymous-session redirects.

Warm local navigation is not a guarantee of live network latency: first visits,
new filters and explicit refreshes can still require server work. Counts/search
stay database-side as history grows instead of transferring/rendering every row.
