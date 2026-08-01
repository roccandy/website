-- Preserve enough information to recover a paid checkout if order insertion fails.
-- Safe to run repeatedly.

alter table public.payment_failures
  add column if not exists payment_transaction_id text,
  add column if not exists order_number text,
  add column if not exists checkout_snapshot jsonb;

create index if not exists payment_failures_transaction_idx
  on public.payment_failures (provider, payment_transaction_id)
  where payment_transaction_id is not null;
