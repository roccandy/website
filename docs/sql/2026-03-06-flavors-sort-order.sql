-- Add persistent sort order for admin drag/drop on candy flavors.
-- Run this in Supabase SQL editor after 2026-03-05-flavors-active.sql.

alter table public.flavors
  add column if not exists sort_order integer;

with ordered as (
  select id, row_number() over (order by created_at asc, name asc) - 1 as rn
  from public.flavors
)
update public.flavors f
set sort_order = ordered.rn
from ordered
where f.id = ordered.id
  and f.sort_order is null;
