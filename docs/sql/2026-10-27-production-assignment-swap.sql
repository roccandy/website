-- Exchange two production assignments without transiently violating the
-- order_slots(order_id, slot_id) unique constraint. A short-lived staging
-- slot makes this safe when the two batches belong to the same order.

create or replace function public.swap_production_assignments(
  p_first_assignment_id uuid,
  p_second_assignment_id uuid
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_first_slot_id uuid;
  v_second_slot_id uuid;
  v_staging_slot_id uuid;
  v_staging_slot_index integer;
  v_capacity_kg numeric;
  v_status text;
begin
  if p_first_assignment_id is null
    or p_second_assignment_id is null
    or p_first_assignment_id = p_second_assignment_id then
    raise exception 'Choose two different production assignments.';
  end if;

  select slot_id into v_first_slot_id
  from public.order_slots
  where id = p_first_assignment_id
  for update;

  select slot_id into v_second_slot_id
  from public.order_slots
  where id = p_second_assignment_id
  for update;

  if v_first_slot_id is null or v_second_slot_id is null then
    raise exception 'One or both production assignments could not be found.';
  end if;

  select capacity_kg, status into v_capacity_kg, v_status
  from public.production_slots
  where id = v_first_slot_id
  for update;

  if v_capacity_kg is null then
    raise exception 'The first production slot could not be found.';
  end if;

  select least(-1, coalesce(min(slot_index), 0) - 1)
  into v_staging_slot_index
  from public.production_slots
  where slot_date = date '9999-12-31';

  insert into public.production_slots (slot_date, slot_index, capacity_kg, status)
  values (date '9999-12-31', v_staging_slot_index, v_capacity_kg, v_status)
  returning id into v_staging_slot_id;

  update public.order_slots
  set slot_id = v_staging_slot_id
  where id = p_first_assignment_id;

  update public.order_slots
  set slot_id = v_first_slot_id
  where id = p_second_assignment_id;

  update public.order_slots
  set slot_id = v_second_slot_id
  where id = p_first_assignment_id;

  delete from public.production_slots
  where id = v_staging_slot_id;
end;
$$;

revoke all on function public.swap_production_assignments(uuid, uuid) from public, anon, authenticated;
grant execute on function public.swap_production_assignments(uuid, uuid) to service_role;

notify pgrst, 'reload schema';
