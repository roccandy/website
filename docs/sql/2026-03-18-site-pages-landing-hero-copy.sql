-- Add landing-page hero copy fields to site pages and prefill current rows.
-- Run this in Supabase SQL editor.

alter table public.site_pages
  add column if not exists hero_subheading text,
  add column if not exists hero_supporting_line text;

update public.site_pages
set
  hero_subheading = case slug
    when 'design/wedding-candy' then 'Create wedding rock candy'
    when 'design/custom-text-candy' then 'Create text rock candy'
    when 'design/branded-logo-candy' then 'Create branded rock candy'
    else hero_subheading
  end,
  hero_supporting_line = case slug
    when 'design/wedding-candy' then 'customise colours and packaging'
    when 'design/custom-text-candy' then 'customise colours and packaging'
    when 'design/branded-logo-candy' then 'customise colours and packaging'
    else hero_supporting_line
  end
where slug in (
  'design/wedding-candy',
  'design/custom-text-candy',
  'design/branded-logo-candy'
);
