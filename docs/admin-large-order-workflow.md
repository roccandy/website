# Admin Large Order Workflow

Created: 2026-06-14

## Safety Snapshot

Before implementation, a rollback snapshot was saved and documented in:

- `docs/pre-admin-large-order-rollback-reference.md`
- `.rollback/2026-06-14-pre-admin-large-order/`

That rollback reference includes the git branch/tag, Vercel deployment metadata, Supabase public data snapshot, Supabase Storage object snapshot, checksums, and restore commands.

## Confirmed Product Rules

- Admin order creation can exceed the public website packaging maximum.
- Maximum production batches for one admin-created order: 20.
- The old max-batch-size warning copy is hidden; admins use the batch allocation controls instead.
- Show a blocking warning if the order would need more than 20 batches.
- Large-order pricing uses the sum of selected batch prices.
- Pricing is automatic, with optional fixed-dollar or percentage discount.
- Admin can override the final total.
- Once a Square invoice draft exists, price is locked and should not silently change if batch allocation changes later.
- Production scheduling remains date-based. Multi-batch orders are one order with multiple production slot assignments.
- Multi-date orders show `partially scheduled` after some, but not all, planned batches are assigned.
- Multi-date orders show `partially made` after at least one assigned batch date has passed and before all planned batches have passed.
- Completed production dates are labelled `made` in the schedule.
- The order can only be marked shipped/collected after every assigned production date has passed.

## Database Change

Migration files:

- `docs/sql/2026-06-14-admin-large-orders.sql`
- `docs/sql/2026-06-15-admin-invoice-review.sql`

The migrations are additive. They add admin batch allocation, admin pricing lock, Square invoice tracking fields, and separate production/customer note fields to `public.orders`, plus supporting indexes.

Applied to Supabase on 2026-06-14 after the rollback snapshot was captured. Verification found all 16 expected new columns on `public.orders`.

Apply with:

```bash
npm run db:apply-sql -- docs/sql/2026-06-14-admin-large-orders.sql
npm run db:apply-sql -- docs/sql/2026-06-15-admin-invoice-review.sql
```

Do not deploy code that writes the new order columns before this migration has been applied.

## Square Setup

The admin create flow creates:

- one pending Woo order mirror
- one Square customer
- one Square order
- one Square invoice draft

The Square invoice starts as a draft. Admin is redirected to the Roc Candy invoice review screen, can edit customer-facing invoice fields, and sends the Square invoice from admin.
Customer notes and Direct Deposit instructions are written into the standard Square invoice description. The order line in that message uses the selected packaging type, size, and jar lid colour where relevant, for example `1500 x Bulk - 1kg` or `1500 x Jar - Small - Black Lid`. GST is applied to the Square order as an inclusive 10% tax so Square shows GST correctly in the invoice summary. Do not use Square invoice custom fields for this workflow because Square can require a paid plan for that feature.

Required existing env vars:

- `SQUARE_ACCESS_TOKEN`
- `SQUARE_LOCATION_ID`
- `SQUARE_API_BASE`
- `WOO_BASE_URL`
- `WOO_CONSUMER_KEY`
- `WOO_CONSUMER_SECRET`
- `WOO_CUSTOM_PRODUCT_ID`

New webhook env vars:

- `SQUARE_INVOICE_WEBHOOK_SIGNATURE_KEY`
- `SQUARE_INVOICE_WEBHOOK_URL`

Webhook endpoint:

- `/api/payments/square/invoice-webhook`

Subscribe the Square webhook to:

- `invoice.payment_made`
- `invoice.published`
- `invoice.updated`

When `invoice.payment_made` is received, Supabase is marked paid with `payment_provider = square_invoice`, the Woo mirror is moved to paid/processing, and the orders inbox receives a paid-invoice notification.

Admin-created customer confirmation emails use the same email summary as website orders. Because the admin form does not capture a browser-rendered preview image, the email generates a static preview from the saved order fields, including branded logos, wedding hearts, initials mode, and two-colour pinstripe jackets.

## Operational Notes

- If Woo or Square invoice creation fails, the Supabase order remains saved and unpaid.
- The failure text is stored on `orders.square_invoice_error`.
- Admin order rows show an invoice warning badge when `square_invoice_error` exists.
- Admin order rows show a payment overdue badge when an unpaid admin-managed order is past its due date.
- Public customer quote/checkout limits are unchanged.
