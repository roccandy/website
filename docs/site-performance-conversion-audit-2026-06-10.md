# Roc Candy Website Performance & Conversion Audit

Date: 2026-06-10
Scope: live `https://roccandy.com.au`, repo implementation, mobile customer flow, crawl/indexing, Lighthouse lab performance, and analytics-event behavior.

## Executive Summary

The site is technically healthy from an SEO/indexing point of view: sitemap URLs return `200`, canonical tags are present, JSON-LD parses, image `alt` text is present, and no internal broken links were found in the sitemap crawl.

The bigger risks are conversion and measurement:

1. **Analytics may be under-reporting funnel events.** `add_to_cart` and `begin_checkout` are pushed into `window.dataLayer`, but in the live browser test I did not see matching Google collect requests for those ecommerce event names. GTM loads, but the container likely needs tags/triggers checked for `add_to_cart`, `begin_checkout`, and `purchase`.
2. **Mobile home performance is weak.** Lighthouse mobile home score was `65`, with LCP `7.6s`, CLS `0.213`, and total payload about `4.2MB`. The largest payload is the home feature MP4 at about `3.2MB`.
3. **Pre-made add-to-cart flow works but hides the next step.** Tapping add-to-cart on a product page only shows a toast and cart badge. It does not open the cart drawer or show an immediate checkout action. On mobile, that adds avoidable friction.
4. **Checkout asks for several fields before payment becomes useful.** Even for pre-made candy, a required date is enforced, and the checkout page places an upsell carousel before date/details/payment. This is not broken, but it delays the pay action and can leak intent.
5. **Accessibility issues overlap with conversion quality.** The top pink nav text fails contrast, and the hidden home CTA option links remain focusable while `aria-hidden=true`.

## Checks Run

- Live crawl of all `24` sitemap URLs.
- Internal link status check from crawled pages: `31` unique internal links, no broken links found.
- `robots.txt`, sitemap, canonical, title, description, H1, JSON-LD, and image alt checks.
- Lighthouse lab runs:
  - `/` desktop and mobile.
  - `/design` mobile.
  - `/pre-made-candy` mobile.
  - `/pre-made-candy/love-hearts-rock-candy` mobile.
- Headless Chrome customer path:
  - Home page.
  - Product page.
  - Add pre-made item to cart.
  - Open cart drawer.
  - Continue to checkout.
  - Confirm Square checkout script loads.
- Data layer check for ecommerce events.

## Lighthouse Results

| Page | Device | Performance | Accessibility | Best Practices | SEO | Key Metrics |
|---|---:|---:|---:|---:|---:|---|
| `/` | Desktop | 86 | 91 | 77 | 100 | LCP `2.4s`, CLS `0.002`, TBT `0ms` |
| `/` | Mobile | 65 | 91 | 77 | 100 | LCP `7.6s`, CLS `0.213`, TBT `70ms`, payload `4.2MB` |
| `/design` | Mobile | 75 | 96 | 77 | 92 | LCP `2.8s`, CLS `0.454`, TBT `90ms`, TTI `8.7s` |
| `/pre-made-candy` | Mobile | 96 | 96 | 77 | 100 | LCP `2.7s`, CLS `0`, TBT `110ms` |
| Product detail | Mobile | 90 | 96 | 77 | 100 | LCP `3.4s`, CLS `0`, TBT `100ms` |

## Findings & Recommendations

### P0 - Verify Ecommerce Tracking In GTM

Evidence:

- GTM loads on the live site: `GTM-5MJ3W4HL`.
- GA4 loads via GTM: `G-BPBTW6QF34`.
- Google Ads remarketing/conversion resources load: Ads ID `1041991106`.
- Code pushes ecommerce events in `src/lib/analyticsEvents.ts`.
- Live browser test confirmed `window.dataLayer` receives:
  - `add_to_cart`
  - `begin_checkout`
- The same test did not show matching Google collect requests for those ecommerce event names, only page view / remarketing requests.

Likely impact:

If GTM is not forwarding these custom dataLayer events to GA4/Ads, the business may be flying partly blind. Sales could be quiet, or the site could be losing users between product/cart/checkout, but GA/Ads may not show the funnel accurately.

Recommended action:

- In GTM, confirm triggers exist for custom events:
  - `view_item`
  - `add_to_cart`
  - `begin_checkout`
  - `purchase`
- Confirm GA4 event tags fire for those custom events and map `ecommerce.items`, `ecommerce.value`, `ecommerce.currency`, and `transaction_id`.
- Confirm Google Ads conversion action fires on `purchase`, not only page view / remarketing.
- Use GTM Preview on the live domain and run the exact test path: product -> add to cart -> checkout -> test payment/success where possible.
- Consider clearing ecommerce before each event push:
  - `dataLayer.push({ ecommerce: null })`
  - then `dataLayer.push({ event, ecommerce })`

Relevant code:

- `src/lib/analyticsEvents.ts:46`
- `src/components/AddPremadeToCartButton.tsx:38`
- `src/app/checkout/CheckoutClient.tsx:1288`
- `src/app/checkout/CheckoutClient.tsx:1439`

### P1 - Improve Mobile Home Page Load

Evidence:

- Mobile home Lighthouse performance: `65`.
- LCP: `7.6s`.
- CLS: `0.213`.
- Payload: about `4.2MB`.
- Largest payload: `/landing/home-feature-web.mp4`, about `3.2MB`.
- The video is below the hero, but `AutoplayOnViewVideo` forces `preload="auto"` and `eager` loading on the home page.

Likely impact:

Ads traffic often lands on mobile. A slow first landing page can reduce conversion before users even reach the design or pre-made flow.

Recommended action:

- Stop eager-loading the home feature video on mobile.
- Change below-fold video to `preload="metadata"` or lazy load only when near viewport.
- Use a compressed poster/preview image first; only load MP4 after interaction or scroll proximity.
- Consider mobile-specific video source under `1MB` if autoplay is kept.
- Convert `/landing/home-feature-poster.jpg` to WebP/AVIF or route it through `next/image`.
- Add explicit layout stability for the home hero/background area to reduce CLS.

Relevant code:

- `src/app/page.tsx:140`
- `src/components/AutoplayOnViewVideo.tsx:28`
- `src/components/AutoplayOnViewVideo.tsx:101`

### P1 - Reduce Pre-Made Add-To-Cart Friction

Evidence:

- Product add button works.
- After tapping add-to-cart, the page shows a toast and cart badge.
- The cart drawer does not open automatically.
- Checkout is only visible after the user notices and taps the cart icon.

Likely impact:

For low-consideration pre-made products, each extra step matters. Users who tap add-to-cart have strong intent; the next action should be obvious.

Recommended action:

- After add-to-cart, open the cart drawer automatically, or show a persistent toast/snackbar with `Checkout` and `Continue shopping`.
- On product detail pages, consider a full-width mobile `Add to cart` / `Buy now` button with text, not only a cart icon.
- In the cart drawer, reduce empty vertical space on mobile so item + checkout feel connected.

Relevant code:

- `src/components/AddPremadeToCartButton.tsx:38`
- `src/components/HeaderMenuClient.tsx:88`

### P1 - Simplify Checkout Above The Fold

Evidence:

- The checkout flow is functional.
- Square loads successfully.
- No browser console errors were captured during the tested product-to-checkout path.
- Payment appears below cart, recommendations, date, delivery, and details.
- Date is required for all orders, including pre-made-only orders.

Likely impact:

For pre-made products, the checkout feels heavier than expected. The upsell carousel appears before required checkout details, which can distract users who already decided to buy.

Recommended action:

- Move the recommendations carousel after payment/order summary, or collapse it behind "Add more candy".
- For pre-made-only carts, consider clearer wording: "Delivery or pickup date" instead of "Date required".
- If operationally possible, make date optional for pre-made delivery and default to earliest dispatch/pickup window.
- Add a sticky mobile order summary / continue-to-payment affordance after cart review.
- When the pay button is clicked with missing fields, scroll to the first missing field and show the validation message near the button.

Relevant code:

- `src/app/checkout/CheckoutClient.tsx:1301`
- `src/app/checkout/CheckoutClient.tsx:1605`
- `src/app/checkout/CheckoutClient.tsx:1614`
- `src/app/checkout/CheckoutClient.tsx:1792`

### P2 - Fix Accessibility Issues That Also Affect Trust

Evidence:

- Lighthouse reports color contrast failures for top nav links using pink on white.
- The hidden home CTA options use `aria-hidden=true` while containing focusable links.

Likely impact:

These are not likely to explain a major sales drop alone, but they are easy quality fixes and can affect mobile usability and perceived polish.

Recommended action:

- Darken top-nav pink text or increase font size/weight enough to pass contrast.
- When `DesignCtaModal` is collapsed, either do not render the option links, set `inert`, or set child links `tabIndex={-1}`.

Relevant code:

- `src/app/DesignCtaModal.tsx:261`
- `src/app/DesignCtaModal.tsx:270`

### P2 - Preserve SEO Strength But Add Commercial Landing Pages

Evidence:

- Technical SEO is in good shape.
- All sitemap URLs checked returned `200`.
- No missing image alts found in the crawled HTML.
- JSON-LD parsed without errors.
- Existing pages are broad and crawlable.

Recommended action:

- Keep current technical SEO intact.
- For Google Ads, use tightly matched landing pages instead of sending all traffic to broad pages:
  - wedding favour candy
  - corporate logo candy
  - custom text rock candy
  - baby shower candy
  - pre-made candy gifts
- Each Ads landing page should have a direct CTA, proof/examples, price/timing reassurance, and fewer navigation distractions.

## Priority Backlog

1. GTM/GA4/Ads audit: confirm ecommerce events fire all the way through to GA4 and Ads.
2. Home mobile performance fix: lazy/defer the MP4 and reduce total payload.
3. Pre-made product conversion fix: open cart drawer or show checkout action after add-to-cart.
4. Checkout simplification: move recommendations below payment/details and clarify pre-made date requirement.
5. Accessibility polish: contrast and hidden focusable CTA links.
6. Ads landing pages: build campaign-specific pages once tracking is trustworthy.

## Data Needed To Decide Lull vs Website Problem

To separate market lull from website conversion loss, compare the same date windows before and after launch:

- Sessions by source/medium.
- Google Ads clicks, CPC, search terms, and landing pages.
- GA4 events: `view_item`, `add_to_cart`, `begin_checkout`, `purchase`.
- Checkout/payment failure logs from `/api/payments/log-failure`.
- Orders by channel and product type.
- Conversion rate from Ads click -> checkout -> purchase.
- Device split, especially mobile.

Without that export, the technical read is: SEO/indexing is not the problem; the highest-risk issues are funnel measurement, mobile home performance, and product/cart/checkout friction.
