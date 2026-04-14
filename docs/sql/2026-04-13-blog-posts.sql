-- Add admin-managed blog posts.
-- Apply with:
-- npm run db:apply-sql -- docs/sql/2026-04-13-blog-posts.sql

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null default '',
  excerpt text not null default '',
  cover_image_url text,
  cover_image_alt text,
  body_html text not null default '',
  seo_title text,
  meta_description text,
  canonical_url text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  author_name text not null default 'Roc Candy',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.blog_posts enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'blog_posts'
      and policyname = 'blog_posts_select_published'
  ) then
    create policy "blog_posts_select_published"
      on public.blog_posts
      for select
      using (status = 'published');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'blog_posts'
      and policyname = 'blog_posts_admin_write'
  ) then
    create policy "blog_posts_admin_write"
      on public.blog_posts
      for all
      using (is_admin(auth.uid()))
      with check (is_admin(auth.uid()));
  end if;
end $$;
