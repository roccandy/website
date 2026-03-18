-- Add package dimensions to packaging options and prefill current rows.
-- Run this in Supabase SQL editor.

alter table public.packaging_options
  add column if not exists dimensions text;

update public.packaging_options
set dimensions = case
  when type = 'Jar' and size ilike 'Mini%' then '42mmW x 45mmH, Vol 40ml'
  when type = 'Jar' and size ilike 'Small%' then '50mmW x 70mmH, Vol 110ml'
  when type = 'Jar' and size ilike 'Medium%' then '60mmW x 80mmH, Vol 190ml'
  when type in ('Clear Bag', 'Zip Bag') and size ilike '3-5%' then '80 x 60mm'
  when type in ('Clear Bag', 'Zip Bag') and size ilike '5-7%' then '80 x 60mm'
  when type in ('Clear Bag', 'Zip Bag') and size ilike '8-10%' then '90 x 70mm'
  when type in ('Clear Bag', 'Zip Bag') and size ilike '12-15%' then '90 x 70mm'
  when type in ('Clear Bag', 'Zip Bag') and size ilike '25-30%' then '110 x 90mm'
  when type = 'Cone' then '130-250mm ribbon not incl'
  when type = 'Bulk' then null
  else dimensions
end;
