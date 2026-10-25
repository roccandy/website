# Checkout and admin usability improvements

## Pre-made candy

Website checkout no longer asks for a delivery/pickup date for pre-made-only
orders. It explains that dispatch happens when ready or that pickup readiness
will be confirmed. The server ignores dates supplied for pre-made-only carts.
Mixed carts still require a valid custom-candy date, but pre-made order rows
always have `due_date=null`. Shipping/pickup choice and address validation remain.

## Bank transfers

The invoice summary offers **Record bank transfer** for both sent PDF invoices
and unpaid Square card-link invoices. PDF recording accepts the full combined
invoice amount, payment date and an optional bank reference (saved in the audit
log). It does not charge the customer or send another confirmation email.

For published Square invoices, record the transfer in Square first, then select
**Check Square payment** in admin. The server retrieves the invoice read-only
and requires fully paid status and a matching AUD amount. Square does not permit
its API to record external invoice payments. Merely setting local paid status
would leave the Square invoice payable and its reminders active.

Partial/in-flight Square webhook payments no longer mark an order fully paid.
Full payment updates preserve scheduling/completion status.

## Short custom text

Straight custom text uses 1.7x sizing for one non-space character, 1.4x for two
or three, 1.2x for four or five, and existing sizing for six or more. Wedding,
logo and long-text layouts are unchanged. SVG and email PNG previews share the
sizing policy.

## Admin loading

Today and the Production Schedule use 30-second server data snapshots, behind
the existing uncached authentication/permission checks. Checkout, order editing
and mutation validation continue reading fresh data. Production queries omit
unused label artwork, paginate beyond database caps and retain historical
calendar orders, logos and assignments. Inline logos are represented by small,
versioned authenticated image URLs instead of repeatedly embedding their bytes
in the page payload. Artwork bytes in the database are unchanged; the new image
route does not fetch remote URLs and uses private caching and restrictive CSP.

Admin activity writes, successful checkout, refunds and Square invoice webhooks
expire both snapshots. Today's Refresh bypasses the snapshots. Visible pages
refresh quietly when old, and on focus; refreshes defer during edits, dialogs,
dragging and pending actions. Full-page navigation prefetching warms the two
Today/Production views (not just their skeletons). View preferences persist, but
no order data is stored in localStorage.

These changes reduce repeated fetch/render work; they do not guarantee instant
first visits or offline operation. Direct database maintenance outside the app
can remain visible in a cached snapshot until its short expiry/refresh.
