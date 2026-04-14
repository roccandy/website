alter table public.site_faqs
  add column if not exists show_on_faq_page boolean not null default true;

update public.site_faqs
set show_on_faq_page = true
where show_on_faq_page is null;
