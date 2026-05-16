alter table public.orders
  add column if not exists refunded_amount numeric;

update public.orders
set refunded_amount = coalesce(total_price, 0)
where refunded_at is not null
  and coalesce(status, '') <> 'partially-refunded'
  and refunded_amount is null;

update public.orders
set refunded_amount = 0
where refunded_at is null
  and refunded_amount is null;
