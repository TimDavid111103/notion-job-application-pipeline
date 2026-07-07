# Script Map

Repo layout for the job-aggregators pipeline. Commands: [commands.md](commands.md).

## Orchestration (`scripts/pipeline/`)

| Path | Responsibility |
|---|---|
| `scripts/pipeline/source-all.ts` | Spawn aggregators, timeouts, `RUN_ID`, `ensureScratchFile` |
| `scripts/pipeline/log-to-notion-deduped.ts` | scratch + snapshot → `data/notion-payloads.json` (**use this**) |
| `scripts/pipeline/log-to-notion.ts` | scratch → payloads, no dedup (debug) |
| `scripts/setup.sh` | `npm install`, Playwright browser, `.auth/`, `data/` |

## Aggregator runners (`scripts/sources/`)

| Path | Aggregator |
|---|---|
| `wobo.ts` | Wobo dashboard swipe feed |
| `handshake.ts` | Handshake job search |
| `jackjill.ts` | Jack inbox fill + review |
| `jack-empty.ts` | Jack inbox + Saved kanban clean-out |

## Tests (`scripts/test/`)

| Path | Responsibility |
|---|---|
| `scripts/test/access.ts` | Session smoke test |
| `scripts/test/notion-dedup.ts` | Dedup helper unit checks |

## Auth (`scripts/auth/`)

| Path | Responsibility |
|---|---|
| `scripts/auth/login-*.ts` | Headed one-time logins |

## Shared libraries (`scripts/lib/`)

| Path | Responsibility |
|---|---|
| `paths.ts` | `data/` artifact paths |
| `browser.ts` | Playwright launch, `.auth/` session I/O |
| `job.ts` | `SourcedJob` type, `jobKey`, `normalizeJobUrl` |
| `limits.ts` | `getJobLimit`, `DEFAULT_LIMITS` |
| `screening.ts` | Advisory `screeningSignals` regex flags |
| `scratch.ts` | `data/sourced-jobs.md` read/write, prepend-newest, dedup at write |
| `notion.ts` | Notion payload builder, tracker dedup |
| `wobo.ts` | Wobo feed automation |
| `handshake.ts` | Handshake search automation |
| `jack/auth.ts` | Jack session + URL constants |
| `jack/inbox.ts` | Jack inbox fill + review |
| `jack/kanban.ts` | Jack Saved column empty |
| `jackjill.ts` | Re-exports `jack/*` (stable import path) |

## Runtime data (`data/`, gitignored)

| Path | Written by |
|---|---|
| `data/sourced-jobs.md` | aggregator `appendJobs` |
| `data/notion-tracker-snapshot.json` | agent `query_database` MCP call |
| `data/notion-payloads.json` | `log:notion:deduped` |

Data shapes: [data-contracts.md](data-contracts.md). Selectors: [access.md](access.md) + [jack-kanban.md](jack-kanban.md).
