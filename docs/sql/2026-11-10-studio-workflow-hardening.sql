begin;
alter table public.orders add column if not exists admin_complexity_charge numeric(12,2) not null default 0 check (admin_complexity_charge >= 0);
update storage.buckets set file_size_limit = 20000000, allowed_mime_types = array['image/png','image/jpeg','image/webp'] where id = 'candy-design-assets';
-- The bucket remains private and keeps its existing restrictive object policy.
commit;
