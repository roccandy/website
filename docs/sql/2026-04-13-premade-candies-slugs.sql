-- Add clean editable slugs to premade_candies and backfill them from names.
-- Apply with:
-- npm run db:apply-sql -- docs/sql/2026-04-13-premade-candies-slugs.sql

alter table public.premade_candies
  add column if not exists slug text;

with prepared as (
  select
    id,
    coalesce(
      nullif(
        trim(
          both '-'
          from regexp_replace(
            regexp_replace(
              regexp_replace(lower(coalesce(name, '')), '[''’]+', '', 'g'),
              '[^a-z0-9]+',
              '-',
              'g'
            ),
            '-{2,}',
            '-',
            'g'
          )
        ),
        ''
      ),
      'item-' || left(id::text, 8)
    ) as base_slug,
    created_at
  from public.premade_candies
),
ranked as (
  select
    id,
    case
      when row_number() over (partition by base_slug order by created_at, id) = 1 then base_slug
      else base_slug || '-' || row_number() over (partition by base_slug order by created_at, id)
    end as resolved_slug
  from prepared
)
update public.premade_candies as target
set slug = ranked.resolved_slug
from ranked
where target.id = ranked.id
  and coalesce(nullif(target.slug, ''), '') = '';

create unique index if not exists premade_candies_slug_key
  on public.premade_candies (slug);

