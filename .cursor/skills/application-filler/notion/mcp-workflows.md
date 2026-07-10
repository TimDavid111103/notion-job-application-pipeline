# Notion MCP Workflows (Fill Skill)

Shared tracker documentation: [docs/shared/notion-tracker.md](../../../../docs/shared/notion-tracker.md).

Single source of truth for MCP steps. Schema: [notion/tracker-schema.md](tracker-schema.md).
Artifacts: [contracts/data-formats.md](../contracts/data-formats.md).

Use `user-notion` MCP. Read tool schemas before each call.

## Step 0 — Schema preflight

`get_database` with database ID `32f1de14-69d8-803a-81ba-fb8cf47a1ccd`. Confirm **Status** option spellings match `scripts/lib/notion/`.

## Step 4 — Query eligible rows

`query_database`:

```json
{
  "database_id": "32f1de14-69d8-803a-81ba-fb8cf47a1ccd",
  "filter": {
    "and": [
      { "property": "Job Match", "select": { "is_not_empty": true } },
      {
        "or": [
          { "property": "Status", "select": { "is_empty": true } },
          { "property": "Status", "select": { "equals": "Not Started" } },
          { "property": "Status", "select": { "equals": "In Progress" } }
        ]
      }
    ]
  }
}
```

**Omit `filter: {}`** — MCP rejects empty filter.

Pipe results:

```bash
npm run write:jobs-ready-to-apply -- /path/to/mcp-response.json
```

Post-parse: `filterEligibleTrackerRows()` drops any row with terminal Status.

## Step 5 — Build fill queue

For each result row:

1. `read_page` with `page_id` and `max_blocks: 5`.
2. If `!isEmptyPageMarkdown(markdown)` and Job URL present, add to queue.

```bash
npm run write:fill-queue -- /path/to/queue-items.json
```

## Step 8 — Delete dead URLs

Read `data/fill/url-health-results.json`. For each item with `status: "broken"` and `deletable: true`:

```json
{ "page_id": "…", "dry_run": false }
```

Use `dry_run: true` during development.

## Step 10 — Status updates

When opening a job for fill:

```json
{
  "page_id": "…",
  "properties": { "Status": "In Progress" }
}
```

When user confirms submission:

```json
{
  "page_id": "…",
  "properties": { "Status": "Applied" }
}
```

Helper: `statusUpdatePayload(status)` in `scripts/lib/notion/`.

Parse rows with `parseTrackerRows()`.
