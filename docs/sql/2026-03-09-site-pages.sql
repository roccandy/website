-- Add SQL-backed editable site pages that store raw HTML.
-- Run this in Supabase SQL editor.

create table if not exists public.site_pages (
  slug text primary key,
  title text not null default '',
  body_html text not null default '',
  seo_title text,
  meta_description text,
  og_image_url text,
  canonical_url text,
  updated_at timestamptz not null default now()
);

alter table public.site_pages enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_pages'
      and policyname = 'site_pages_select_public'
  ) then
    create policy "site_pages_select_public"
      on public.site_pages
      for select
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_pages'
      and policyname = 'site_pages_admin_write'
  ) then
    create policy "site_pages_admin_write"
      on public.site_pages
      for all
      using (is_admin(auth.uid()))
      with check (is_admin(auth.uid()));
  end if;
end $$;
