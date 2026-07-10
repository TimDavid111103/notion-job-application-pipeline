# Notion Tracker Schema (Sourcing Skill)

Canonical tracker IDs and shared schema documentation: [docs/shared/notion-tracker.md](../../../../docs/shared/notion-tracker.md). Code constants and payload helpers live in `scripts/lib/notion/`.

## Tracker IDs

- **Database ID (MCP):** `32f1de14-69d8-803a-81ba-fb8cf47a1ccd`
- **Data source ID:** `32f1de14-69d8-8016-9135-000ba274e2bd` — share with the integration when ready.

## Properties used for logging

| Column | Type | Value |
|---|---|---|
| Name | title | `{Company}: {Role}` |
| Company | rich_text | Company name |
| Role | rich_text | Job title |
| Location | select | `Wobo`, `Handshake`, or `Jack & Jill` |
| Job URL | url | Direct posting link (plain URL) |
| Date Added | date | Today (UTC ISO) |

> **Location = Source:** tracker **Location** stores the aggregator name, not geographic location. `toNotionProperties` in `scripts/lib/notion/` maps `job.source` to `Location`. Do not silently map geographic location into this field.

## Logging eligibility

Only scratch rows whose `dateSourced` equals today in UTC are logged. Older rows in `data/sourced-jobs.md` remain sourcing-dedup input and are not rechecked or relogged. `NOTION_LOG_DATE=YYYY-MM-DD` overrides the date for debugging.

Before insert, dedupe today's rows against the full tracker history. Drop a job when either its normalized Job URL or case-insensitive Company + Role matches.

Workflow details: [mcp-workflows.md](mcp-workflows.md). Data contract: [../contracts/data-formats.md](../contracts/data-formats.md).
