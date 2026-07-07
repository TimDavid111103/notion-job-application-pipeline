# Scratch Data Formats

Single source of truth for `SourcedJob`, scratch file format, dedup layers, and `data/`
artifacts. Notion tracker workflow: [notion-tracker-logging.md](notion-tracker-logging.md).

## `SourcedJob` (`scripts/lib/job.ts`)

```ts
interface SourcedJob {
  company: string;
  role: string;
  jobUrl: string;
  source: "Wobo" | "Handshake" | "Jack & Jill";
  location: string;  // geographic — not the Notion tracker "Location" field
  dateSourced?: string;  // YYYY-MM-DD — scratch column only
}
```

Identity helpers: `jobKey`, `normalizeJobUrl`, `cleanJobUrl`, `dedupeJobList`.

## Scratch file (`data/sourced-jobs.md`)

**Permanent** rolling window (default **7 days**; `SCRATCH_RETENTION_DAYS`). **Newest rows at top.**

```
| Date | Company | Role | Job URL | Source | Location |
|---|---|---|---|---|---|
```

- **Date** — ISO `YYYY-MM-DD` when sourced to scratch (not Notion "Date Added").
- New batches **prepended** via `appendJobs()`.
- `ensureScratchFile()` (in `source-all.ts`) updates title date, prunes duplicate keys,
  drops rows older than retention, re-sorts newest-first.

**Verify reporting (step 4):** row count ≠ unique job count. Report both — **total rows**
from `parseScratchFile`, **unique jobs** from `dedupeJobList()` (same keys as
`jobKey()` / `appendJobs`). If they differ, duplicate URLs are still in the file;
`ensureScratchFile` prunes on the next `source:all`.

## Dedup hierarchy

1. **Primary — during sourcing** — `loadScratchKeys()` → `isScratchDuplicate()` in aggregator
   runners. Known postings skip **without counting toward `JOB_LIMIT`** (Wobo/Jack still advance).
   Uses the full scratch file (retention window).
2. **At write** — `appendJobs()` via `jobKey()`; duplicates not prepended.
3. **Failsafe — before Notion** — `dedupeAgainstNotion()` on **today's** scratch rows only in
   `log:notion:deduped`. Rules: [notion-tracker-logging.md](notion-tracker-logging.md).

## Runtime artifacts (`data/`, gitignored)

Paths: `scripts/lib/paths.ts`. Cleanup: `npm run cleanup:data` (`scripts/lib/cleanup.ts`).

| File | Lifetime | Written by | Purpose |
|---|---|---|---|
| `sourced-jobs.md` | **Permanent** | `appendJobs` | Scratch + sourcing dedup keys |
| `notion-tracker-snapshot.json` | Temporary | MCP `query_database` | Tracker history for failsafe dedup |
| `notion-payloads.json` | Temporary | `log:notion:deduped` | MCP insert batch |
| `*.scratch.md`, `*-temp.md` | Temporary | debug pads (if any) | Not `sourced-jobs.md` |

**Cleanup:** step 5 (before logging) clears stale temps; step 9 (after MCP insert) clears
current run temps. Never deletes `sourced-jobs.md`.
