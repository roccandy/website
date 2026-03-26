# Architecture Notes

This note captures the current core architecture after the hardening/simplification pass.

## Active Auth Model

- Website/admin authentication is handled by `NextAuth` plus the `admin_users` table.
- Privileged server-side writes use the explicit admin Supabase client in [admin.ts](/Users/joeconlin/dev/roccandy/src/lib/supabase/admin.ts).
- Public managed-content reads use the explicit public Supabase client in [public.ts](/Users/joeconlin/dev/roccandy/src/lib/supabase/public.ts).
- The admin/server client now fails fast if `SUPABASE_SERVICE_ROLE_KEY` is missing. There is no anon fallback anymore.
- Transitional DB artifacts like `user_roles` / `is_admin()` may still exist in SQL/RLS history, but the active app paths are no longer built around them.

## Managed Content Sync

- Normal reads for `site_pages`, FAQs, and terms are now pure reads.
- The app no longer writes back defaults during normal page rendering.
- Built-in/default content repair is explicit via:
  - [managedContentSync.ts](/Users/joeconlin/dev/roccandy/src/lib/managedContentSync.ts)
  - [sync-managed-content.ts](/Users/joeconlin/dev/roccandy/scripts/sync-managed-content.ts)
- Run `npm run sync-managed-content` when a fresh/partial environment needs built-in content rows restored.

## Payment Finalization Flow

- Payment-provider routes keep provider-specific capture/charge logic only.
- Shared paid-order finalization now lives in [checkoutFinalize.ts](/Users/joeconlin/dev/roccandy/src/lib/checkoutFinalize.ts).
- The shared finalizer owns:
  - Woo order creation
  - enriched Supabase `orders` inserts
  - customer/admin email summary generation and sending
  - common success payload shaping
- Current consumers:
  - [square route](/Users/joeconlin/dev/roccandy/src/app/api/payments/square/route.ts)
  - [PayPal capture route](/Users/joeconlin/dev/roccandy/src/app/api/payments/paypal/capture-order/route.ts)
  - [Woo paid-order route](/Users/joeconlin/dev/roccandy/src/app/api/woo/create-paid-order/route.ts)

## Shared Public Shell

- Repeated public-site top chrome now lives in [PublicSiteHeader.tsx](/Users/joeconlin/dev/roccandy/src/components/PublicSiteHeader.tsx).
- This component owns the top links bar, logo/header, contact icons, and shared nav/menu shell.
- Public pages should reuse this component instead of inlining duplicate header markup.

## Internal Decomposition

- `QuoteBuilder` now delegates shared designer state and palette logic to:
  - [quoteBuilderShared.ts](/Users/joeconlin/dev/roccandy/src/app/quote/quoteBuilderShared.ts)
  - [quoteBuilderPalette.tsx](/Users/joeconlin/dev/roccandy/src/app/quote/quoteBuilderPalette.tsx)
- `OrdersTable` now delegates shared production-schedule and color-field logic to:
  - [ProductionScheduleSection.tsx](/Users/joeconlin/dev/roccandy/src/app/admin/orders/ProductionScheduleSection.tsx)
  - [productionScheduleShared.ts](/Users/joeconlin/dev/roccandy/src/app/admin/orders/productionScheduleShared.ts)
  - [OrderColorField.tsx](/Users/joeconlin/dev/roccandy/src/app/admin/orders/OrderColorField.tsx)
  - [orderColorUtils.ts](/Users/joeconlin/dev/roccandy/src/app/admin/orders/orderColorUtils.ts)

## Test Gate

- The repo now has a real test command: `npm test`.
- Current tests cover:
  - designer URL normalization/canonical helpers
  - redirect normalization helpers
  - explicit managed-content sync aggregation
  - shared paid-order finalization behavior
- Minimum verification for structural refactors:
  - `npm test`
  - `npm run lint`
  - `npm run build`
