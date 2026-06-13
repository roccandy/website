-- Day-level notes for the production calendar.
-- Apply with:
-- npm run db:apply-sql -- docs/sql/2026-06-13-production-day-notes.sql

create table if not exists public.production_day_notes (
  id uuid primary key default gen_random_uuid(),
  note_date date not null,
  note text not null check (length(btrim(note)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (note_date)
);

create index if not exists production_day_notes_note_date_idx
  on public.production_day_notes (note_date);

alter table public.production_day_notes enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'production_day_notes'
      and policyname = 'production_day_notes_admin_access'
  ) then
    create policy "production_day_notes_admin_access"
      on public.production_day_notes
      for all
      using (is_admin(auth.uid()))
      with check (is_admin(auth.uid()));
  end if;
end $$;
