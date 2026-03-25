-- Check whether the Roc Candy Supabase schema has the required tables/columns/policies
-- for the current app state. Safe to run read-only in Supabase SQL editor.

with checks as (
  select 'settings.quote_blockout_months' as item,
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'settings' and column_name = 'quote_blockout_months'
    ) as ok

  union all
  select 'settings.ingredient_label_price',
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'settings' and column_name = 'ingredient_label_price'
    )

  union all
  select 'settings.ingredient_label_type_id',
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'settings' and column_name = 'ingredient_label_type_id'
    )

  union all
  select 'flavors.is_active',
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'flavors' and column_name = 'is_active'
    )

  union all
  select 'flavors.sort_order',
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'flavors' and column_name = 'sort_order'
    )

  union all
  select 'flavors.rls_enabled',
    exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'flavors' and c.relrowsecurity
    )

  union all
  select 'policy.flavors_select_public',
    exists (
      select 1
      from pg_policies
      where schemaname = 'public' and tablename = 'flavors' and policyname = 'flavors_select_public'
    )

  union all
  select 'policy.flavors_admin_write',
    exists (
      select 1
      from pg_policies
      where schemaname = 'public' and tablename = 'flavors' and policyname = 'flavors_admin_write'
    )

  union all
  select 'packaging_options.type_sort_order',
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'packaging_options' and column_name = 'type_sort_order'
    )

  union all
  select 'packaging_options.dimensions',
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'packaging_options' and column_name = 'dimensions'
    )

  union all
  select 'table.site_faqs',
    exists (
      select 1
      from information_schema.tables
      where table_schema = 'public' and table_name = 'site_faqs'
    )

  union all
  select 'policy.site_faqs_select_public',
    exists (
      select 1
      from pg_policies
      where schemaname = 'public' and tablename = 'site_faqs' and policyname = 'site_faqs_select_public'
    )

  union all
  select 'policy.site_faqs_admin_write',
    exists (
      select 1
      from pg_policies
      where schemaname = 'public' and tablename = 'site_faqs' and policyname = 'site_faqs_admin_write'
    )

  union all
  select 'table.admin_users',
    exists (
      select 1
      from information_schema.tables
      where table_schema = 'public' and table_name = 'admin_users'
    )

  union all
  select 'constraint.admin_users_role_includes_seo',
    exists (
      select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'admin_users'
        and pg_get_constraintdef(c.oid) ilike '%viewer%'
        and pg_get_constraintdef(c.oid) ilike '%seo%'
        and pg_get_constraintdef(c.oid) ilike '%editor%'
        and pg_get_constraintdef(c.oid) ilike '%admin%'
    )

  union all
  select 'table.site_pages',
    exists (
      select 1
      from information_schema.tables
      where table_schema = 'public' and table_name = 'site_pages'
    )

  union all
  select 'site_pages.seo_title',
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'site_pages' and column_name = 'seo_title'
    )

  union all
  select 'site_pages.meta_description',
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'site_pages' and column_name = 'meta_description'
    )

  union all
  select 'site_pages.og_image_url',
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'site_pages' and column_name = 'og_image_url'
    )

  union all
  select 'site_pages.canonical_url',
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'site_pages' and column_name = 'canonical_url'
    )

  union all
  select 'site_pages.gallery_image_urls',
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'site_pages' and column_name = 'gallery_image_urls'
    )

  union all
  select 'site_pages.hero_subheading',
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'site_pages' and column_name = 'hero_subheading'
    )

  union all
  select 'site_pages.hero_supporting_line',
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'site_pages' and column_name = 'hero_supporting_line'
    )

  union all
  select 'site_pages.faq_heading',
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'site_pages' and column_name = 'faq_heading'
    )

  union all
  select 'site_pages.faq_item_ids',
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'site_pages' and column_name = 'faq_item_ids'
    )

  union all
  select 'policy.site_pages_select_public',
    exists (
      select 1
      from pg_policies
      where schemaname = 'public' and tablename = 'site_pages' and policyname = 'site_pages_select_public'
    )

  union all
  select 'policy.site_pages_admin_write',
    exists (
      select 1
      from pg_policies
      where schemaname = 'public' and tablename = 'site_pages' and policyname = 'site_pages_admin_write'
    )

  union all
  select 'table.site_terms_items',
    exists (
      select 1
      from information_schema.tables
      where table_schema = 'public' and table_name = 'site_terms_items'
    )

  union all
  select 'policy.site_terms_items_select_public',
    exists (
      select 1
      from pg_policies
      where schemaname = 'public' and tablename = 'site_terms_items' and policyname = 'site_terms_items_select_public'
    )

  union all
  select 'policy.site_terms_items_admin_write',
    exists (
      select 1
      from pg_policies
      where schemaname = 'public' and tablename = 'site_terms_items' and policyname = 'site_terms_items_admin_write'
    )

  union all
  select 'label_types.rls_enabled',
    exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'label_types' and c.relrowsecurity
    )

  union all
  select 'policy.label_types_select_public',
    exists (
      select 1
      from pg_policies
      where schemaname = 'public' and tablename = 'label_types' and policyname = 'label_types_select_public'
    )

  union all
  select 'policy.label_types_admin_write',
    exists (
      select 1
      from pg_policies
      where schemaname = 'public' and tablename = 'label_types' and policyname = 'label_types_admin_write'
    )

  union all
  select 'table.site_redirects',
    exists (
      select 1
      from information_schema.tables
      where table_schema = 'public' and table_name = 'site_redirects'
    )

  union all
  select 'policy.site_redirects_select_public',
    exists (
      select 1
      from pg_policies
      where schemaname = 'public' and tablename = 'site_redirects' and policyname = 'site_redirects_select_public'
    )

  union all
  select 'policy.site_redirects_admin_write',
    exists (
      select 1
      from pg_policies
      where schemaname = 'public' and tablename = 'site_redirects' and policyname = 'site_redirects_admin_write'
    )

  union all
  select 'premade_candies.seo_title',
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'premade_candies' and column_name = 'seo_title'
    )

  union all
  select 'premade_candies.meta_description',
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'premade_candies' and column_name = 'meta_description'
    )

  union all
  select 'premade_candies.og_image_url',
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'premade_candies' and column_name = 'og_image_url'
    )

  union all
  select 'premade_candies.canonical_url',
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'premade_candies' and column_name = 'canonical_url'
    )

  union all
  select 'payment_failures.rls_enabled',
    exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'payment_failures' and c.relrowsecurity
    )

  union all
  select 'policy.payment_failures_admin_write',
    exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'payment_failures'
        and policyname = 'payment_failures_admin_write'
    )
)
select
  case when ok then 'OK' else 'MISSING' end as status,
  item
from checks
order by ok asc, item asc;
