begin;
create table if not exists public.admin_order_drafts (
  id uuid primary key,
  source_order_id uuid references public.orders(id),
  source_fingerprint text,
  payload jsonb not null,
  title text not null default 'Untitled order',
  customer_name text,
  required_date date,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text,
  publishing_at timestamptz,
  completed_at timestamptz,
  discarded_at timestamptz,
  published_order_ids uuid[] not null default '{}'
);
create unique index if not exists admin_order_drafts_one_active_edit on public.admin_order_drafts(source_order_id) where source_order_id is not null and completed_at is null and discarded_at is null;
alter table public.admin_order_drafts enable row level security;
revoke all on public.admin_order_drafts from anon,authenticated;
grant all on public.admin_order_drafts to service_role;
create or replace function public.save_admin_order_draft(p_id uuid,p_revision integer,p_source_order_id uuid,p_source_fingerprint text,p_payload jsonb,p_actor text)
returns public.admin_order_drafts language plpgsql security invoker set search_path=public as $$
declare saved public.admin_order_drafts; active jsonb; customer text; draft_title text; requested date;
begin
  if p_payload->>'schemaVersion' is distinct from '1' or jsonb_typeof(p_payload->'orders') is distinct from 'array' or octet_length(p_payload::text)>24000000 then raise exception 'Invalid order draft'; end if;
  select value->'fields' into active from jsonb_array_elements(p_payload->'orders') where value->>'id'=p_payload->>'activeOrderId';
  draft_title:=left(coalesce(nullif(btrim(active->>'title'),''),nullif(btrim(active->>'design_text'),''),'Untitled order'),200);
  customer:=nullif(btrim(concat_ws(' ',p_payload#>>'{shared,first_name}',p_payload#>>'{shared,last_name}')),'');
  customer:=coalesce(customer,nullif(p_payload#>>'{shared,organization_name}',''));
  begin requested:=nullif(active->>'due_date','')::date; exception when others then requested:=null; end;
  select * into saved from public.admin_order_drafts where id=p_id for update;
  if found then
    if saved.source_order_id is distinct from p_source_order_id then raise exception 'The draft belongs to another order'; end if;
    if saved.completed_at is not null or saved.discarded_at is not null or saved.publishing_at is not null then raise exception 'This draft is no longer editable'; end if;
    if saved.payload=p_payload then return saved; end if;
    if saved.revision<>p_revision then raise exception 'This draft changed in another tab. Reopen the saved draft before continuing.'; end if;
    update public.admin_order_drafts set payload=p_payload,title=draft_title,customer_name=customer,required_date=requested,revision=revision+1,updated_at=now(),updated_by=p_actor where id=p_id returning * into saved;
  else
    if p_revision<>0 then raise exception 'Draft not found'; end if;
    insert into public.admin_order_drafts(id,source_order_id,source_fingerprint,payload,title,customer_name,required_date,updated_by)
      values(p_id,p_source_order_id,p_source_fingerprint,p_payload,draft_title,customer,requested,p_actor) returning * into saved;
  end if;
  return saved;
end $$;
revoke all on function public.save_admin_order_draft(uuid,integer,uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.save_admin_order_draft(uuid,integer,uuid,text,jsonb,text) to service_role;
commit;
