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

Paths: `scripts/lib/paths.ts`. Cleanup: `npm run cleanup:data` (`scripts/lib/cleanup.ts`).

**Permanent (never delete):**

| File | Written by | Purpose |
|---|---|---|
| `data/sourced-jobs.md` | `appendJobs` | Scratch + sourcing dedup keys |
| `data/.gitkeep` | setup | Keeps `data/` in git |

**Temporary (delete everything else):**

| Path | Written by | Purpose |
|---|---|---|
| `data/source/notion-tracker-snapshot.json` | MCP `query_database` | Tracker history for failsafe dedup |
| `data/source/notion-payloads.json` | `log:notion:deduped` | MCP insert batch |
| `mcp-*` files/dirs, queues, `*.scratch.md`, `*-temp.md`, `*-staging.json`, etc. | agent / debug / other skills | One-off dumps — not scratch |

**Cleanup — mandatory twice per run:**

1. **Step 5 (before logging)** — clear all temps before Notion snapshot/payloads.
2. **Step 9 (after logging)** — clear all temps after MCP insert.

`npm run cleanup:data` deletes temporary artifacts while preserving
`data/sourced-jobs.md` and `data/.gitkeep`.
Do not leave snapshot, payloads, or MCP helper files behind.
