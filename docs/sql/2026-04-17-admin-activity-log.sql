-- Add a backend activity log for admin-only change history.
-- Apply with:
-- node -e "/* run this file against Supabase */"

create table if not exists public.admin_activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id text,
  actor_email text,
  actor_name text,
  actor_role text,
  area text not null,
  action text not null,
  entity_type text not null,
  entity_id text,
  entity_label text,
  summary text not null,
  path text,
  changed_fields text[] not null default '{}'::text[],
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_activity_log_created_at_idx
  on public.admin_activity_log (created_at desc);

create index if not exists admin_activity_log_actor_email_idx
  on public.admin_activity_log (actor_email);

alter table public.admin_activity_log enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_activity_log'
      and policyname = 'admin_activity_log_no_direct_access'
  ) then
    create policy "admin_activity_log_no_direct_access"
      on public.admin_activity_log
      for all
      using (false)
      with check (false);
  end if;
end $$;
