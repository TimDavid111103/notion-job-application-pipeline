# Fill Data Formats

Cleanup policy: [docs/shared/data-cleanup.md](../../../../docs/shared/data-cleanup.md).

Versioned JSON envelopes under `data/fill/`. Schema version: `1`. Builders: `scripts/lib/artifacts/fill-artifacts.ts`.

## Permanent vs temporary

| File | Lifecycle |
|------|-----------|
| `.cursor/skills/application-filler/assets/personal-information.md` | Permanent (skill folder) |
| `.cursor/skills/application-filler/assets/projects.md` | Permanent |
| `.cursor/skills/application-filler/assets/answers.md` | Permanent |
| `jobs-ready-to-apply.json` | Temporary — step 4 |
| `notion-fill-queue.json` | Temporary — step 5 |
| `fill-session.json` | Temporary — step 6 |
| `url-health-results.json` | Temporary — step 7 |
| `fill-results.json` | Temporary — step 9 |

Removed by `npm run cleanup:data`.

## jobs-ready-to-apply.json

```json
{
  "schema_version": 1,
  "generated_at": "2026-07-09T15:00:00.000Z",
  "database_id": "32f1de14-69d8-803a-81ba-fb8cf47a1ccd",
  "filter": { "and": [ "…" ] },
  "row_count": 0,
  "results": []
}
```

## notion-fill-queue.json

```json
{
  "schema_version": 1,
  "generated_at": "2026-07-09T15:00:00.000Z",
  "source_snapshot": "data/fill/jobs-ready-to-apply.json",
  "item_count": 1,
  "items": [
    {
      "page_id": "…",
      "company": "Acme",
      "role": "Software Engineer",
      "jobUrl": "https://…",
      "jobMatch": "High",
      "dateAdded": "2026-07-08",
      "status": "Not Started"
    }
  ]
}
```

## fill-session.json

Written after AskQuestion step 6:

```json
{
  "schema_version": 1,
  "generated_at": "2026-07-09T15:00:00.000Z",
  "filters": {
    "tierFilter": "High only",
    "dateFilter": "Last 7 days",
    "statusFilter": "New only",
    "sort": "Job Match tier → Date Added",
    "batchScope": "Next 1"
  },
  "page_ids": ["page-id-1"]
}
```

## url-health-results.json

Same summary shape as scrape results: `{ queued, ok, broken, deletable }`.

## fill-results.json

```json
{
  "schema_version": 1,
  "generated_at": "2026-07-09T15:00:00.000Z",
  "source_session": "data/fill/fill-session.json",
  "summary": {
    "processed": 1,
    "filled": 0,
    "partial": 1,
    "blocked": 0,
    "broken": 0
  },
  "items": [
    {
      "page_id": "…",
      "company": "Acme",
      "role": "Software Engineer",
      "jobUrl": "https://…",
      "status": "partial",
      "filledFields": ["Email", "Phone"],
      "unfilledFields": [
        {
          "label": "Why Acme?",
          "suggestedAnswer": "…",
          "reason": "no_match",
          "source": "answers.md"
        }
      ],
      "error": null,
      "deletable": false
    }
  ]
}
```
