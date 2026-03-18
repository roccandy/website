-- Add per-page landing gallery images to site_pages.
-- Run this in Supabase SQL editor.

alter table public.site_pages
  add column if not exists gallery_image_urls text[] not null default '{}'::text[];
