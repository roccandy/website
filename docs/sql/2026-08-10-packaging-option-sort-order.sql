-- Add persistent ordering for options within each packaging type.

alter table public.packaging_options
  add column if not exists sort_order integer not null default 0;

do $$
declare
  distinct_order_count integer;
  max_order integer;
begin
  select count(distinct sort_order), coalesce(max(sort_order), 0)
  into distinct_order_count, max_order
  from public.packaging_options;

  if distinct_order_count <= 1 and max_order = 0 then
    with ranked as (
      select
        id,
        row_number() over (
          partition by lower(trim(type))
          order by
            case
              when lower(size) ~ '[0-9]'
                then substring(lower(size) from '([0-9]+(\.[0-9]+)?)')::numeric
              else null
            end nulls last,
            lower(trim(size)),
            id
        ) - 1 as next_sort_order
      from public.packaging_options
    )
    update public.packaging_options as packaging
    set sort_order = ranked.next_sort_order
    from ranked
    where packaging.id = ranked.id;
  end if;
end $$;
