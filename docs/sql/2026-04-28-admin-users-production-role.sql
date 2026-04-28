-- Add the Production admin role to an existing admin_users table.
-- Run this once in Supabase SQL editor before creating a Production user.

do $$
declare
  constraint_name text;
begin
  select tc.constraint_name
    into constraint_name
  from information_schema.table_constraints tc
  join information_schema.check_constraints cc
    on cc.constraint_name = tc.constraint_name
  where tc.table_schema = 'public'
    and tc.table_name = 'admin_users'
    and tc.constraint_type = 'CHECK'
    and cc.check_clause ilike '%role%'
    and cc.check_clause ilike '%viewer%'
    and cc.check_clause ilike '%editor%'
    and cc.check_clause ilike '%admin%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.admin_users drop constraint %I', constraint_name);
  end if;

  alter table public.admin_users
    add constraint admin_users_role_check
    check (role in ('viewer', 'seo', 'editor', 'production', 'admin'));
end $$;
