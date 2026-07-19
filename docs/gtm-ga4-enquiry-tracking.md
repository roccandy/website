# GTM, GA4, Ecommerce, and Enquiry Tracking

Use this setup for the website events already emitted by Roc Candy:

- `enquiry_form_start`: a visitor first focuses the enquiry form.
- `generate_lead`: the website confirms that the enquiry email was successfully sent.

The events include:

- `lead_type`: `wedding`, `branded`, `custom-text`, `pre-made`, or `general`.
- `source_page`: the internal page that sent the visitor to the form.

Do not mark `enquiry_form_start` as a conversion. Mark only `generate_lead`.

Live status checked 2026-07-19:

- `add_to_cart`: data layer and GA4 collection confirmed.
- `begin_checkout`: data layer and GA4 collection confirmed.
- `enquiry_form_start`: present in the data layer, but no GA4 collection request was sent. Complete and publish the lead tag setup below.
- `generate_lead`: requires one successful test enquiry after the GTM lead tags are configured.
- `purchase`: requires one controlled test payment.

The shop also emits standard GA4 ecommerce events:

- `view_item`
- `add_to_cart`
- `begin_checkout`
- `purchase`

Each ecommerce event includes an `ecommerce` object with `currency`, `value`, and `items`. `purchase` also includes `transaction_id`, `tax`, and `shipping`. The website clears the previous ecommerce object before each event and prevents the same purchase transaction from being emitted twice in one browser session.

## 1. Create Data Layer Variables in GTM

In Google Tag Manager, open container `GTM-5MJ3W4HL`.

Go to **Variables → User-Defined Variables → New → Data Layer Variable**.

Create:

1. `DLV - lead_type`
   - Data Layer Variable Name: `lead_type`
   - Data Layer Version: Version 2
2. `DLV - source_page`
   - Data Layer Variable Name: `source_page`
   - Data Layer Version: Version 2

## 2. Create Custom Event Triggers

Go to **Triggers → New → Trigger Configuration → Custom Event**.

Create:

1. `CE - enquiry_form_start`
   - Event name: `enquiry_form_start`
   - Fires on: All Custom Events
2. `CE - generate_lead`
   - Event name: `generate_lead`
   - Fires on: All Custom Events

Also create one exact-match Custom Event trigger for each ecommerce event:

3. `CE - view_item`
4. `CE - add_to_cart`
5. `CE - begin_checkout`
6. `CE - purchase`

Use exact lowercase names.

## 3. Create GA4 Event Tags

Go to **Tags → New → Google Analytics: GA4 Event**.

Use the same Google tag or Measurement ID already used by the site's GA4 setup (`G-BPBTW6QF34`).

Create:

### `GA4 Event - enquiry_form_start`

- Event name: `enquiry_form_start`
- Event parameters:
  - `lead_type` = `{{DLV - lead_type}}`
  - `source_page` = `{{DLV - source_page}}`
- Trigger: `CE - enquiry_form_start`

### `GA4 Event - generate_lead`

- Event name: `generate_lead`
- Event parameters:
  - `lead_type` = `{{DLV - lead_type}}`
  - `source_page` = `{{DLV - source_page}}`
- Trigger: `CE - generate_lead`

Create equivalent GA4 Event tags for `view_item`, `add_to_cart`, `begin_checkout`, and `purchase`. Use the website event name as the GA4 event name, select the matching custom-event trigger, and send the ecommerce data from the data layer. Do not rebuild product values manually from page elements.

For `purchase`, confirm GA4 receives a non-empty `transaction_id`. This is essential for purchase deduplication and reporting.

## 4. Test Before Publishing

1. Click **Preview** in GTM.
2. Connect Tag Assistant to `https://www.roccandy.com.au`.
3. Open one pre-made product, add it to the cart, and continue to checkout.
4. Confirm `view_item`, `add_to_cart`, and `begin_checkout` appear and the matching GA4 tag fires once for each.
5. Inspect each event and confirm `ecommerce.items`, `ecommerce.value`, and `ecommerce.currency` are populated.
6. Use an approved test payment and confirm `purchase` fires once with `transaction_id`. Do not test a live charge unless the payment environment and refund process are confirmed.
7. Open `https://www.roccandy.com.au/contact#enquiry-form` and focus a form field.
8. Confirm an `enquiry_form_start` event appears and its GA4 tag fires once.
9. Submit one real test enquiry.
10. Confirm `generate_lead` appears only after the successful form response.
11. Inspect both lead events and confirm `lead_type` and `source_page` are populated.
12. Confirm no name, email, phone, message, or attachment filename is sent to analytics.

If the tags do not fire, do not publish. Check the event spelling and trigger attached to each tag.

## 5. Publish and Mark the Lead Event

1. Submit and publish the tested GTM workspace with a clear version name such as `Website enquiry tracking`.
2. In GA4 go to **Admin → Data display → Events**.
3. Find or create `generate_lead` and mark it as a key event.
4. Leave `enquiry_form_start` as a normal event.
5. Check GA4 Realtime after another test. Standard reports may take up to 24 hours.

## 6. Google Ads

After GA4 is receiving `generate_lead` and `purchase`:

- Mark `generate_lead` and `purchase` as GA4 key events.
- Import or create the corresponding Google Ads conversions.
- Use one primary enquiry conversion and one primary purchase conversion for bidding.
- Leave `view_item`, `add_to_cart`, `begin_checkout`, and `enquiry_form_start` as secondary/observational events.
- Avoid a second purchase tag on the success-page page view; use the transaction-based `purchase` event so refreshes are not counted as new sales.

Official references:

- https://support.google.com/tagmanager/answer/7679219
- https://support.google.com/tagmanager/answer/13034206
- https://support.google.com/analytics/answer/13128484
- https://support.google.com/analytics/answer/15756111
