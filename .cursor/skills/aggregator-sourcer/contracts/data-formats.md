# Scratch Data Formats

Cleanup policy: [docs/shared/data-cleanup.md](../../../../docs/shared/data-cleanup.md).

Single source of truth for `SourcedJob`, scratch file format, dedup layers, and `data/source/`
artifacts. Notion tracker workflow: [notion/mcp-workflows.md](../notion/mcp-workflows.md).

## `SourcedJob` (`scripts/lib/job/index.ts`)

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
   `log:notion:deduped`. Rules: [notion/mcp-workflows.md](../notion/mcp-workflows.md).

## Runtime artifacts (`data/source/`, gitignored)

Paths: `scripts/lib/paths.ts`. Keep vs delete: [docs/shared/data-cleanup.md](../../../../docs/shared/data-cleanup.md).

| Path | Written by | Purpose |
|---|---|---|
| `data/source/notion-tracker-snapshot.json` | MCP `query_database` | Tracker history for failsafe dedup |
| `data/source/notion-payloads.json` | `log:notion:deduped` | MCP insert batch |

**Cleanup timing (this skill):** step 5 before logging, step 9 after MCP insert — both via
`npm run cleanup:data`. Do not leave snapshot or payload files behind.
