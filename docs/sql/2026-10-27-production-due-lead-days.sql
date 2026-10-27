-- Per-state and pickup due-date lead times for the admin production calendar.

alter table public.settings
  add column if not exists production_due_lead_days jsonb not null default '{"pickup":3,"WA":3,"ACT":7,"NSW":7,"NT":7,"QLD":7,"SA":7,"TAS":7,"VIC":7}'::jsonb;

update public.settings
set production_due_lead_days = '{"pickup":3,"WA":3,"ACT":7,"NSW":7,"NT":7,"QLD":7,"SA":7,"TAS":7,"VIC":7}'::jsonb
where production_due_lead_days is null;
