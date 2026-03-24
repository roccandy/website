-- Harden remaining public tables that are missing RLS/policies.
-- Safe to run in Supabase SQL editor.

-- 1) Flavors are public-read and admin-write.
alter table public.flavors enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'flavors'
      and policyname = 'flavors_select_public'
  ) then
    create policy "flavors_select_public"
      on public.flavors
      for select
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'flavors'
      and policyname = 'flavors_admin_write'
  ) then
    create policy "flavors_admin_write"
      on public.flavors
      for all
      using (is_admin(auth.uid()))
      with check (is_admin(auth.uid()));
  end if;
end $$;

-- 2) Label types are used in the public design flow and editable by admins.
alter table public.label_types enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'label_types'
      and policyname = 'label_types_select_public'
  ) then
    create policy "label_types_select_public"
      on public.label_types
      for select
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'label_types'
      and policyname = 'label_types_admin_write'
  ) then
    create policy "label_types_admin_write"
      on public.label_types
      for all
      using (is_admin(auth.uid()))
      with check (is_admin(auth.uid()));
  end if;
end $$;

-- 3) Payment failures should never be public-readable, but should be protected by RLS.
alter table public.payment_failures enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'payment_failures'
      and policyname = 'payment_failures_admin_write'
  ) then
    create policy "payment_failures_admin_write"
      on public.payment_failures
      for all
      using (is_admin(auth.uid()))
      with check (is_admin(auth.uid()));
  end if;
end $$;

