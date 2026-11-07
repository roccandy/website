-- Admin safety and payment-recovery workspace.
-- Apply in Supabase SQL editor before deploying the matching application code.
-- Safe to run repeatedly.

-- Never permit the final active admin to be demoted, deactivated, or deleted.
-- The transaction-scoped advisory lock also prevents concurrent updates from
-- bypassing the count check.
create or replace function public.prevent_last_active_admin_removal()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
declare
  active_admin_count integer;
begin
  if old.role = 'admin' and old.is_active and (
    tg_op = 'DELETE' or new.role <> 'admin' or not new.is_active
  ) then
    perform pg_advisory_xact_lock(hashtext('public.admin_users:last_active_admin'));
    select count(*)
      into active_admin_count
      from public.admin_users
      where role = 'admin' and is_active;
    if active_admin_count <= 1 then
      raise exception 'At least one active admin user must remain.';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists prevent_last_active_admin_removal on public.admin_users;
create trigger prevent_last_active_admin_removal
before update or delete on public.admin_users
for each row execute function public.prevent_last_active_admin_removal();

-- Keep a resolution record for paid checkouts that need manual reconciliation.
alter table public.payment_failures
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by_email text,
  add column if not exists resolution_note text;

create index if not exists payment_failures_open_created_idx
  on public.payment_failures (created_at desc)
  where resolved_at is null;
