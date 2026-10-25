# Admin-only candy colours

Create/edit order includes **Candy fill colour** alongside the jacket colours.
**Pinstripe colour** appears for Pin stripe and Two colour + Pin stripe jackets.
Both use the existing palette and custom Hex/RGB/CMYK picker.

The colours are saved per order (including separate invoice tabs), restored on
edit/re-make, and carried into order summaries, production previews, printouts
and email previews/details. Changing jacket type hides pinstripe controls without
discarding the chosen colour. These controls do not change pricing.

Customer-facing editor controls are unchanged. Old orders and customer orders
without these fields continue to use white fill and white pinstripes.

Database setup: apply `docs/sql/2026-10-25-admin-candy-colours.sql` before deploying
the code. It adds two nullable, hex-validated fields to `orders` and does not
rewrite existing rows. Admin server actions validate the new values; the customer
checkout does not accept these overrides.
