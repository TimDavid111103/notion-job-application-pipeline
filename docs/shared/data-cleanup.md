# Data cleanup

`npm run cleanup:data` removes every temporary artifact under `data/`.

## Permanent (kept)

- `data/sourced-jobs.md` — rolling scratch for sourcing dedup
- `data/.gitkeep`

## Temporary (deleted)

Everything else under `data/`, including lane folders:

- `data/source/` — Notion snapshot + payloads
- `data/scrape/` — scrape snapshot, queue, results
- `data/fill/` — fill snapshot, queue, session, url-health, results, tailored cover-letter PDFs

Writers recreate lane directories via `ensureParentDir()` when needed.

Implementation: `scripts/lib/cleanup.ts`, paths in `scripts/lib/paths.ts`.
