# Repository Scripts Map (Fill Skill)

## Pipeline (`scripts/pipeline/`)

| Script | npm command |
|--------|-------------|
| `write-jobs-ready-to-apply.ts` | `write:jobs-ready-to-apply` |
| `write-fill-queue.ts` | `write:fill-queue` |
| `check-url-health.ts` | `check:url-health` |
| `fill-application.ts` | `fill:application` |
| `run-log-basename-fill.ts` | `run-log:basename:fill` |
| `cleanup-data.ts` | `cleanup:data` |

## Lib (`scripts/lib/`)

| Module | Role |
|--------|------|
| `fill-artifacts.ts` | JSON envelope builders/parsers |
| `fill-references.ts` | Markdown reference parsing + lookup |
| `application-fill.ts` | Headed Playwright form fill |
| `url-health.ts` | Shared URL health (also used by scraper) |
| `notion.ts` | Status constants, eligible filter, row parsing |
| `browser.ts` | Playwright launch/context |
| `paths.ts` | File path constants |
| `cleanup.ts` | Temp artifact removal |

## Test (`scripts/test/`)

| Script | npm command |
|--------|-------------|
| `fill-references.ts` | `test:fill-references` |
| `url-health.ts` | `test:url-health` |
