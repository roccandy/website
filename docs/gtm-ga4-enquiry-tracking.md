# GTM and GA4 Enquiry Tracking

Use this setup for the website events already emitted by Roc Candy:

- `enquiry_form_start`: a visitor first focuses the enquiry form.
- `generate_lead`: the website confirms that the enquiry email was successfully sent.

The events include:

- `lead_type`: `wedding`, `branded`, `custom-text`, `pre-made`, or `general`.
- `source_page`: the internal page that sent the visitor to the form.

Do not mark `enquiry_form_start` as a conversion. Mark only `generate_lead`.

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

## 4. Test Before Publishing

1. Click **Preview** in GTM.
2. Connect Tag Assistant to `https://www.roccandy.com.au/contact#enquiry-form`.
3. Focus a form field.
4. Confirm an `enquiry_form_start` event appears and its GA4 tag fires once.
5. Submit one real test enquiry.
6. Confirm `generate_lead` appears only after the successful form response.
7. Inspect both events and confirm `lead_type` and `source_page` are populated.
8. Confirm no name, email, phone, message, or attachment filename is sent to analytics.

If the tags do not fire, do not publish. Check the event spelling and trigger attached to each tag.

## 5. Publish and Mark the Lead Event

1. Submit and publish the tested GTM workspace with a clear version name such as `Website enquiry tracking`.
2. In GA4 go to **Admin → Data display → Events**.
3. Find or create `generate_lead` and mark it as a key event.
4. Leave `enquiry_form_start` as a normal event.
5. Check GA4 Realtime after another test. Standard reports may take up to 24 hours.

## 6. Google Ads

After GA4 is receiving `generate_lead`, create or import a Google Ads conversion based on that GA4 key event. Use one primary lead conversion for bidding to avoid counting the same enquiry twice.

Official references:

- https://support.google.com/tagmanager/answer/7679219
- https://support.google.com/tagmanager/answer/13034206
- https://support.google.com/analytics/answer/13128484
- https://support.google.com/analytics/answer/15756111
