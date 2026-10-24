-- Private, append-only content snapshots for website-sent order email.
-- No historical email is fabricated or backfilled by this migration.
begin;
create table if not exists public.order_email_archive (
  id uuid primary key,
  order_ids uuid[] not null default '{}',
  order_numbers text[] not null default '{}',
  kind text not null check (kind in ('confirmation','order-update','invoice-pdf','refund','internal')),
  from_address text not null,
  to_addresses text[] not null,
  bcc_addresses text[] not null default '{}',
  subject text not null,
  text_body text not null,
  html_body text,
  attachments jsonb not null default '[]'::jsonb,
  raw_path text not null unique,
  raw_sha256 text not null,
  message_id text not null,
  status text not null check (status in ('prepared','sending','accepted','partial','rejected','unconfirmed')),
  accepted_addresses text[] not null default '{}',
  rejected_addresses text[] not null default '{}',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists order_email_archive_orders on public.order_email_archive using gin(order_ids);
create index if not exists order_email_archive_numbers on public.order_email_archive using gin(order_numbers);
create index if not exists order_email_archive_created on public.order_email_archive(created_at desc, id);
alter table public.order_email_archive enable row level security;
revoke all on public.order_email_archive from public, anon, authenticated;
grant select, insert, update on public.order_email_archive to service_role;
create or replace function public.preserve_order_email_original()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if (to_jsonb(new) - array['status','accepted_addresses','rejected_addresses','completed_at'])
    is distinct from (to_jsonb(old) - array['status','accepted_addresses','rejected_addresses','completed_at']) then
    raise exception 'Original archived email content cannot be changed';
  end if;
  return new;
end $$;
drop trigger if exists preserve_order_email_original on public.order_email_archive;
create trigger preserve_order_email_original before update on public.order_email_archive
for each row execute function public.preserve_order_email_original();
insert into storage.buckets (id, name, public, file_size_limit)
values ('order-email-archive', 'order-email-archive', false, 26214400)
on conflict (id) do nothing;
-- A private bucket alone is not sufficient if another storage policy allows
-- broad access. This restrictive policy excludes the archive from such grants.
drop policy if exists order_email_archive_private on storage.objects;
create policy order_email_archive_private on storage.objects as restrictive
for all to anon, authenticated
using (bucket_id <> 'order-email-archive')
with check (bucket_id <> 'order-email-archive');
do $$ begin
  if exists (select 1 from storage.buckets where id = 'order-email-archive' and public) then
    raise exception 'Email archive bucket must be private';
  end if;
end $$;
commit;
