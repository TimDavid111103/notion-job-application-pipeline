# Notion MCP Workflows

Shared tracker documentation: [docs/shared/notion-tracker.md](../../../../docs/shared/notion-tracker.md).

Single source of truth for MCP steps in this skill. Schema:
[notion/tracker-schema.md](tracker-schema.md). Artifact paths:
[contracts/data-formats.md](../contracts/data-formats.md).

Use `user-notion` MCP. Read tool schemas before each call.

## Step 3 — Query unmatched rows

1. Optionally call `get_database` to confirm property names.
2. `query_database` with Job Match empty filter.
3. Pipe MCP `query_database` JSON to the envelope writer:

```bash
npm run write:jobs-needing-descriptions -- /path/to/mcp-response.json
# or: echo '{\"results\":[...]}' | npm run write:jobs-needing-descriptions
```

`write-scrape-queue` requires this snapshot on disk before step 4.

```json
{
  "schema_version": 1,
  "generated_at": "2026-07-07T20:00:00.000Z",
  "database_id": "32f1de14-69d8-803a-81ba-fb8cf47a1ccd",
  "filter": {
    "property": "Job Match",
    "select": { "is_empty": true }
  },
  "row_count": 0,
  "results": []
}
```

**Omit `filter: {}`** — MCP rejects an empty filter object.

Parse rows with `parseTrackerRows()` in `scripts/lib/notion/` (handles flat MCP and
nested `properties.*` shapes).

## Step 4 — Build scrape queue

For each result row:

1. `read_page` with `page_id` from the row (`id` field) and `max_blocks: 5`.
2. If `isEmptyPageMarkdown(markdown)` is true **and** `Job URL` is non-empty, add to queue.

Write `data/scrape/notion-scrape-queue.json` with `buildScrapeQueueFile(items)` — envelope with
`items` array:

```json
{
  "schema_version": 1,
  "generated_at": "2026-07-07T20:00:00.000Z",
  "source_snapshot": "data/scrape/jobs-needing-descriptions.json",
  "item_count": 1,
  "items": [
    {
      "page_id": "…",
      "company": "Acme",
      "role": "Software Engineer",
      "jobUrl": "https://…"
    }
  ]
}
```

Skip rows with missing `page_id` or empty Job URL.

## Step 7 — Append descriptions

Read `data/scrape/scrape-results.json`. For each element in `items` with `"status": "ok"`:

```json
{
  "page_id": "…",
  "markdown": "## Job Description\n\n…"
}
```

Call `append_content` per row. Batch manually if needed; there is no batch append tool.
Skip rows that still need a headed retry (captcha / interstitial) — see
[protocol/agent-runtime.md](../protocol/agent-runtime.md).

## Step 8 — Delete dead URLs

Read `data/scrape/scrape-results.json`. For each element in `items` with `"status": "broken"`
**and** `"deletable": true`:

```json
{ "page_id": "…" }
```

Call `delete_database_entry`. Use `dry_run: true` during development.

**Only delete `deletable: true` rows.** Policy (deletable vs preserve):
[docs/shared/url-health-policy.md](../../../../docs/shared/url-health-policy.md).
Implementation: `isDeletableFailure()` in `scripts/lib/url-health.ts`.
Re-run after refreshing the relevant session when failures are non-deletable
(e.g. `npm run auth:handshake`).

## Tool reference

| Action | MCP tool |
|---|---|
| Schema inspect | `get_database` |
| Query rows | `query_database` |
| Check page body | `read_page` |
| Append description | `append_content` |
| Remove dead entry | `delete_database_entry` |
