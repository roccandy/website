# Roc Candy Pricing Fact Sheet

Authoritative summary of the current live pricing, packaging, labels, and extras.

Verified against the live Supabase pricing/config tables on `2026-04-21`.

## Categories and Base Pricing

- Categories (5): `weddings-initials`, `weddings-both-names`, `custom-1-6`, `custom-7-14`, `branded`.
- Base price logic:
  - Weddings (initials): `$325` for `0-3 kg`; `+$50` per kg for `>3-6 kg`; `6-8.2 kg` uses the weddings (both names) price.
  - Weddings (both names): `$495` flat up to `8.2 kg`.
  - Custom text (1-6 letters): `$325` for `0-3 kg`; `+$50` per kg for `>3-6 kg`; `6-8.2 kg` uses the custom text (7-14) price.
  - Custom text (7-14 letters): `$495` flat up to `8.2 kg`.
  - Branded: `$645` flat up to `8.2 kg`.

## Packaging Options

Each row defines: type | size | candy weight per package | allowed categories | unit price | max packages per order.

### Bags

- Clear Bag | `3-5pc` | `10g` | Custom Text, Branded | `$0.40` | `800`
- Clear Bag | `5-7pc` | `15g` | Custom Text, Branded | `$0.57` | `500`
- Clear Bag | `8-10pc` | `23g` | Weddings, Custom Text, Branded | `$0.65` | `320`
- Clear Bag | `12-15pc` | `34g` | Weddings, Custom Text, Branded | `$0.65` | `230`
- Clear Bag | `25-30pc` | `66g` | Weddings, Custom Text, Branded | `$0.75` | `120`
- Zip Bag | `8-10pc` | `23g` | Weddings, Custom Text, Branded | `$0.75` | `320`
- Zip Bag | `12-15pc` | `34g` | Weddings, Custom Text, Branded | `$0.75` | `230`
- Zip Bag | `25-30pc` | `66g` | Weddings, Custom Text, Branded | `$0.75` | `120`
- Bulk | `1kg` | `1000g` | Weddings, Custom Text, Branded | `$0.00` | `8`

### Jars

- Jar | Mini | `23g` | Weddings, Custom Text, Branded | `$1.80` | `350`
- Jar | Small | `75g` | Weddings, Custom Text, Branded | `$1.80` | `105`
- Jar | Medium | `125g` | Weddings, Custom Text, Branded | `$2.75` | `65`

### Cones

- Cone | `12-15pc` | `34g` | Weddings, Custom Text (1-6 only) | `$0.80` | `230`
- Cone | `25-30pc` | `60g` | Weddings, Custom Text (1-6 only) | `$0.80` | `120`

## Label Pricing

- Pricing rule: `price = ((label_count * range_cost) + supplier_shipping_cost) * markup_multiplier`.
- Ranges (label count upper bound | range cost):
  - `25` | `$0.70`
  - `50` | `$0.44`
  - `75` | `$0.44`
  - `100` | `$0.44`
  - `125` | `$0.43`
  - `150` | `$0.41`
  - `175` | `$0.39`
  - `200` | `$0.36`
  - `225` | `$0.35`
  - `250` | `$0.35`
  - `275` | `$0.34`
  - `300` | `$0.34`
  - `325` | `$0.33`
  - `350` | `$0.33`
  - `375` | `$0.32`
  - `400` | `$0.32`
  - `425` | `$0.31`
  - `450` | `$0.31`
  - `475` | `$0.30`
  - `500` | `$0.30`
  - `525` | `$0.29`
  - `550` | `$0.29`
  - `575` | `$0.28`
  - `600` | `$0.28`
  - `625` | `$0.27`
  - `650` | `$0.27`
  - `675` | `$0.26`
  - `700` | `$0.26`
  - `725` | `$0.26`
  - `750` | `$0.25`
  - `775` | `$0.25`
  - `800` | `$0.25`
- Current settings:
  - `labels_supplier_shipping = 20`
  - `labels_markup_multiplier = 1.75`
  - `labels_max_bulk = 1000`
  - `ingredient_label_price = 0.17`

## Extras

- Jackets: Rainbow `$35`, 2 Colour `$35`, Pinstripe `$35`.
- Urgency fee: `10%` if the due date falls within the `14 day` lead-time window.
- Lead time: `14 days`.

## Operational Guards

- Max order weight: `8.2 kg` total candy.
- Quantity validation is based on `sum(package_count * candy_weight_g)`.

## Admin Editing Guidance

These values are intended to stay admin-editable rather than code-driven:

- Base pricing tiers per category.
- Packaging options:
  type, size, candy weight, allowed categories, unit price, max packages, dimensions.
- Label ranges plus the global label-shipping / markup settings.
- Settings:
  lead time, urgency fee, jacket fees, ingredient label price, max total kg.
