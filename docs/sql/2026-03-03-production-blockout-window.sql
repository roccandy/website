-- Add configurable visibility window for production blockouts on website date picker.
-- Run this in Supabase SQL Editor for project wkqtbqdjgrldlfyjxpoo.

alter table public.settings
  add column if not exists quote_blockout_months int not null default 3;

update public.settings
set quote_blockout_months = 3
where quote_blockout_months is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'settings_quote_blockout_months_check'
  ) then
    alter table public.settings
      add constraint settings_quote_blockout_months_check
      check (quote_blockout_months between 1 and 12);
  end if;
end $$;
