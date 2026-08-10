-- Add active/inactive support for packaging options.
-- Existing packaging remains active. Disabled options stay stored for historical orders.

alter table public.packaging_options
  add column if not exists is_active boolean not null default true;

update public.packaging_options
set is_active = true
where is_active is null;
