# Order email and document archive

Apply `docs/sql/2026-10-24-order-email-archive.sql` before deploying the feature.
It creates a private bucket and a service-role-only table; it does not reconstruct historical messages or change orders.

Website-generated order confirmations/updates, PDF invoices, refunds and internal order notifications are captured going forward. Combined messages are associated with every exact linked order ID/number. Square-generated email and manual mailbox messages are not captured. The archive starts when this feature is deployed, not when the SQL is applied.

## Original content

MIME is compiled once. The exact same bytes are archived and submitted to SMTP. The archive also stores the HTML, plain text, immutable original attachment bytes, content IDs and SHA-256 checksums. Downloads verify checksums. Order edits and future template changes do not alter these originals. Database triggers prevent changes to saved message content; only submission status may be updated.

Private files are streamed only through authenticated admin endpoints. Production-only accounts, anonymous users and direct browser database clients cannot read them. Preview HTML is sanitised, displayed in an opaque sandboxed iframe and served with a restrictive CSP. Original embedded images are loaded from the archive, not fetched from current order URLs. Scripts, external resources, forms and navigation are disabled in previews. The downloadable `.eml` remains unchanged.

## Sending and failures

- Original storage and the history record must succeed before SMTP is attempted. If archiving fails, the email is not submitted. Paid checkout orders remain saved; the existing email-warning path reports the failure.
- `prepared` means no SMTP submission is recorded. `sending` and `unconfirmed` mean the result must be checked before any retry.
- `accepted` means SMTP accepted the recipients, not that the customer received/read the message. This implementation does not claim bounce/open tracking.
- `partial`/`rejected` retain the affected recipients. A rejected customer is surfaced as a send error even if an internal BCC was accepted.
- A failed final status write must not turn a successful SMTP submission into an automatic resend. It remains visibly unconfirmed.
- A timeout is ambiguous: check the operational mailbox/provider before retrying. There is no automatic resend action in the archive UI.
- When SMTP is disabled or unconfigured, existing sends are skipped; no sent record is fabricated.
- Checkout retains its quick response, but registers the same in-flight email/archive promises with Next.js `after` so they can finish after the response. This is not a second send or a retry.

## Operations and privacy

The table and bucket contain customer personal information and must stay private. Retain them in the site's backup/access and customer-data deletion policy; this change does not add automatic retention or purge old records. Failed preparation can leave private unlinked blobs, which may be reviewed and cleaned with a separately scoped retention job. Never delete an original merely because its linked order has changed or been archived.

Test with synthetic messages and a stub SMTP submitter. Do not send real customer emails to test this feature.
