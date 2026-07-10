# Notion Tracker Schema

Canonical IDs and shared tracker documentation: [docs/shared/notion-tracker.md](../../../../docs/shared/notion-tracker.md). Code constants live in `scripts/lib/notion/`.

Single source of truth for Application Tracker properties used by this skill.
Constants: `scripts/lib/notion/`.

## Database IDs

| Constant | Value |
|---|---|
| `NOTION_DATABASE_ID` | `32f1de14-69d8-803a-81ba-fb8cf47a1ccd` |
| `NOTION_DATA_SOURCE_ID` | `32f1de14-69d8-8016-9135-000ba274e2bd` |

## Properties relevant to scraping

| Column | Type | Scraper use |
|---|---|---|
| Name | title | `{Company}: {Role}` — display only |
| Company | rich_text | Queue metadata |
| Role | rich_text | Queue metadata |
| Job URL | url | Scrape target |
| Job Match | select | **Empty** = eligible for scraping |
| Location | select | Aggregator source — not geographic |
| Date Added | date | Informational |

### Job Match

- **Property name:** `Job Match` (`JOB_MATCH_PROPERTY` in `notion.ts`)
- **Type:** `select`
- **Options:** `High`, `Medium`, `Low`
- **Eligible for scraping:** property is **empty** (no option selected)

Query filter: `{ "property": "Job Match", "select": { "is_empty": true } }`

## Entry eligibility

Include a row in the scrape queue only when **both**:

1. **Job Match** is empty (filtered in step 3 query).
2. **Page body** has no meaningful content — `isEmptyPageMarkdown()` returns true on
   `read_page` markdown output.

After a successful append, the page body is non-empty so the row is skipped on future runs
even though Job Match may still be empty.

## Page content

Job descriptions are appended to the **page body** (not a database property) via MCP
`append_content`. Format:

```markdown
## Job Description

{extracted posting text}
```

MCP workflows: [notion/mcp-workflows.md](mcp-workflows.md)
