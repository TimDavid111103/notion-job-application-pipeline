# Environment Variables

Run all commands from **repo root**. Override per run:
`HEADED=1 SCRAPE_LIMIT=5 npm run scrape:descriptions`.

| Var | Default | Effect | Used by |
|---|---|---|---|
| `HEADED` | unset (headless) | `1` = visible browser; **required retry** when headless fails | `scrape-descriptions.ts` via `browser.ts` |
| `SCRAPE_LIMIT` | unlimited | Max URLs processed per run | `job-description.ts` `getScrapeLimit()` |
| `SCRAPE_TIMEOUT_MS` | 30000 | Per-URL navigation timeout (ms) | `job-description.ts` |
| `SCRAPE_DELAY_MS` | 1000 | Pause between URLs (ms) | `scrape-descriptions.ts` |

No Notion API tokens in env — MCP handles Notion auth.

Artifact paths (override not typical):

| Constant | Path |
|---|---|
| `SCRAPE_QUEUE_FILE` | `data/scrape/notion-scrape-queue.json` |
| `SCRAPE_RESULTS_FILE` | `data/scrape/scrape-results.json` |
| `JOBS_NEEDING_DESCRIPTIONS_FILE` | `data/scrape/jobs-needing-descriptions.json` |

Defined in `scripts/lib/paths.ts`.
