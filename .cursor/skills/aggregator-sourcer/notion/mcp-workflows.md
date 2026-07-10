# Notion MCP Workflows (Sourcing Skill)

Schema and eligibility: [tracker-schema.md](tracker-schema.md). Scratch and payload contracts: [../contracts/data-formats.md](../contracts/data-formats.md). Canonical tracker documentation: [docs/shared/notion-tracker.md](../../../../docs/shared/notion-tracker.md).

Use `user-notion` MCP. Read the relevant tool schema before each call.

## Step 6 — Tracker snapshot

1. Read the `query_database` tool schema.
2. Query database `32f1de14-69d8-803a-81ba-fb8cf47a1ccd` with **no `filter` property**. Do not pass `filter: {}`; MCP rejects an empty filter.
3. Save the complete response to `data/source/notion-tracker-snapshot.json`.

```json
{ "database_id": "32f1de14-69d8-803a-81ba-fb8cf47a1ccd" }
```

The query may return flat strings (`Company`, `Role`, `Job URL`) or nested `properties.*`; `parseNotionQueryResults` in `scripts/lib/notion/` handles both. Query full tracker history because postings can resurface after the scratch retention window.

## Step 7 — Dedup and prepare payloads

Run `npm run log:notion:deduped`. It compares today's scratch rows against the snapshot and writes `data/source/notion-payloads.json`.

Drop a job when either:

1. normalized Job URL matches an existing entry, or
2. Company + Role matches case-insensitively.

URL normalization in `scripts/lib/job/` unwraps markdown links, strips query/hash, lowercases the host, trims trailing slashes, and rewrites Handshake `/job-search/{id}` to `/jobs/{id}`. Implementations are `dedupeAgainstNotion`, `parseNotionQueryResults`, and `prepareNotionPayloads` in `scripts/lib/notion/`.

Each payload element has this shape:

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

`Name` is `{company}: {role}`; `Location` comes from `source`, not geographic location; `Date Added` is set at log time. Regenerate this runtime artifact after scratch or snapshot changes instead of hand-editing it.

## Step 8 — MCP insert

Read `data/source/notion-payloads.json`, then call `add_database_entries` in batches of about 16 or `add_database_entry` per row. Typical tool sequence: `get_database` → `query_database` → `add_database_entry(s)`.

## Steps 5–9 summary

`cleanup:data` → snapshot → `log:notion:deduped` → MCP insert → `cleanup:data` again. Cleanup policy: [docs/shared/data-cleanup.md](../../../../docs/shared/data-cleanup.md).
