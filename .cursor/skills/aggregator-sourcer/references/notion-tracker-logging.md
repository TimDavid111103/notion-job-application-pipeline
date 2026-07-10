# Notion Tracker Logging

Single source of truth for tracker schema, failsafe dedup, MCP query/insert, and
`data/notion-payloads.json`. Scratch dedup and `data/` artifact rules:
[scratch-data-formats.md](scratch-data-formats.md).

## MCP query workflow

Agent steps for skill step 6:

1. Read `user-notion` tool schemas (`query_database`).
2. `query_database` with database ID `32f1de14-69d8-803a-81ba-fb8cf47a1ccd` — **omit `filter`**.
3. Save JSON to `data/notion-tracker-snapshot.json`.

## MCP insert workflow

Agent steps for skill step 8:

Read `data/notion-payloads.json` and call `add_database_entries` (batch ~16 at a time) or
`add_database_entry` per row.

Use `user-notion` MCP: `get_database` → `query_database` → `add_database_entry(s)`.

## Workflow summary

Skill steps 5–9: `cleanup:data` → snapshot → `log:notion:deduped` → MCP insert →
`cleanup:data` again. Cleanup rules: [scratch-data-formats.md](scratch-data-formats.md).

## Tracker schema

**Database ID (MCP):** `32f1de14-69d8-803a-81ba-fb8cf47a1ccd`  
**Data source ID:** `32f1de14-69d8-8016-9135-000ba274e2bd` — share with integration when ready

| Column | Type | Value |
|---|---|---|
| Name | title | `{Company}: {Role}` |
| Company | rich_text | Company name |
| Role | rich_text | Job title |
| Location | select | `Wobo`, `Handshake`, or `Jack & Jill` |
| Job URL | url | Direct posting link (plain URL) |
| Date Added | date | Today (UTC ISO) |

> **Location = Source:** tracker **Location** stores the aggregator name, not geographic
> location. `toNotionProperties` in `scripts/lib/notion.ts` maps `job.source` → `Location`.
> Do not silently map geographic location into this field.

## Failsafe dedup

Scratch dedup during sourcing is primary ([scratch-data-formats.md](scratch-data-formats.md)). This step
catches **today's** scratch rows that already exist in the tracker (e.g. reposted listings).

Query **full tracker history** — postings resurface after ~1 week. Drop a job if **either**:

1. **Normalized Job URL** matches an existing entry, or
2. **Company + Role** (case-insensitive) matches an existing entry.

**URL normalization** (`normalizeJobUrl` / `cleanJobUrl` in `scripts/lib/job.ts`):

- unwrap markdown `[text](url)` links
- strip query string and hash
- lowercase host, trim trailing slash
- rewrite Handshake `/job-search/{id}` → `/jobs/{id}`

```json
{ "database_id": "32f1de14-69d8-803a-81ba-fb8cf47a1ccd" }
```

**Omit `filter` entirely** — do not pass `filter: {}` (MCP rejects empty object).

Implementation: `dedupeAgainstNotion`, `parseNotionQueryResults`, `prepareNotionPayloads` in
`scripts/lib/notion.ts`. Unit checks: `npm run test:notion-dedup`.

**MCP snapshot shape:** `query_database` may return flat strings (`Company`, `Role`,
`Job URL`) or nested `properties.*` — `parseNotionQueryResults` handles both.

## Payload file (`data/notion-payloads.json`)

Runtime artifact written by `npm run log:notion:deduped` — **not** a schema doc. Do not
hand-edit for normal runs; regenerate after scratch or snapshot changes.

Each array element matches `prepareNotionPayloads()`:

```json
{
  "database_id": "32f1de14-69d8-803a-81ba-fb8cf47a1ccd",
  "properties": {
    "Name": "Acme Corp: Software Engineer",
    "Company": "Acme Corp",
    "Role": "Software Engineer",
    "Location": "Wobo",
    "Job URL": "https://jobs.example.com/posting/123",
    "Date Added": "2026-07-07"
  }
}
```

| Property | From `SourcedJob` | Notes |
|---|---|---|
| `Name` | `{company}: {role}` | Title column |
| `Company` | `company` | |
| `Role` | `role` | |
| `Location` | `source` | Aggregator — not geographic |
| `Job URL` | `jobUrl` | Markdown stripped on read |
| `Date Added` | today UTC | Set at log time |

**Logging scope:** only scratch rows with `dateSourced` equal to **today (UTC)**. Older rows in
`data/sourced-jobs.md` are used during sourcing dedup (`loadScratchKeys` / `appendJobs`) and are
not re-checked or re-logged here. Override date for debugging: `NOTION_LOG_DATE=YYYY-MM-DD`.

Tracker matches among today's rows are skipped by `dedupeAgainstNotion`.

## Debug

`npm run log:notion` — payloads from scratch **without** Notion dedup. Format debugging only;
never use for normal skill runs.
