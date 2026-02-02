# Domain Switch Checklist

This file tracks all manual URLs and settings that must be updated when switching from `roccandy.vercel.app` to `roccandy.com.au`.

## Vercel
- Add domains: `roccandy.com.au` + `www.roccandy.com.au`
- Env var: `NEXTAUTH_URL` -> `https://roccandy.com.au`
- Ensure primary domain is `roccandy.com.au` (redirect `www` -> apex).

## GitHub Actions
- Secret: `KEEPALIVE_URL` -> `https://roccandy.com.au/api/keepalive`

## WooCommerce
- Webhook Delivery URL -> `https://roccandy.com.au/api/woo/webhook`
- Order received / return URL -> `https://roccandy.com.au/checkout/success`

## Google / SEO
- Google Merchant Center: set site URL to `https://roccandy.com.au`
- Google Search Console: add + verify property for `https://roccandy.com.au`

## Apple Pay (Square)
- Re-verify domain with Square using the live domain file:
  - `https://roccandy.com.au/.well-known/apple-developer-merchantid-domain-association`
- Ensure the file exists in `public/.well-known/` and is deployed.

## Supabase (if auth/email links are used)
- Supabase Auth Site URL -> `https://roccandy.com.au`
- Supabase Auth Redirect URLs -> add `https://roccandy.com.au/**`

## Cloudflare DNS
- Update `A`/`AAAA` for `@` and `www` to Vercel targets (per Vercel docs).
- Keep `woo.roccandy.com.au` pointing to VentraIP IP (DNS only).

## Notes
- `woo.roccandy.com.au` stays the same (VentraIP).
