-- Migrate remaining editable site content to SQL-backed storage.
-- Run this in Supabase SQL Editor for project wkqtbqdjgrldlfyjxpoo.

-- 1) Ingredient label settings in the main settings table.
alter table public.settings
  add column if not exists ingredient_label_price numeric(12,2) not null default 0,
  add column if not exists ingredient_label_type_id uuid references public.label_types(id);

update public.settings
set ingredient_label_price = coalesce(ingredient_label_price, 0)
where id = 1;

-- 2) FAQs table (source of truth for public FAQ + admin FAQ editor).
create table if not exists public.site_faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer_html text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists site_faqs_sort_idx on public.site_faqs (sort_order);

-- RLS + policies
alter table public.site_faqs enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_faqs'
      and policyname = 'site_faqs_select_public'
  ) then
    create policy "site_faqs_select_public"
      on public.site_faqs
      for select
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_faqs'
      and policyname = 'site_faqs_admin_write'
  ) then
    create policy "site_faqs_admin_write"
      on public.site_faqs
      for all
      using (is_admin(auth.uid()))
      with check (is_admin(auth.uid()));
  end if;
end $$;
