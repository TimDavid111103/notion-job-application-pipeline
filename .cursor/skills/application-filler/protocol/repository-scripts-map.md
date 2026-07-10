# Repository Scripts Map (Fill Skill)

Commands: [pipeline-commands.md](pipeline-commands.md).

## Fill entry points (`scripts/fill/`)

| Script | npm command |
|---|---|
| `write-jobs-ready-to-apply.ts` | `write:jobs-ready-to-apply` |
| `write-fill-queue.ts` | `write:fill-queue` |
| `check-url-health.ts` | `check:url-health` |
| `fill-application.ts` | `fill:application` |

## Shared entry points (`scripts/shared/`)

| Script | npm command |
|---|---|
| `cleanup-data.ts` | `cleanup:data` |
| `run-log-basename.ts` | `run-log:basename:fill` |

## Libraries (`scripts/lib/`)

| Path | Role |
|---|---|
| `artifacts/fill-artifacts.ts` | Fill JSON envelope builders and parsers |
| `fill/fill-references.ts` | Markdown asset parsing and lookup |
| `fill/application-fill.ts` | Headed Playwright form fill |
| `browser/` | Playwright launch, context, and environment bootstrap |
| `job/` | Job types and URL normalization |
| `notion/` | Tracker constants, parsing, and update payloads |
| `url-health.ts` | Shared URL health classifier |
| `paths.ts` | `data/fill/` path constants |
