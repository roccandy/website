-- Harden public helper functions by setting an explicit search_path.
-- Safe to run in Supabase SQL editor.

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = uid
      and role = 'admin'
  );
$$;

create or replace function public.set_admin_users_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
