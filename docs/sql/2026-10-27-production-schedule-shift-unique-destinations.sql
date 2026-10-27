-- Ensure schedule shifts remain one-to-one even if historical assignments
-- exist on days now marked unavailable (such as weekends).

create or replace function public.shift_production_schedule(
  p_start_date date,
  p_days integer
) returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_moved_count integer;
  v_source_date date;
  v_destination_date date;
  v_previous_destination_date date := null;
begin
  if p_start_date is null then
    raise exception 'A start date is required.';
  end if;
  if p_days is null or p_days < 1 or p_days > 365 then
    raise exception 'Days must be between 1 and 365.';
  end if;

  perform 1
  from public.order_slots assignment
  join public.production_slots slot on slot.id = assignment.slot_id
  where slot.slot_date >= p_start_date
  for update of assignment, slot;

  create temporary table if not exists pg_temp.production_schedule_shift_date_map (
    source_date date primary key,
    destination_date date not null unique
  ) on commit drop;
  truncate pg_temp.production_schedule_shift_date_map;

  for v_source_date in
    select distinct slot.slot_date
    from public.production_slots slot
    join public.order_slots assignment on assignment.slot_id = slot.id
    where slot.slot_date >= p_start_date
    order by slot.slot_date
  loop
    v_destination_date := public.next_valid_production_date(v_source_date, p_days);
    if v_previous_destination_date is not null and v_destination_date <= v_previous_destination_date then
      v_destination_date := public.next_valid_production_date(v_previous_destination_date, 1);
    end if;
    insert into pg_temp.production_schedule_shift_date_map (source_date, destination_date)
    values (v_source_date, v_destination_date);
    v_previous_destination_date := v_destination_date;
  end loop;

  insert into public.production_slots (slot_date, slot_index, capacity_kg, status)
  select distinct
    date_map.destination_date,
    slot.slot_index,
    slot.capacity_kg,
    slot.status
  from public.production_slots slot
  join public.order_slots assignment on assignment.slot_id = slot.id
  join pg_temp.production_schedule_shift_date_map date_map on date_map.source_date = slot.slot_date
  where slot.slot_date >= p_start_date
  on conflict (slot_date, slot_index) do nothing;

  with moved as (
    select
      assignment.id as assignment_id,
      destination.id as destination_slot_id
    from public.order_slots assignment
    join public.production_slots source on source.id = assignment.slot_id
    join pg_temp.production_schedule_shift_date_map date_map on date_map.source_date = source.slot_date
    join public.production_slots destination
      on destination.slot_date = date_map.destination_date
      and destination.slot_index = source.slot_index
    where source.slot_date >= p_start_date
  ), updated as (
    update public.order_slots assignment
    set slot_id = moved.destination_slot_id
    from moved
    where assignment.id = moved.assignment_id
    returning assignment.id
  )
  select count(*)::integer into v_moved_count from updated;

  return coalesce(v_moved_count, 0);
end;
$$;

notify pgrst, 'reload schema';
