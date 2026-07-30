-- Checkout integrity safeguards. Safe to run in the Supabase SQL editor.

-- A provider transaction may cover several split order rows, but never the same
-- newly-created order row twice. Historical imports contain duplicate pairs, so
-- they are deliberately left intact while all new checkout rows are protected.
create unique index if not exists orders_provider_transaction_order_unique_idx
  on public.orders (payment_provider, payment_transaction_id, order_number)
  where payment_provider is not null
    and payment_transaction_id is not null
    and order_number is not null
    and created_at >= timestamptz '2026-07-30 00:00:00+00';
