-- Store optional birthdays for admin-only birthday greetings.

alter table public.admin_users
  add column if not exists birthday date;
