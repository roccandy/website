begin;

create table if not exists public.packaging_lid_colors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  hex text not null check (hex ~ '^#[0-9a-fA-F]{6}$'),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.packaging_lid_colors (name, hex, sort_order)
values
  ('black', '#1f1f1f', 0),
  ('silver', '#d7d7d7', 1),
  ('gold', '#d2b16f', 2)
on conflict (name) do update set
  hex = excluded.hex,
  sort_order = excluded.sort_order;

insert into public.packaging_lid_colors (name, hex, sort_order)
select distinct lower(trim(lid.name)), '#d4d4d8', 100
from public.packaging_options
cross join lateral unnest(coalesce(packaging_options.lid_colors, '{}')) as lid(name)
where trim(lid.name) <> ''
on conflict (name) do nothing;

alter table public.packaging_lid_colors enable row level security;

drop policy if exists "packaging_lid_colors_select_public" on public.packaging_lid_colors;
create policy "packaging_lid_colors_select_public"
  on public.packaging_lid_colors for select
  using (true);

drop policy if exists "packaging_lid_colors_admin_write" on public.packaging_lid_colors;
create policy "packaging_lid_colors_admin_write"
  on public.packaging_lid_colors for all
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

commit;
