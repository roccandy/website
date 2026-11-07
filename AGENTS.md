# Repository instructions

## Future improvements control

`docs/future-improvements.md` is the sole control document for deferred,
optional, and externally verified work.

When a change implements, validates, defers, declines, or materially changes
an item in that document, update the document in the same change and append a
dated entry to its Change log. Do not create a separate roadmap, backlog,
improvement plan, or unchecked implementation checklist elsewhere in the
repository.

Current system behaviour belongs in `docs/architecture-notes.md`; operational
and release procedure belongs in `docs/launch-steps.md`.

Admin browser verification must use the normal login flow. Use mocked
authentication in automated tests; do not mint administrator sessions using
application signing secrets or production account records.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
