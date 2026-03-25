-- Add page-level FAQ section fields to site_pages.
-- Run this in Supabase SQL editor.

alter table public.site_pages
  add column if not exists faq_heading text,
  add column if not exists faq_item_ids uuid[] not null default '{}'::uuid[];
