-- Add SEO fields to an existing site_pages table.
-- Run this in Supabase SQL editor.

alter table public.site_pages
  add column if not exists seo_title text,
  add column if not exists meta_description text,
  add column if not exists og_image_url text,
  add column if not exists canonical_url text;
