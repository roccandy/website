# Custom Text Rendering Rollback

Created before changing the 1-6 / 7-14 custom text input and preview logic.

Rollback options:

- Preferred while changes are uncommitted: use `git diff` to inspect the changed files, then restore only the custom text rendering edits if needed.
- A pre-change patch of the current local custom text files was saved at `/tmp/roccandy-pre-custom-text-logic.diff`.
- The main files expected to change are:
  - `src/app/quote/QuoteBuilder.tsx`
  - `src/app/quote/CandyPreview.tsx`
  - `src/app/quote/quoteBuilderShared.ts`

Do not run a broad reset unless you intend to discard unrelated admin/order changes currently in the working tree.
