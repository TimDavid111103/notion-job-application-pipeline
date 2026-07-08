# Scrape Data Formats

Single source of truth for runtime `data/` artifacts used by this skill.

Paths are defined in `scripts/lib/paths.ts`. Schemas and validators:
`scripts/lib/scrape-artifacts.ts`. Cleanup: `npm run cleanup:data` removes all temporary
artifacts listed below.

**All scratch files use the same versioned envelope** (`schema_version: 1`). Bare JSON arrays
are rejected. Builders: `buildJobsNeedingDescriptionsFile()`, `buildScrapeQueueFile()`,
`buildScrapeResultsFile()`.

## Runtime artifacts

| File | Written by | Read by | Lifetime |
|---|---|---|---|
| `data/jobs-needing-descriptions.json` | Agent (MCP query) | Agent (step 4) | One run |
| `data/notion-scrape-queue.json` | Agent (step 4) | `scrape:descriptions` | One run |
| `data/scrape-results.json` | `scrape:descriptions` | Agent (steps 7–8) | One run |

Permanent files (`data/sourced-jobs.md`) are **not** touched by this skill.

## Shared envelope fields

Every scratch file is a JSON **object** (never a bare array) with:

| Field | Type | Required |
|---|---|---|
| `schema_version` | `1` | Yes |
| `generated_at` | ISO-8601 string | Yes |

`npm run scrape:descriptions` validates the queue envelope on read and writes a validated
results envelope. `npm run test:scrape-artifacts` covers schema rules.

## Jobs needing descriptions (`data/jobs-needing-descriptions.json`)

Written by the agent after MCP `query_database`. Use `buildJobsNeedingDescriptionsFile(results)`.

```json
{
  "schema_version": 1,
  "generated_at": "2026-07-07T20:00:00.000Z",
  "database_id": "32f1de14-69d8-803a-81ba-fb8cf47a1ccd",
  "filter": {
    "property": "Job Match",
    "select": { "is_empty": true }
  },
  "row_count": 2,
  "results": []
}
```

| Field | Rule |
|---|---|
| `database_id` | Must match `NOTION_DATABASE_ID` in `scripts/lib/notion.ts` |
| `filter` | Exactly `{ property: "Job Match", select: { is_empty: true } }` |
| `row_count` | Must equal `results.length` |
| `results` | Raw MCP `query_database` row array — do not hand-edit |

MCP parsing: `parseTrackerRows()` in `scripts/lib/notion.ts`.

## Queue file (`data/notion-scrape-queue.json`)

Written by the agent in step 4. Use `buildScrapeQueueFile(items)`.

```json
{
  "schema_version": 1,
  "generated_at": "2026-07-07T20:00:00.000Z",
  "source_snapshot": "data/jobs-needing-descriptions.json",
  "item_count": 1,
  "items": [
    {
      "page_id": "abc123…",
      "company": "Acme Corp",
      "role": "Software Engineer",
      "jobUrl": "https://jobs.example.com/posting/123"
    }
  ]
}
```

| Field | Rule |
|---|---|
| `source_snapshot` | Always `"data/jobs-needing-descriptions.json"` |
| `item_count` | Must equal `items.length` |
| `items[].page_id` | Notion row `id` |
| `items[].company` | `Company` property |
| `items[].role` | `Role` property |
| `items[].jobUrl` | `Job URL` property (plain URL) |

## Results file (`data/scrape-results.json`)

Written by `npm run scrape:descriptions`. One row per queued URL, same order as the queue.

```json
{
  "schema_version": 1,
  "generated_at": "2026-07-07T20:05:00.000Z",
  "source_queue": "data/notion-scrape-queue.json",
  "summary": {
    "queued": 3,
    "ok": 2,
    "broken": 1,
    "deletable": 1
  },
  "items": [
    {
      "page_id": "abc123…",
      "company": "Acme Corp",
      "role": "Software Engineer",
      "jobUrl": "https://jobs.example.com/posting/123",
      "status": "ok",
      "markdown": "## Job Description\n\n### About the Role\n\n…",
      "error": null,
      "deletable": false
    }
  ]
}
```

| Field | Rule |
|---|---|
| `source_queue` | Always `"data/notion-scrape-queue.json"` |
| `summary` | Counts derived from `items` — must match exactly |
| `items[].status` | `"ok"` or `"broken"` |
| `items[].markdown` | Prepared append payload when `ok`; `null` when `broken` |
| `items[].error` | Broken reason when `broken`; `null` when `ok` |
| `items[].deletable` | `false` when `ok`; `true` when `broken` |

### Result row invariants

| `status` | `markdown` | `error` | `deletable` |
|---|---|---|---|
| `ok` | non-empty string starting with `## Job Description` | `null` | `false` |
| `broken` | `null` | one of the reason codes below | `true` |

Broken reason codes: `404`, `dns_failure`, `timeout`, `login_required`, `captcha`,
`empty_content`, `posting_closed`, `navigation_error`, `missing_url`.

### Markdown shape (`status: "ok"`)

Produced by `formatJobDescriptionMarkdown()` in `scripts/lib/scrape-markdown.ts`.
Formatting is best-effort — if heuristics fail or the page layout is unexpected, the
script falls back to a plain text block (`formatJobDescriptionPlain`) rather than erroring.

- Top-level `## Job Description` heading
- Metadata labels (`Location`, `Employment Type`, …) as `**Label:** value`
- Section titles (`About the Role`, `What You'll Do`, …) as `###` headings
- List items as `-` bullets when the DOM or inline text supports it
- ATS footer chrome stripped (`Apply for this Job`, `Powered by Ashby`, …)

## Empty page detection

`isEmptyPageMarkdown(md)` in `scripts/lib/notion.ts`:

- Whitespace-only → empty
- Content under 20 characters after stripping lone headings → empty

Used in step 4 before adding a row to the queue.
