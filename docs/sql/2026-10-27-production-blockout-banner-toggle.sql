-- Let admins keep production dates blocked without showing a public blockout banner.

alter table public.settings
  add column if not exists show_quote_blockout_banner boolean not null default true;

update public.settings
set show_quote_blockout_banner = true
where show_quote_blockout_banner is null;
