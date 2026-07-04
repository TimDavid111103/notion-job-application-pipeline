# Gotchas

Cross-cutting pitfalls. Per-aggregator detail: [access.md](access.md), [jack-kanban.md](jack-kanban.md), [job-aggregators.md](job-aggregators.md).

## Sourcing

- **Light elimination only** — skip obvious mismatches; when in doubt, keep. No scoring engine. See [elimination-rules.md](elimination-rules.md).
- **Scratch file** — persists across runs; new rows prepended (**newest at top**). `JOB_LIMIT` = new postings only; Notion dedup still required.
- **Scratch dedup** — `loadScratchKeys` during sourcing + `appendJobs`/`jobKey` at write (prepend). Never pad quota with duplicates.
- **Job limits** — defaults in `scripts/lib/limits.ts` `DEFAULT_LIMITS`; see [env-vars.md](env-vars.md).

## Wobo

- **Duplicate Save/Decline buttons** — sticky header does not advance the feed; `feedActionButton()` clicks the card-footer pair (`.last()`). Keyboard `s`/`a` fallback.
- **"All caught up for today"** — expected when Wobo has no more cards; not an error.

## Jack & Jill

- **Two surfaces** — inbox and Saved kanban; empty both daily via `jack-empty.ts`.
- **Never send a prompt while Jack is generating** — condition-based waits only.
- **Scope DOM to right pane** (x > ~520) — chat feed has look-alike buttons.
- **`locator.isVisible()` does not wait** — use `waitFor({ state: "visible" })`.

## Notion

- **Location = Source** in the tracker — do not silently map geographic location into that field.
- **Full history query** — omit `filter` on `query_database`; never pass `filter: {}`.
- **Always** `npm run log:notion:deduped` before MCP insert — not `log:notion` alone.

## Process

- **Playwright scripts, not browser MCP tabs** for sourcing.
- **Process hygiene** — `closeBrowser` + detached process-group kill in `source-all.ts` prevent hung Node processes.
