begin;
alter table public.candy_designs add column if not exists source_order_id uuid references public.orders(id) on delete set null;
create unique index if not exists candy_designs_source_order_id_key on public.candy_designs(source_order_id) where source_order_id is not null;

-- Insert-only: importing an order twice never replaces a manually edited catalogue design.
create or replace function public.import_order_candy_design(p_source_order_id uuid, p_document jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare source_order public.orders; design_id uuid; document jsonb;
begin
  select * into source_order from public.orders where id = p_source_order_id;
  if not found or source_order.design_type = 'premade' then raise exception 'A custom source order is required'; end if;
  if p_document->>'schemaVersion' is distinct from '1' or jsonb_typeof(p_document->'layers') is distinct from 'array' or octet_length(p_document::text) > 5000000 then raise exception 'Invalid design document'; end if;
  document := jsonb_set(p_document - 'source', '{name}', to_jsonb(left(coalesce(nullif(btrim(source_order.title), ''), p_document->>'name', 'Order ' || source_order.order_number),120)));
  insert into public.candy_designs(name,document,source_order_id,updated_by)
    values(document->>'name',document,p_source_order_id,'Order design backfill')
    on conflict(source_order_id) where source_order_id is not null do nothing returning id into design_id;
  if design_id is null then select id into design_id from public.candy_designs where source_order_id = p_source_order_id; return design_id; end if;
  insert into public.candy_design_revisions(design_id,revision,document,created_by) values(design_id,1,document,'Order design backfill');
  return design_id;
end $$;
revoke all on function public.import_order_candy_design(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.import_order_candy_design(uuid,jsonb) to service_role;
commit;
