-- Nullable fields preserve existing white fill/pinstripe defaults without rewriting orders.
begin;
alter table public.orders
  add column if not exists candy_fill_color text check (candy_fill_color ~ '^#[0-9a-fA-F]{6}$'),
  add column if not exists pinstripe_color text check (pinstripe_color ~ '^#[0-9a-fA-F]{6}$');
commit;
