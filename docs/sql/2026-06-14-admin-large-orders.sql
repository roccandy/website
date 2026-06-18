-- Admin-created large order support.
-- Safe rollout: additive nullable columns only.
-- Apply after the pre-admin-large-order rollback snapshot has been captured.

alter table public.orders
  add column if not exists admin_batch_weights_kg numeric[] not null default '{}',
  add column if not exists admin_pricing_subtotal numeric,
  add column if not exists admin_discount_type text,
  add column if not exists admin_discount_value numeric,
  add column if not exists admin_price_override numeric,
  add column if not exists admin_price_locked_at timestamptz,
  add column if not exists square_customer_id text,
  add column if not exists square_order_id text,
  add column if not exists square_invoice_id text,
  add column if not exists square_invoice_version int,
  add column if not exists square_invoice_status text,
  add column if not exists square_invoice_url text,
  add column if not exists square_invoice_due_date date,
  add column if not exists square_invoice_created_at timestamptz,
  add column if not exists square_invoice_sent_at timestamptz,
  add column if not exists square_invoice_error text;

create index if not exists orders_square_invoice_id_idx
  on public.orders (square_invoice_id)
  where square_invoice_id is not null;

create index if not exists orders_square_order_id_idx
  on public.orders (square_order_id)
  where square_order_id is not null;

create index if not exists orders_admin_price_locked_at_idx
  on public.orders (admin_price_locked_at)
  where admin_price_locked_at is not null;
