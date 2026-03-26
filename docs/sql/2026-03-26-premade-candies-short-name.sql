-- Add short link-label support to premade_candies.
-- Run this in Supabase SQL editor, or apply with:
-- npm run db:apply-sql -- docs/sql/2026-03-26-premade-candies-short-name.sql

alter table public.premade_candies
  add column if not exists short_name text;
