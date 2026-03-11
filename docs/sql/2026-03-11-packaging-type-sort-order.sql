-- Add persistent package-type ordering for design page and packaging admin.
-- Run this in Supabase SQL editor.

alter table public.packaging_options
  add column if not exists type_sort_order integer not null default 0;

do $$
declare
  distinct_order_count integer;
  max_order integer;
begin
  select count(distinct type_sort_order), coalesce(max(type_sort_order), 0)
  into distinct_order_count, max_order
  from public.packaging_options;

  if distinct_order_count <= 1 and max_order = 0 then
    update public.packaging_options
    set type_sort_order = case lower(type)
      when 'clear bag' then 0
      when 'zip bag' then 1
      when 'jar' then 2
      when 'cone' then 3
      when 'bulk' then 4
      else 999
    end;
  end if;
end $$;
