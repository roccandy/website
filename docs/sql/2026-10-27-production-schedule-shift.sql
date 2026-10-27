-- Atomically shift all production assignments from a date onward while
-- retaining each assignment's slot number and production-slot settings.

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
begin
  if p_start_date is null then
    raise exception 'A start date is required.';
  end if;
  if p_days is null or p_days < 1 or p_days > 365 then
    raise exception 'Days must be between 1 and 365.';
  end if;

  -- Lock all affected assignments and slots until the move is complete.
  perform 1
  from public.order_slots assignment
  join public.production_slots slot on slot.id = assignment.slot_id
  where slot.slot_date >= p_start_date
  for update of assignment, slot;

  -- Create missing destination slots. Existing destination slots retain their
  -- own capacity, status and notes.
  insert into public.production_slots (slot_date, slot_index, capacity_kg, status, notes)
  select distinct
    slot.slot_date + p_days,
    slot.slot_index,
    slot.capacity_kg,
    slot.status,
    slot.notes
  from public.production_slots slot
  join public.order_slots assignment on assignment.slot_id = slot.id
  where slot.slot_date >= p_start_date
  on conflict (slot_date, slot_index) do nothing;

  with moved as (
    select
      assignment.id as assignment_id,
      destination.id as destination_slot_id
    from public.order_slots assignment
    join public.production_slots source on source.id = assignment.slot_id
    join public.production_slots destination
      on destination.slot_date = source.slot_date + p_days
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

revoke all on function public.shift_production_schedule(date, integer) from public, anon, authenticated;
grant execute on function public.shift_production_schedule(date, integer) to service_role;
notify pgrst, 'reload schema';
