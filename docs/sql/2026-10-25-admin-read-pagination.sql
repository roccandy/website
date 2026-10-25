-- Read-only admin list pagination. No orders, payments or customer data are changed.
begin;
create or replace function public.admin_order_history_page(
  p_view text default 'all', p_sort text default 'order', p_direction text default 'desc',
  p_query text default '', p_page integer default 1, p_page_size integer default 50
) returns jsonb language sql stable security invoker set search_path = public, pg_temp as $$
with schedule as (
  select a.order_id, count(*) as assigned, count(*) filter(where s.slot_date < (now() at time zone 'Australia/Perth')::date) as past
  from public.order_slots a join public.production_slots s on s.id=a.slot_id group by a.order_id
), light as (
  select o.id, o.order_number,
    case when nullif(o.order_number,'') is null then 'id:'||o.id else 'order:'||regexp_replace(o.order_number,'-[a-z]+$','','i') end as group_key,
    coalesce(nullif(o.order_number,''),o.id::text) as subgroup_key,
    regexp_replace(o.order_number,'-[a-z]+$','','i') as base_number,
    o.design_type, o.status, o.pickup, o.due_date, o.total_weight_kg,o.created_at,
    coalesce(nullif(o.customer_name,''),nullif(concat_ws(' ',o.first_name,o.last_name),''),'') as customer,
    coalesce(nullif(trim(o.title),''),nullif(trim(o.order_description),''),'') as title,
    (o.refunded_at is not null or coalesce(o.refunded_amount,0)>0) and
      (coalesce(o.refunded_amount,0)>=greatest(coalesce(o.total_price,0),0) or (o.refunded_at is not null and o.status<>'partially-refunded')) as fully_refunded,
    o.refunded_at is not null or coalesce(o.refunded_amount,0)>0 as has_refund,
    case when o.design_type='premade' then case when o.status='shipped' then 'shipped' else 'pending' end
      when o.status in ('test','archived') then o.status
      when coalesce(s.assigned,0)=0 then 'unassigned'
      when coalesce(s.past,0)>=greatest(1,(select count(*) from unnest(o.admin_batch_weights_kg) w where w>0)) then 'made'
      when coalesce(s.past,0)>0 then 'partially made'
      when s.assigned<greatest(1,(select count(*) from unnest(o.admin_batch_weights_kg) w where w>0)) then 'partially scheduled'
      else 'scheduled' end as schedule_status,
    lower(concat_ws(' ',case when nullif(o.order_number,'') is null then o.id::text end,o.order_number,'#'||o.order_number,regexp_replace(o.order_number,'-[a-z]+$','','i'),
      case when nullif(o.order_number,'') is null then '#'||left(o.id::text,8) end,o.title,o.order_description,
      o.customer_name,o.first_name,o.last_name,o.customer_email,o.phone,o.organization_name,o.due_date,to_char(o.due_date,'DD/MM/YYYY'),
      round(o.total_weight_kg*1000)::text||' g',o.status,o.woo_order_status,o.payment_method,o.payment_provider,o.payment_transaction_id,o.refund_reason)) as search_text
  from public.orders o left join schedule s on s.order_id=o.id
), subgroup as (
  select group_key,subgroup_key,
    bool_and(fully_refunded) as all_refunded,
    bool_or(has_refund) as any_refund,
    bool_and(pickup) as pickup,
    bool_and(fully_refunded) or case when bool_and(coalesce(design_type='premade',false)) then bool_and(status='shipped') else bool_and(status='archived') end as completed,
    case when bool_and(coalesce(design_type='premade',false)) then case when bool_and(status='shipped') then 'shipped' else 'pending' end
      when bool_and(schedule_status='archived') then 'archived'
      when bool_or(schedule_status='unassigned') then 'unassigned'
      when bool_or(schedule_status='made') then 'made'
      when bool_or(schedule_status='partially made') then 'partially made'
      when bool_or(schedule_status='partially scheduled') then 'partially scheduled'
      when bool_or(schedule_status='scheduled') then 'scheduled'
      else min(schedule_status) end as display_status
  from light group by group_key,subgroup_key
), visible as (
  select l.*, case when s.all_refunded then 'Fully refunded' when s.any_refund then 'Partially refunded'
    when s.completed then case when s.pickup then 'Collected' else 'Delivered' end else s.display_status end as display_status
  from light l join subgroup s using(group_key,subgroup_key)
  where case when p_view='archived' then s.completed when p_view='uncompleted' then not s.completed else true end
), groups as (
  select group_key,min(base_number) as base_number,
    (array_agg(lower(title) order by order_number,created_at,id))[1] as title_sort,
    coalesce(case when count(distinct nullif(customer,''))<=1 then min(lower(nullif(customer,''))) else 'multiple' end,'') as customer_sort,
    min(due_date) as due_sort,sum(total_weight_kg) as weight_sort,
    string_agg(distinct display_status,' ' order by display_status) as status_sort,
    string_agg(search_text||' '||lower(display_status),' ')||case when count(distinct due_date)>1 then ' multiple' else '' end as search_text
  from visible group by group_key
), matched as (
  select * from groups where coalesce(trim(p_query),'')='' or strpos(search_text||' '||customer_sort||' #'||coalesce(base_number,''),lower(left(trim(p_query),200)))>0
    or strpos(lower(round(weight_sort*1000)::text||' g'),lower(left(trim(p_query),200)))>0
), bounds as (
  select count(*)::integer as total, greatest(1,least(coalesce(p_page_size,50),100)) as size,
    least(greatest(1,coalesce(p_page,1)),greatest(1,ceil(count(*)::numeric/greatest(1,least(coalesce(p_page_size,50),100)))::integer)) as page from matched
), page_keys as (
  select m.group_key,row_number() over() as rank from (
    select * from matched order by
      case when p_sort='title' and p_direction='asc' then title_sort end asc nulls last,
      case when p_sort='title' and p_direction<>'asc' then title_sort end desc nulls last,
      case when p_sort='customer' and p_direction='asc' then customer_sort end asc nulls last,
      case when p_sort='customer' and p_direction<>'asc' then customer_sort end desc nulls last,
      case when p_sort='date' and p_direction='asc' then due_sort end asc nulls last,
      case when p_sort='date' and p_direction<>'asc' then due_sort end desc nulls last,
      case when p_sort='weight' and p_direction='asc' then weight_sort end asc nulls last,
      case when p_sort='weight' and p_direction<>'asc' then weight_sort end desc nulls last,
      case when p_sort='status' and p_direction='asc' then status_sort end asc nulls last,
      case when p_sort='status' and p_direction<>'asc' then status_sort end desc nulls last,
      case when p_sort='order' and p_direction<>'asc' and base_number ~ '^\d+$' then base_number::numeric end desc nulls last,
      case when base_number ~ '^\d+$' then base_number::numeric end asc nulls last,
      group_key asc
    limit (select size from bounds) offset (select (page-1)*size from bounds)
  ) m
), selected_orders as (
  select o.* from public.orders o where
    (case when nullif(o.order_number,'') is null then 'id:'||o.id else 'order:'||regexp_replace(o.order_number,'-[a-z]+$','','i') end) in(select group_key from page_keys)
), selected_assignments as (
  select a.* from public.order_slots a where a.order_id in(select id from selected_orders)
)
select jsonb_build_object(
  'total',b.total,'page',b.page,'pageSize',b.size,
  'groupKeys',coalesce((select jsonb_agg(group_key order by rank) from page_keys),'[]'::jsonb),
  'orders',coalesce((select jsonb_agg(to_jsonb(o)-'logo_url'-'label_image_url' order by o.order_number,o.created_at,o.id) from selected_orders o),'[]'::jsonb),
  'assignments',coalesce((select jsonb_agg(to_jsonb(a)) from selected_assignments a),'[]'::jsonb),
  'slots',coalesce((select jsonb_agg(to_jsonb(s)) from public.production_slots s where s.id in(select slot_id from selected_assignments)),'[]'::jsonb)
) from bounds b;
$$;
revoke all on function public.admin_order_history_page(text,text,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.admin_order_history_page(text,text,text,text,integer,integer) to service_role;

create or replace function public.admin_customer_totals() returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
select jsonb_build_object('totalCustomers',count(*),'repeatCustomers',count(*) filter(where order_count>1),
  'totalOrders',coalesce(sum(order_count),0),'totalEnquiries',coalesce(sum(enquiry_count),0),
  'lifetimeValue',coalesce(sum(lifetime_value),0),'lowConfidenceCustomers',count(*) filter(where match_confidence='low')) from public.customers;
$$;
revoke all on function public.admin_customer_totals() from public,anon,authenticated;
grant execute on function public.admin_customer_totals() to service_role;
notify pgrst,'reload schema';
commit;
