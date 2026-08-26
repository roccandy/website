# Roc Candy

Next.js storefront and admin workspace for Roc Candy.

Current stack:

- Next.js 16 App Router + TypeScript + Tailwind
- Supabase for product/content/order data
- NextAuth credentials login backed by `admin_users`
- Square + PayPal checkout
- SMTP transactional email
- Vercel hosting behind Cloudflare DNS

WooCommerce is not part of the active application. Customer and admin orders are stored in Supabase; website payments use Square or PayPal, and admin invoices use Square.

## Local setup

1. Install dependencies with `npm install`.
2. Populate `.env.local` with the current project env vars for:
   - Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - NextAuth: `NEXTAUTH_SECRET`
   - Payments: Square and PayPal client/server keys
   - Email: `SMTP_*`, `ORDERS_EMAIL`, `ENQUIRIES_EMAIL`
3. Start the app with `npm run dev`.

If you are pointing at a fresh or incomplete Supabase environment, run `npm run sync-managed-content` to restore the built-in managed content rows.

## Verification

Run these before merging or deploying application changes:

- `npm test`
- `npm run lint`
- `npm run build`

## Key docs

- [System guide](docs/architecture-notes.md) — current architecture, behavior, data, integrations, and environment variables.
- [Operations and release guide](docs/launch-steps.md) — safe release checks, maintenance, monitoring, and incident handling.

These are the only two general documents that should be supplied to an LLM for current site context. Other files under `docs/` are implementation records, SQL references, or dated historical snapshots unless one of these guides explicitly links to them.
