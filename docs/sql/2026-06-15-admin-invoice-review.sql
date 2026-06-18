-- Additive fields for admin-created Square invoice review.
alter table public.orders
  add column if not exists customer_note text,
  add column if not exists square_invoice_title text;
