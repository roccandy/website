-- Add SQL-backed Terms & Conditions content.
-- Run this in Supabase SQL editor.

create table if not exists public.site_terms_items (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.site_terms_items(id) on delete cascade,
  marker text not null default '',
  title text not null default '',
  body text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists site_terms_items_parent_sort_idx
  on public.site_terms_items (parent_id, sort_order);

alter table public.site_terms_items enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_terms_items'
      and policyname = 'site_terms_items_select_public'
  ) then
    create policy "site_terms_items_select_public"
      on public.site_terms_items
      for select
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_terms_items'
      and policyname = 'site_terms_items_admin_write'
  ) then
    create policy "site_terms_items_admin_write"
      on public.site_terms_items
      for all
      using (is_admin(auth.uid()))
      with check (is_admin(auth.uid()));
  end if;
end $$;
