# Managed Pages CMS

This project now includes an internal CMS for SEO and landing pages.

## What it does

Admins can create and manage public pages without code from:

- `/admin/settings/pages`

Each managed page supports:

- editable URL path / slug
- editable on-page title (`H1`)
- editable body content (`HTML`)
- editable SEO title
- editable meta description
- editable canonical URL
- editable social / Open Graph image URL
- publish / unpublish toggle
- index / noindex toggle

## Good use cases

- contact page
- shipping and returns page
- wedding candy landing page
- branded candy landing page
- custom text candy landing page
- occasions pages
- city / location landing pages
- seasonal campaign pages

## Important limitations

- Built-in routes such as `/about`, `/faq`, `/privacy`, `/terms-and-conditions`, `/design`, and `/pre-made-candy` are still code-owned.
- This CMS is meant for SEO pages and landing pages that do not already exist as fixed app routes.
- Paths starting with reserved segments such as `/admin`, `/api`, `/checkout`, `/docs`, and `/pre-made-candy` are blocked.

## Storage

- Managed pages are stored in Supabase Storage as JSON at `site-content/managed-pages.json`.
- If the `site-content` bucket does not exist, the app will create it automatically on first save.

## Seeded starter pages

The CMS ships with starter content for:

- `/contact`
- `/shipping-and-returns`
- `/design/wedding-candy`
- `/design/branded-logo-candy`
- `/design/custom-text-candy`

These can be edited or deleted from the admin area.
