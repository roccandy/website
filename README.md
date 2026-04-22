# Roc Candy

Next.js storefront and admin workspace for Roc Candy.

Current stack:

- Next.js 16 App Router + TypeScript + Tailwind
- Supabase for product/content/order data
- NextAuth credentials login backed by `admin_users`
- Square + PayPal checkout
- WooCommerce order mirroring

## Local setup

1. Install dependencies with `npm install`.
2. Populate `.env.local` with the current project env vars for:
   - Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - NextAuth: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
   - Payments: Square and PayPal client/server keys
   - WooCommerce: `WOO_*`
   - Email: `SMTP_*`, `ORDERS_EMAIL`, `ENQUIRIES_EMAIL`
3. Start the app with `npm run dev`.

If you are pointing at a fresh or incomplete Supabase environment, run `npm run sync-managed-content` to restore the built-in managed content rows.

## Verification

Run these before major merges or launch changes:

- `npm test`
- `npm run lint`
- `npm run build`

## Key docs

- [docs/launch-steps.md](/Users/joeconlin/dev/roccandy/docs/launch-steps.md)
- [docs/architecture-notes.md](/Users/joeconlin/dev/roccandy/docs/architecture-notes.md)

Treat [docs/launch-steps.md](/Users/joeconlin/dev/roccandy/docs/launch-steps.md) as the main go-live document.
