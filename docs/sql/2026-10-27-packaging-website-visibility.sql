-- Keep custom packaging options available to admin users without exposing them
-- in the public designer or checkout.

alter table public.packaging_options
  add column if not exists is_website_visible boolean not null default true;

update public.packaging_options
set is_website_visible = true
where is_website_visible is null;
