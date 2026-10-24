# Admin action feedback and navigation memory

Implemented locally on 2026-10-24. No database migration or new dependency is required.

## Behaviour

- Admin submit controls use the shared `AdminSubmitButton`: pending spinner, accessible busy state and disabled repeated submissions. Existing action names, values, validation, permission checks and consequential-action confirmations are retained.
- Order create/edit saves use a compact status strip instead of a full-screen blocking overlay. Order edits use the existing inline action result so validation failures can remain on the form. Uncertain network failures explicitly ask staff to check whether the order saved before retrying.
- Production notes are controlled fields so React's post-action form reset cannot erase them after a handled error. Their existing per-invoice-tab remount keys are retained.
- Notifications are dismissible and announced to assistive technology. Success messages last six seconds and pause for interaction. Errors remain until dismissed or a confirmed success resolves the same operation; repeated identical errors are collapsed. Notifications do not lock the page or steal focus.
- Progress, result and unsaved-work notices share a header location immediately left of Search orders on desktop. On smaller screens they stack below the header without covering the navigation controls.
- Order create/edit forms warn about unsaved changes when using admin links, row navigation, header search, sign-out, reload or closing the tab. Admin navigation uses a small keep/discard panel without a modal backdrop. Reload/close use the browser's native safeguard. Draft contents remain in page memory, not browser storage.
- Computed quote fields and empty upload timestamps do not make an untouched draft dirty. Returning a user-edited field to its original value clears its dirty state.
- Production panel choice and calendar start week are remembered within the browser tab. The five-day calendar layout is unchanged.
- Return links remember the originating order/invoice list URL, including search, filters, sorting and invoice pagination. Scroll positions are kept per exact list URL for 30 minutes. Transient notification parameters do not create different scroll entries.

## Deliberate limits

- This does not promise automatic draft recovery after a browser crash or a discarded page. Drafts are not saved to local/session storage because they can contain customer details and uploaded artwork.
- The custom draft-navigation guard does not intercept browser-history Back/Forward traversal. It protects application navigation and native reload/close without monkey-patching Next.js history state.
- No blanket automatic undo has been added. Refunds, emails and external invoices cannot safely be reversed by a generic UI undo; production changes also need concurrency-aware server checks before an undo feature is introduced.
- No success message is inferred just because a request finished: existing server results and validated redirect feedback remain authoritative.

## Verification

- Vitest coverage includes shared pending buttons, action-intent preservation, draft fingerprinting, safe return URLs and exact scroll keys.
- Local production-build browser checks use Chrome and WebKit, block all mutating requests and permit only the read-only quote endpoint.
- Failed network saves and validation/success results are simulated in the browser. Tests must never send real customer emails, refunds, invoices or order updates merely to verify this UX.
