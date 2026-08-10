begin;

create or replace function public.update_packaging_lid_color(p_id uuid, p_name text, p_hex text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_name text;
  v_name text := lower(trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')));
  v_hex text := lower(trim(coalesce(p_hex, '')));
begin
  if v_name = '' or length(v_name) > 60 then
    raise exception 'Enter a lid colour name up to 60 characters.';
  end if;
  if v_hex !~ '^#[0-9a-f]{6}$' then
    raise exception 'Choose a valid website swatch colour.';
  end if;

  select name into v_old_name
  from public.packaging_lid_colors
  where id = p_id
  for update;
  if not found then
    raise exception 'Lid colour not found.';
  end if;

  if exists (
    select 1 from public.packaging_lid_colors
    where id <> p_id and lower(trim(name)) = v_name
  ) then
    raise exception 'A lid colour with that name already exists.';
  end if;

  update public.packaging_options as packaging
  set lid_colors = coalesce((
    select array_agg(
      case when lower(trim(lid.value)) = lower(trim(v_old_name)) then v_name else lid.value end
      order by lid.ordinality
    )
    from unnest(coalesce(packaging.lid_colors, '{}'::text[])) with ordinality as lid(value, ordinality)
  ), '{}'::text[])
  where exists (
    select 1 from unnest(coalesce(packaging.lid_colors, '{}'::text[])) as existing(value)
    where lower(trim(existing.value)) = lower(trim(v_old_name))
  );

  update public.packaging_option_images
  set lid_color = v_name
  where lower(trim(lid_color)) = lower(trim(v_old_name));

  update public.packaging_lid_colors
  set name = v_name, hex = v_hex
  where id = p_id;
end;
$$;

create or replace function public.delete_packaging_lid_color(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_name text;
begin
  select name into v_old_name
  from public.packaging_lid_colors
  where id = p_id
  for update;
  if not found then
    raise exception 'Lid colour not found.';
  end if;

  if exists (
    select 1 from public.packaging_option_images
    where lower(trim(lid_color)) = lower(trim(v_old_name))
  ) then
    raise exception 'Remove the uploaded packaging images for this lid colour before deleting it.';
  end if;

  update public.packaging_options as packaging
  set lid_colors = coalesce((
    select array_agg(lid.value order by lid.ordinality)
    from unnest(coalesce(packaging.lid_colors, '{}'::text[])) with ordinality as lid(value, ordinality)
    where lower(trim(lid.value)) <> lower(trim(v_old_name))
  ), '{}'::text[])
  where exists (
    select 1 from unnest(coalesce(packaging.lid_colors, '{}'::text[])) as existing(value)
    where lower(trim(existing.value)) = lower(trim(v_old_name))
  );

  delete from public.packaging_lid_colors where id = p_id;
end;
$$;

revoke all on function public.update_packaging_lid_color(uuid, text, text) from public, anon, authenticated;
revoke all on function public.delete_packaging_lid_color(uuid) from public, anon, authenticated;
grant execute on function public.update_packaging_lid_color(uuid, text, text) to service_role;
grant execute on function public.delete_packaging_lid_color(uuid) to service_role;

commit;
