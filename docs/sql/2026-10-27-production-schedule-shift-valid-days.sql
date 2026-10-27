-- Follow-up to the production schedule shift: count valid production days,
-- skipping the weekdays disabled in Production settings.

create or replace function public.next_valid_production_date(
  p_start_date date,
  p_days integer
) returns date
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_date date := p_start_date;
  v_days_counted integer := 0;
  v_blocked boolean;
  v_settings record;
begin
  if p_start_date is null or p_days is null or p_days < 1 then
    raise exception 'A start date and at least one day are required.';
  end if;

  select
    no_production_sun,
    no_production_mon,
    no_production_tue,
    no_production_wed,
    no_production_thu,
    no_production_fri,
    no_production_sat
  into v_settings
  from public.settings
  where id = 1;

  if not found then
    raise exception 'Production settings could not be found.';
  end if;
  if coalesce(v_settings.no_production_sun, false)
    and coalesce(v_settings.no_production_mon, false)
    and coalesce(v_settings.no_production_tue, false)
    and coalesce(v_settings.no_production_wed, false)
    and coalesce(v_settings.no_production_thu, false)
    and coalesce(v_settings.no_production_fri, false)
    and coalesce(v_settings.no_production_sat, false) then
    raise exception 'At least one production day must be enabled before shifting the schedule.';
  end if;

  while v_days_counted < p_days loop
    v_date := v_date + 1;
    v_blocked := case extract(dow from v_date)::integer
      when 0 then v_settings.no_production_sun
      when 1 then v_settings.no_production_mon
      when 2 then v_settings.no_production_tue
      when 3 then v_settings.no_production_wed
      when 4 then v_settings.no_production_thu
      when 5 then v_settings.no_production_fri
      when 6 then v_settings.no_production_sat
    end;
    if not coalesce(v_blocked, false) then
      v_days_counted := v_days_counted + 1;
    end if;
  end loop;

  return v_date;
end;
$$;

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

  perform 1
  from public.order_slots assignment
  join public.production_slots slot on slot.id = assignment.slot_id
  where slot.slot_date >= p_start_date
  for update of assignment, slot;

  insert into public.production_slots (slot_date, slot_index, capacity_kg, status)
  select distinct
    public.next_valid_production_date(slot.slot_date, p_days),
    slot.slot_index,
    slot.capacity_kg,
    slot.status
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
      on destination.slot_date = public.next_valid_production_date(source.slot_date, p_days)
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

revoke all on function public.next_valid_production_date(date, integer) from public, anon, authenticated;
revoke all on function public.shift_production_schedule(date, integer) from public, anon, authenticated;
grant execute on function public.shift_production_schedule(date, integer) to service_role;
notify pgrst, 'reload schema';
