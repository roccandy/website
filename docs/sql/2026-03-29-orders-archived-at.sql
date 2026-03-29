-- Add archived_at so completed custom orders can be sorted by actual completion time.
-- Safe to run in Supabase SQL editor.

alter table public.orders
  add column if not exists archived_at timestamptz;

update public.orders
set archived_at = coalesce(archived_at, refunded_at, shipped_at, due_date::timestamptz, created_at)
where status = 'archived'
  and archived_at is null;
