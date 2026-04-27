-- Orders capture what was quoted or sold; minimal fields to support scheduling.
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text,
  customer_email text,
  category_id text,
  packaging_option_id text,
  quantity numeric,
  labels_count numeric,
  ingredient_labels_count numeric,
  label_type_id uuid,
  jacket text,
  due_date date,
  total_weight_kg numeric not null check (total_weight_kg > 0),
  total_price numeric,
  status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now()
);

-- Production slots represent dated capacity buckets.
create table if not exists public.production_slots (
  id uuid primary key default gen_random_uuid(),
  slot_date date not null,
  capacity_kg numeric not null check (capacity_kg > 0),
  status text not null default 'open',
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists production_slots_slot_date_idx on public.production_slots (slot_date);

-- Join table mapping orders to slots, with kg assigned.
create table if not exists public.order_slots (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  slot_id uuid not null references public.production_slots (id) on delete cascade,
  kg_assigned numeric not null check (kg_assigned > 0),
  created_at timestamptz not null default now(),
  unique (order_id, slot_id)
);
create index if not exists order_slots_slot_idx on public.order_slots (slot_id);
create index if not exists order_slots_order_idx on public.order_slots (order_id);
