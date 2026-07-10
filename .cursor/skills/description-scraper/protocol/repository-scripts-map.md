# Repository Scripts Map (Description Scraper)

Commands: [pipeline-commands.md](pipeline-commands.md).

## Scrape entry points (`scripts/scrape/`)

| Script | npm command |
|---|---|
| `write-jobs-needing-descriptions.ts` | `write:jobs-needing-descriptions` |
| `write-scrape-queue.ts` | `write:scrape-queue` |
| `scrape-descriptions.ts` | `scrape:descriptions` |

## Shared entry points (`scripts/shared/`)

| Script | npm command |
|---|---|
| `cleanup-data.ts` | `cleanup:data` |
| `run-log-basename.ts` | `run-log:basename:scraper` |

## Libraries (`scripts/lib/`)

| Path | Role |
|---|---|
| `scrape/job-description.ts` | URL scraping, extraction, failure classification |
| `scrape/workday.ts` | Workday CXS integration |
| `scrape/language.ts` | Description language classification |
| `scrape/scrape-markdown.ts` | Description markdown formatting |
| `artifacts/scrape-artifacts.ts` | Scrape envelope schemas and validators |
| `browser/` | Shared Playwright launch and Handshake session routing |
| `job/` | Job URL normalization |
| `notion/` | Tracker constants and row parsing |
| `paths.ts` | `data/scrape/` path constants |
