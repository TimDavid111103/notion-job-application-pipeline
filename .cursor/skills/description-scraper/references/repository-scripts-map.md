# Repository Scripts Map

Repo `scripts/` layout for this skill. Skill-local wrappers live under
`.cursor/skills/description-scraper/scripts/`.

## Pipeline (`scripts/pipeline/`)

| File | npm script | Role |
|---|---|---|
| `scrape-descriptions.ts` | `scrape:descriptions` | Read queue, scrape URLs, write results |
| `run-log-basename-scraper.ts` | `run-log:basename:scraper` | Print run log path for this skill |
| `cleanup-data.ts` | `cleanup:data` | Remove temp `data/` artifacts (shared) |

## Libraries (`scripts/lib/`)

| File | Role |
|---|---|
| `notion.ts` | DB IDs, `JOB_MATCH_PROPERTY`, `parseTrackerRows`, `isEmptyPageMarkdown` |
| `job-description.ts` | URL scrape, extraction heuristics, failure classification |
| `browser.ts` | Shared Playwright launch/context/close (no aggregator auth) |
| `job.ts` | `cleanJobUrl`, URL normalization |
| `paths.ts` | `JOBS_NEEDING_DESCRIPTIONS_FILE`, `SCRAPE_QUEUE_FILE`, `SCRAPE_RESULTS_FILE`, `SCRAPER_RUN_LOGS_DIR` |
| `cleanup.ts` | Temp artifact basenames |
| `run-log.ts` | Run log filename helpers |

## Tests (`scripts/test/`)

| File | npm script | Role |
|---|---|---|
| `job-description.ts` | `test:job-description` | Scraper + notion parser unit checks |
| `notion-dedup.ts` | `test:notion-dedup` | Shared notion dedup parsers |

## Setup (`scripts/`)

| File | Role |
|---|---|
| `setup.sh` | `npm install`, Playwright Chromium, `data/` + `.auth/` dirs |
