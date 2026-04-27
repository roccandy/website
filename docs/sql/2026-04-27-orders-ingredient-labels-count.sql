-- Add ingredient label count storage to orders so paid checkouts persist to the production schedule.
-- Safe to run in Supabase SQL editor.

alter table public.orders
  add column if not exists ingredient_labels_count numeric;
