-- Audit RLS status across user-accessible schemas and Supabase-managed internal schemas.
-- Safe to run read-only in Supabase SQL editor.
--
-- Use this when Supabase sends a Security Advisor email such as:
--   "Table publicly accessible" / "rls_disabled_in_public"
--
-- Interpretation:
-- - `ACTION` rows in `APP / POSTGREST-EXPOSED` need fixing.
-- - `INFO` rows in `INTERNAL / NON-POSTGREST` are usually Supabase-managed tables,
--   not your app tables. Do not change those casually.

with exposed_schemas as (
  select trim(value) as schema_name
  from unnest(
    string_to_array(
      coalesce(nullif(current_setting('pgrst.db_schemas', true), ''), 'public,storage,graphql_public'),
      ','
    )
  ) as value
  where trim(value) <> ''
),
user_tables as (
  select
    n.nspname as schema_name,
    c.relname as table_name,
    c.relrowsecurity as rls_enabled,
    coalesce(string_agg(p.policyname, ', ' order by p.policyname), '') as policies
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_policies p
    on p.schemaname = n.nspname
   and p.tablename = c.relname
  where c.relkind = 'r'
    and n.nspname not in ('pg_catalog', 'information_schema', 'pg_toast')
    and n.nspname not like 'pg_temp_%'
    and n.nspname not like 'pg_toast_temp_%'
  group by n.nspname, c.relname, c.relrowsecurity
),
flagged as (
  select
    case
      when schema_name in (select schema_name from exposed_schemas) then 'APP / POSTGREST-EXPOSED'
      else 'INTERNAL / NON-POSTGREST'
    end as audit_group,
    case
      when schema_name in (select schema_name from exposed_schemas) then 'ACTION'
      else 'INFO'
    end as status,
    schema_name,
    table_name,
    rls_enabled,
    coalesce(nullif(policies, ''), '(none)') as policies,
    case
      when schema_name in (select schema_name from exposed_schemas)
        then 'RLS is disabled on a schema exposed through PostgREST. Fix this.'
      else 'RLS is disabled on a non-PostgREST/internal schema table. Usually review only.'
    end as note
  from user_tables
  where not rls_enabled
),
summary_rows as (
  select
    'OK' as status,
    'APP / POSTGREST-EXPOSED' as audit_group,
    '(none)' as schema_name,
    '(none)' as table_name,
    true as rls_enabled,
    '(none)' as policies,
    'No PostgREST-exposed tables with RLS disabled found.' as note
  where not exists (
    select 1 from flagged where audit_group = 'APP / POSTGREST-EXPOSED'
  )

  union all

  select
    'OK' as status,
    'INTERNAL / NON-POSTGREST' as audit_group,
    '(none)' as schema_name,
    '(none)' as table_name,
    true as rls_enabled,
    '(none)' as policies,
    'No internal/non-PostgREST tables with RLS disabled found.' as note
  where not exists (
    select 1 from flagged where audit_group = 'INTERNAL / NON-POSTGREST'
  )
)
select
  status,
  audit_group,
  schema_name,
  table_name,
  rls_enabled,
  policies,
  note
from (
  select
    status,
    audit_group,
    schema_name,
    table_name,
    rls_enabled,
    policies,
    note
  from flagged

  union all

  select
    status,
    audit_group,
    schema_name,
    table_name,
    rls_enabled,
    policies,
    note
  from summary_rows
) combined
order by
  case status
    when 'ACTION' then 0
    when 'INFO' then 1
    else 2
  end,
  audit_group,
  schema_name,
  table_name;
