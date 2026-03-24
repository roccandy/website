-- Add SEO fields to premade_candies for per-product metadata control.
-- Run this in Supabase SQL editor.

alter table public.premade_candies
  add column if not exists seo_title text,
  add column if not exists meta_description text,
  add column if not exists og_image_url text,
  add column if not exists canonical_url text;
