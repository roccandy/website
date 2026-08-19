alter table public.settings
  add column if not exists invoice_due_days int not null default 7;

alter table public.settings
  drop constraint if exists settings_invoice_due_days_check;

alter table public.settings
  add constraint settings_invoice_due_days_check
  check (invoice_due_days between 0 and 90);
