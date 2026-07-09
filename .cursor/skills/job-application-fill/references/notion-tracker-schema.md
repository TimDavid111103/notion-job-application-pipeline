# Notion Tracker Schema (Fill Skill)

Single source of truth for Application Tracker properties used by this skill.
Constants: `scripts/lib/notion.ts`.

## Database IDs

| Constant | Value |
|---|---|
| `NOTION_DATABASE_ID` | `32f1de14-69d8-803a-81ba-fb8cf47a1ccd` |
| `NOTION_DATA_SOURCE_ID` | `32f1de14-69d8-8016-9135-000ba274e2bd` |

## Properties relevant to filling

| Column | Type | Fill use |
|---|---|---|
| Name | title | `{Company}: {Role}` |
| Company | rich_text | Context for answer interpolation |
| Role | rich_text | Context for answer interpolation |
| Job URL | url | Application target |
| Job Match | select | **Must be set** (High, Medium, Low) |
| Status | select | Lifecycle — see below |
| Date Added | date | Human filter / sort |
| Location | select | Aggregator source |

### Status

- **Property name:** `Status` (`STATUS_PROPERTY`)
- **Options (live DB):** `Interview`, `Offer`, `Not Started`, `In Progress`, `Applied`, `Rejected`, `Invalid`
- **Terminal (excluded):** `Invalid`, `Rejected`, `Applied`
- **On open:** `In Progress`
- **On complete:** `Applied`

### Job Match

- **Eligible for fill:** property is **not empty** (High, Medium, or Low)

## Entry eligibility

Include a row in the fill queue only when **all**:

1. **Job Match** is set (filtered in step 4 query).
2. **Status** is not `Invalid`, `Rejected`, or `Applied`.
3. **Page body** has meaningful content — `isEmptyPageMarkdown()` returns **false**.
4. **Job URL** is non-empty.

MCP workflows: [notion-mcp-workflows.md](notion-mcp-workflows.md)
