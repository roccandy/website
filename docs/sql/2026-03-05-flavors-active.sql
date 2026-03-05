-- Add active/inactive support for candy flavors.
-- Run this in Supabase SQL editor.

alter table public.flavors
  add column if not exists is_active boolean not null default true;

update public.flavors
set is_active = true
where is_active is null;
