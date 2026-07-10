# Notion Application Tracker

Canonical IDs and property names live in code: `scripts/lib/notion/`.

| Constant | Value / notes |
|----------|----------------|
| Database ID | `NOTION_DATABASE_ID` in `scripts/lib/notion/constants.ts` |
| Data source ID | `NOTION_DATA_SOURCE_ID` |
| Job Match | Select — empty means unmatched (scrape-eligible) |
| Status | Lifecycle select — see constants for terminal / in-progress values |
| Location | Aggregator source name (not geography) |

Skill-local eligibility and MCP step details stay under each skill’s `notion/` folder.
