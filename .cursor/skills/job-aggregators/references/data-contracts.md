# Data Contracts

## `SourcedJob` (`scripts/lib/job.ts`)

```ts
interface SourcedJob {
  company: string;
  role: string;
  jobUrl: string;
  source: "Wobo" | "Handshake" | "Jack & Jill";
  location: string;  // geographic — not the Notion tracker "Location" field
  dateSourced?: string;  // YYYY-MM-DD — scratch column only; set by scratch.ts
}
```

## Scratch file (`sourced-jobs.md` at repo root)

Markdown table — **persists across runs**; **newest rows at the top**:

```
| Date | Company | Role | Job URL | Source | Location |
|---|---|---|---|---|---|
```

- **Date** — ISO `YYYY-MM-DD` when the job was sourced to scratch (not Notion "Date Added").
- New batches are **prepended** via `appendJobs()` so the latest postings appear first.

### Scratch dedup (two stages)

1. **During sourcing** — `loadScratchKeys()` in aggregator runners; known postings skip without counting toward `JOB_LIMIT` (feed still advanced).
2. **At write** — `appendJobs()` via `jobKey()` (normalized URL, else company+role); duplicates are not prepended.

`ensureScratchFile()` (called by `source-all.ts`) updates the file title date, prunes duplicate keys, and re-sorts newest-first.

Identity helpers: `jobKey`, `normalizeJobUrl`, `dedupeJobList` in `scripts/lib/job.ts`.

## Notion payload (`scripts/lib/notion.ts`)

Prepared by `npm run log:notion:deduped`; logged by agent via `user-notion` MCP.

```ts
{
  database_id: "32f1de14-69d8-803a-81ba-fb8cf47a1ccd",
  properties: {
    Name: `${company}: ${role}`,
    Company: company,
    Role: role,
    Location: source,           // aggregator name — NOT geographic location
    "Job URL": jobUrl,
    "Date Added": <ISO date>,
  }
}
```

Tracker schema, dedup rules, MCP query: [notion-schema.md](notion-schema.md) (do not duplicate here).

## Runtime artifacts (repo root, typically gitignored)

| File | Written by |
|---|---|
| `sourced-jobs.md` | aggregator `appendJobs` |
| `notion-tracker-snapshot.json` | agent `query_database` MCP call |
| `notion-payloads.json` | `log:notion:deduped` |
