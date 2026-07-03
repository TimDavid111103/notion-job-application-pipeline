# Notion Application Tracker Schema

**Database ID (MCP-accessible):** `32f1de14-69d8-803a-81ba-fb8cf47a1ccd`  
**Data source ID (user-specified):** `32f1de14-69d8-8016-9135-000ba274e2bd` — share with integration when ready

Use `user-notion` MCP: `get_database` → `query_database` → `add_database_entry`.

## Properties used by job-aggregators

| Column | Type | Value |
|---|---|---|
| Name | title | `{Company}: {Role}` |
| Company | rich_text | Company name |
| Role | rich_text | Job title |
| Location | select | `Wobo`, `Handshake`, or `Jack & Jill` |
| Job URL | url | Direct posting link |
| Date Added | date | Today (ISO) |

> **Location = Source:** the tracker's **Location** select stores the aggregator source
> (`Wobo`, `Handshake`, `Jack & Jill`), not geographic location. `toNotionProperties` in repo
> `scripts/lib/notion.ts` maps `job.source` → `Location`. Do not "fix" this silently.

## Dedup query

Query the **full tracker history** (not just the last 7 days — postings resurface in
aggregators after a week and would otherwise be re-added). Drop a sourced job if **either**:

1. Its **normalized Job URL** matches an existing entry, or
2. Its **Company + Role** (case-insensitive) matches an existing entry.

**Normalize URLs before comparing** (see `normalizeJobUrl` in repo `scripts/lib/notion.ts`):
- strip the query string (`?utm_source=jackandjill`, tracking params) and hash
- lowercase host, trim trailing slash
- rewrite Handshake `/job-search/{id}` → `/jobs/{id}` (same posting, two paths)

Without normalization, real duplicates slip through — the tracker already contains, e.g.,
MeritFirst under both `/job-search/11147594` and `/jobs/11147594`.

```json
{ "database_id": "32f1de14-69d8-803a-81ba-fb8cf47a1ccd" }
```

Implementation: `dedupeAgainstNotion`, `NOTION_DEDUP_FILTER = {}` in repo `scripts/lib/notion.ts`.
See [pipeline-scripts.md](pipeline-scripts.md) for payload shape.
