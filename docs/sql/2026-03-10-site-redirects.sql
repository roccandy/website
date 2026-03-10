-- Add admin-managed public redirects.
-- Run this in Supabase SQL editor.

create table if not exists public.site_redirects (
  source_path text primary key,
  destination_path text not null,
  status_code int not null default 301 check (status_code in (301, 302)),
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.site_redirects enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_redirects'
      and policyname = 'site_redirects_select_public'
  ) then
    create policy "site_redirects_select_public"
      on public.site_redirects
      for select
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_redirects'
      and policyname = 'site_redirects_admin_write'
  ) then
    create policy "site_redirects_admin_write"
      on public.site_redirects
      for all
      using (is_admin(auth.uid()))
      with check (is_admin(auth.uid()));
  end if;
end $$;
