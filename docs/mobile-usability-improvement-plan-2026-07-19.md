# Mobile Performance and Site-Wide Usability Plan

Date: 2026-07-19

## Progress

Started: 2026-07-19

- [x] Contextual enquiry routes added to custom-candy and pre-made pages.
- [x] Homepage below-fold feature video changed from eager loading to proximity-based loading.
- [x] Global header and footer navigation contrast improved to WCAG AA.
- [x] Primary header controls increased to at least 44 px.
- [x] Hidden top utility links removed from keyboard focus order.
- [x] Collapsed homepage design options removed from keyboard focus and mobile layout overflow.
- [x] Decorative full-bleed artwork prevented from creating horizontal page scrolling.
- [x] Browser-verified the first M1 batch at 360 × 800 and 390 × 844.
- [ ] Capture post-change mobile Lighthouse results after deployment.
- [ ] Complete remaining Phase M1 enquiry validation and sticky-control checks.
- [ ] Begin Phase M2 product/cart improvements.

## Outcome

Make the public website faster and easier to use on phones, with particular focus on reaching an enquiry or completing a pre-made purchase.

This plan covers the homepage, navigation, custom-candy landing pages, enquiry form, design flow, pre-made catalogue and products, cart, checkout, FAQs, and content pages.

## Success Measures

- No horizontal page overflow at 360 px, 390 px, or 430 px widths.
- Primary controls have at least a 44 × 44 px usable touch target.
- Mobile text can be read without zooming.
- Keyboard focus is visible and hidden content cannot receive focus.
- Mobile Lighthouse targets on key landing pages:
  - Performance: at least 85 initially, then 90 where practical.
  - Accessibility: at least 95.
  - LCP: no more than 2.5 seconds on representative mobile testing.
  - CLS: no more than 0.1.
- A visitor can reach the correct enquiry form within two deliberate taps from any public page.
- A pre-made customer sees an obvious checkout action immediately after adding an item.
- Checkout validation identifies and scrolls to the first incomplete field.

## Test Matrix

Test these viewport sizes:

- 360 × 800: smaller Android.
- 390 × 844: common iPhone.
- 430 × 932: larger phone.
- 768 × 1024: tablet.

Run these journeys:

1. Homepage → wedding/branded/text page → contextual enquiry → successful submission.
2. Landing page → design flow → configure candy → cart/checkout.
3. Pre-made collection → product → add to cart → checkout.
4. Header and footer navigation → contact, FAQs, privacy, and terms.
5. Enquiry with validation errors and with an attachment.
6. Checkout with missing required information and payment failure messaging.

For every journey check touch targets, focus order, screen-reader labels, sticky elements, back navigation, layout shifts, loading states, error recovery, and one-handed use.

## Phase M0 — Measurement and Baseline

Priority: immediate.

1. Complete GTM forwarding for `enquiry_form_start` and `generate_lead`.
2. Verify ecommerce events reach GA4: `view_item`, `add_to_cart`, `begin_checkout`, and `purchase`.
3. Capture baseline mobile Lighthouse runs for:
   - `/`
   - `/design/wedding-candy`
   - `/design/branded-logo-candy`
   - `/design/custom-text-candy`
   - `/pre-made-candy`
   - one pre-made product
   - `/contact`
   - `/checkout`
4. Record mobile traffic, form starts, leads, add-to-cart, checkout starts, and purchases before usability changes.

## Phase M1 — Immediate Mobile Friction

Priority: highest implementation phase.

### Homepage performance

- Stop eager-loading the below-fold feature video on mobile.
- Start with the compressed poster and load video only near the viewport or after interaction.
- Produce a mobile MP4 under 1 MB if autoplay remains.
- Reserve stable dimensions for hero and media areas.
- Re-run Lighthouse and compare LCP, CLS, and total transferred bytes.

### Navigation and global controls

- Confirm header, menu, cart, and Contact Us controls do not overlap at 360 px.
- Ensure all tap targets meet the 44 px target.
- Improve pink-on-white navigation contrast.
- Prevent sticky controls from covering headings, errors, or checkout actions.
- Ensure the current page and menu open/closed state are understandable.

### Enquiry journey

- Verify contextual enquiry links preserve interest, product, and source.
- Keep required fields minimal and optional fields clearly labelled.
- Ensure attachment selection, limits, errors, submission progress, and success state remain visible on small screens.
- Scroll or focus the first invalid field after a failed submission.

## Phase M2 — Purchase Funnel

Priority: high after M1.

### Product and cart

- After Add to Cart, open the cart drawer or show a persistent panel with clear `Checkout` and `Continue shopping` actions.
- Use a full-width labelled Add to Cart action on mobile product pages.
- Keep price, pack size, delivery reassurance, and the primary purchase action together.
- Reduce unused space in the mobile cart drawer.

### Checkout

- Move or collapse recommendations so they do not interrupt checkout.
- Clarify `Date required` as delivery/pickup timing for pre-made orders.
- If operations permit, default pre-made orders to the earliest available date.
- Put customer, delivery, order summary, and payment in a predictable sequence.
- On submission, focus and scroll to the first invalid field.
- Keep validation messages next to the relevant fields and summarise errors near the payment action.
- Verify Square and PayPal controls fit at 360 px and have clear loading/failure states.

## Phase M3 — Design Flow and Content Pages

Priority: medium.

- Reduce the previously measured layout shift on `/design`.
- Keep the preview, price, and next action understandable without excessive scrolling.
- Preserve entered design data when navigating backward.
- Review colour, flavour, packaging, quantity, and date controls for thumb use.
- Pause or reduce animated galleries when the user requests reduced motion.
- Ensure gallery clones and collapsed CTA options cannot receive keyboard focus.
- Improve long FAQ and policy pages with readable spacing, anchored headings where useful, and a persistent route back to the main task.

## Phase M4 — Accessibility and Trust Polish

Priority: medium, bundled with relevant component work.

- Meet WCAG AA colour contrast for navigation, links, form hints, and disabled states.
- Use visible focus rings on all controls.
- Verify semantic heading order and useful link text.
- Ensure images have meaningful alternatives and decorative artwork is ignored.
- Test at 200% browser zoom and with larger mobile text settings.
- Respect `prefers-reduced-motion`.
- Put delivery, response-time, dietary, minimum-order, and lead-time reassurance close to conversion actions where accurate.

## Implementation Order

1. Tracking and baseline.
2. Homepage video loading and layout stability.
3. Global navigation/touch/contrast pass.
4. Add-to-cart feedback and mobile product CTA.
5. Checkout ordering and validation recovery.
6. Design flow layout stability and control review.
7. Accessibility/reduced-motion/content polish.
8. Re-run the full test matrix and compare conversion data after sufficient traffic.

Each implementation phase should be released separately so performance and conversion changes can be attributed rather than bundled into one unmeasurable redesign.
