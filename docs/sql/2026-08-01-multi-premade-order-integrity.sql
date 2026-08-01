-- Preserve multiple premade product rows under one customer-facing order number.
-- The previous index incorrectly treated the second product as a duplicate when
-- both products were paid by the same transaction.

drop index if exists public.orders_provider_transaction_order_unique_idx;

create unique index orders_provider_transaction_order_unique_idx
  on public.orders (payment_provider, payment_transaction_id, order_number, coalesce(title, ''))
  where payment_provider is not null
    and payment_transaction_id is not null
    and order_number is not null
    and created_at >= timestamptz '2026-07-30 00:00:00+00';
