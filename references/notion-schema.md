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

## Dedup query

Query entries from last 7 days. Match on Job URL first; fall back to Company + Role.

```json
{
  "filter": {
    "timestamp": "past_week",
    "property": "Date Added"
  }
}
```
