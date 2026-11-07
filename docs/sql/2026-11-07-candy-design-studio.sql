begin;
alter table public.orders add column if not exists candy_design jsonb;
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('candy-design-assets', 'candy-design-assets', false, 5000000, array['image/png'])
on conflict (id) do nothing;
-- Original artwork is private; admin previews use an authenticated server route.
drop policy if exists candy_design_assets_server_only on storage.objects;
create policy candy_design_assets_server_only on storage.objects as restrictive
for all to anon, authenticated
using (bucket_id <> 'candy-design-assets')
with check (bucket_id <> 'candy-design-assets');

create table if not exists public.candy_designs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  document jsonb not null,
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  updated_by text
);
create table if not exists public.candy_design_revisions (
  design_id uuid not null references public.candy_designs(id),
  revision integer not null,
  document jsonb not null,
  created_at timestamptz not null default now(),
  created_by text,
  primary key (design_id, revision)
);
alter table public.candy_designs enable row level security;
alter table public.candy_design_revisions enable row level security;
revoke all on public.candy_designs, public.candy_design_revisions from anon, authenticated;
grant all on public.candy_designs, public.candy_design_revisions to service_role;

-- Compare-and-swap plus history in one transaction: two tabs cannot overwrite each other.
create or replace function public.save_candy_design(p_id uuid, p_revision integer, p_document jsonb, p_actor text)
returns public.candy_designs language plpgsql security invoker set search_path = public as $$
declare saved public.candy_designs;
begin
  if p_document->>'schemaVersion' is distinct from '1' or jsonb_typeof(p_document->'layers') is distinct from 'array' or octet_length(p_document::text) > 5000000 then
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
