-- Customer history CRM tables for historic imports and current-order rollups.

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  canonical_key text not null unique,
  display_name text,
  first_name text,
  last_name text,
  company text,
  primary_email text,
  normalized_email text,
  primary_phone text,
  normalized_phone text,
  address_line1 text,
  address_line2 text,
  suburb text,
  state text,
  postcode text,
  country text,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  order_count integer not null default 0,
  enquiry_count integer not null default 0,
  lifetime_value numeric(12,2) not null default 0,
  source_systems text[] not null default '{}',
  match_confidence text not null default 'low' check (match_confidence in ('high', 'medium', 'low')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists customers_display_name_idx on public.customers using gin (to_tsvector('simple', coalesce(display_name, '')));
create index if not exists customers_normalized_email_idx on public.customers (normalized_email);
create index if not exists customers_normalized_phone_idx on public.customers (normalized_phone);
create index if not exists customers_last_seen_idx on public.customers (last_seen_at desc nulls last);

create table if not exists public.customer_identities (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  identity_type text not null check (identity_type in ('email', 'phone', 'name_address', 'source')),
  identity_value text not null,
  label text,
  source_system text not null,
  source_id text,
  confidence text not null default 'low' check (confidence in ('high', 'medium', 'low')),
  created_at timestamptz not null default now(),
  unique (identity_type, identity_value)
);
create index if not exists customer_identities_customer_idx on public.customer_identities (customer_id);

create table if not exists public.customer_order_history (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  source_system text not null,
  source_id text not null,
  source_order_number text,
  display_order_number text not null,
  order_status text,
  order_type text,
  customer_name text,
  customer_email text,
  phone text,
  company text,
  address_line1 text,
  address_line2 text,
  suburb text,
  state text,
  postcode text,
  country text,
  created_at_source timestamptz,
  due_date date,
  completed_at timestamptz,
  paid_at timestamptz,
  total_price numeric(12,2),
  payment_total numeric(12,2),
  refunded_total numeric(12,2),
  payment_summary text,
  payment_reference text,
  payment_provider text,
  card_brand text,
  card_last4 text,
  currency text not null default 'AUD',
  pickup boolean,
  notes text,
  internal_notes text,
  raw_sanitized jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_system, source_id)
);
create index if not exists customer_order_history_customer_idx on public.customer_order_history (customer_id);
create index if not exists customer_order_history_source_number_idx on public.customer_order_history (source_order_number);
create index if not exists customer_order_history_created_idx on public.customer_order_history (created_at_source desc nulls last);

create table if not exists public.customer_order_items (
  id uuid primary key default gen_random_uuid(),
  order_history_id uuid not null references public.customer_order_history (id) on delete cascade,
  source_system text not null,
  source_id text not null,
  source_order_id text,
  title text,
  design_type text,
  design_text text,
  flavor text,
  quantity numeric,
  total_weight_kg numeric,
  unit_price numeric(12,2),
  total_price numeric(12,2),
  made boolean,
  colors jsonb not null default '{}'::jsonb,
  packaging_summary text,
  asset_refs jsonb not null default '{}'::jsonb,
  raw_sanitized jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_system, source_id)
);
create index if not exists customer_order_items_order_idx on public.customer_order_items (order_history_id);

create table if not exists public.customer_contact_events (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  source_system text not null,
  source_id text not null,
  event_type text not null default 'enquiry',
  name text,
  email text,
  phone text,
  company text,
  subject text,
  message text,
  occurred_at timestamptz,
  subscribed boolean,
  attachment_path text,
  source_category text,
  raw_sanitized jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_system, source_id)
);
create index if not exists customer_contact_events_customer_idx on public.customer_contact_events (customer_id);
create index if not exists customer_contact_events_occurred_idx on public.customer_contact_events (occurred_at desc nulls last);

create table if not exists public.customer_notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  body text not null,
  created_by_name text,
  created_by_email text,
  created_at timestamptz not null default now()
);
create index if not exists customer_notes_customer_idx on public.customer_notes (customer_id);

create table if not exists public.customer_import_runs (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('dry-run', 'apply')),
  old_archive_path text,
  new_archive_path text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  totals jsonb not null default '{}'::jsonb
);

create table if not exists public.customer_import_errors (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid references public.customer_import_runs (id) on delete cascade,
  source_system text,
  source_table text,
  source_id text,
  message text not null,
  raw_sanitized jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists customer_import_errors_run_idx on public.customer_import_errors (import_run_id);

alter table public.customers enable row level security;
alter table public.customer_identities enable row level security;
alter table public.customer_order_history enable row level security;
alter table public.customer_order_items enable row level security;
alter table public.customer_contact_events enable row level security;
alter table public.customer_notes enable row level security;
alter table public.customer_import_runs enable row level security;
alter table public.customer_import_errors enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customers' and policyname = 'customers_admin_access'
  ) then
    create policy "customers_admin_access" on public.customers for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customer_identities' and policyname = 'customer_identities_admin_access'
  ) then
    create policy "customer_identities_admin_access" on public.customer_identities for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customer_order_history' and policyname = 'customer_order_history_admin_access'
  ) then
    create policy "customer_order_history_admin_access" on public.customer_order_history for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customer_order_items' and policyname = 'customer_order_items_admin_access'
  ) then
    create policy "customer_order_items_admin_access" on public.customer_order_items for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customer_contact_events' and policyname = 'customer_contact_events_admin_access'
  ) then
    create policy "customer_contact_events_admin_access" on public.customer_contact_events for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customer_notes' and policyname = 'customer_notes_admin_access'
  ) then
    create policy "customer_notes_admin_access" on public.customer_notes for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customer_import_runs' and policyname = 'customer_import_runs_admin_access'
  ) then
    create policy "customer_import_runs_admin_access" on public.customer_import_runs for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customer_import_errors' and policyname = 'customer_import_errors_admin_access'
  ) then
    create policy "customer_import_errors_admin_access" on public.customer_import_errors for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));
  end if;
end $$;
