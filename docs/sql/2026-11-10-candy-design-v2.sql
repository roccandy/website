begin;
-- Add v2 support without rewriting any existing project or immutable revision.
-- Retain the same compare-and-swap save and service-role-only permission boundary.
create or replace function public.save_candy_design(p_id uuid, p_revision integer, p_document jsonb, p_actor text)
returns public.candy_designs language plpgsql security invoker set search_path = public as $$
declare saved public.candy_designs;
begin
  if coalesce(p_document->>'schemaVersion', '') not in ('1', '2') or jsonb_typeof(p_document->'layers') is distinct from 'array' or octet_length(p_document::text) > 5000000 then
    raise exception 'Invalid design document';
  end if;
  if p_id is null then
    insert into public.candy_designs(name, document, updated_by)
    values (p_document->>'name', p_document, p_actor) returning * into saved;
  else
    update public.candy_designs set name = p_document->>'name', document = p_document,
      revision = revision + 1, updated_at = now(), updated_by = p_actor
    where id = p_id and revision = p_revision returning * into saved;
    if not found then raise exception 'This design has changed in another tab. Save a copy to keep your changes, then reopen the latest version.'; end if;
  end if;
  insert into public.candy_design_revisions(design_id, revision, document, created_by)
  values (saved.id, saved.revision, saved.document, p_actor);
  return saved;
end $$;
revoke all on function public.save_candy_design(uuid, integer, jsonb, text) from public, anon, authenticated;
grant execute on function public.save_candy_design(uuid, integer, jsonb, text) to service_role;
commit;
