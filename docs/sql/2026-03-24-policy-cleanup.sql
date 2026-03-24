-- Remove redundant duplicate policies from the legacy schema.
-- Safe to run in Supabase SQL editor.

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'orders'
      and policyname = 'orders_admin_access'
  ) then
    drop policy "orders_admin_access" on public.orders;
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'production_slots'
      and policyname = 'slots_admin_access'
  ) then
    drop policy "slots_admin_access" on public.production_slots;
  end if;
end $$;

