# Script Map

Repo layout for the job-aggregators pipeline. Commands: [commands.md](commands.md).

## Orchestration

| Path | Responsibility |
|---|---|
| `scripts/source-all.ts` | Spawn aggregators, timeouts, `RUN_ID`, `ensureScratchFile` |
| `scripts/setup.sh` | `npm install`, Playwright browser, `.auth/` |

## Aggregator runners (`scripts/sources/`)

| Path | Aggregator |
|---|---|
| `wobo.ts` | Wobo dashboard swipe feed |
| `handshake.ts` | Handshake job search |
| `jackjill.ts` | Jack inbox fill + review |
| `jack-empty.ts` | Jack inbox + Saved kanban clean-out |

## Notion prep

| Path | Responsibility |
|---|---|
| `scripts/log-to-notion-deduped.ts` | scratch + snapshot → `notion-payloads.json` (**use this**) |
| `scripts/log-to-notion.ts` | scratch → payloads, no dedup (debug) |
| `scripts/test-notion-dedup.ts` | unit tests |

## Auth and access

| Path | Responsibility |
|---|---|
| `scripts/auth/login-*.ts` | Headed one-time logins |
| `scripts/test-access.ts` | Session smoke test |

## Shared libraries (`scripts/lib/`)

| Path | Responsibility |
|---|---|
| `browser.ts` | Playwright launch, `.auth/` session I/O |
| `job.ts` | `SourcedJob` type, `jobKey`, `normalizeJobUrl` |
| `limits.ts` | `getJobLimit`, `DEFAULT_LIMITS` |
| `screening.ts` | Advisory `screeningSignals` regex flags |
| `scratch.ts` | `sourced-jobs.md` read/write, prepend-newest, dedup at write |
| `notion.ts` | Notion payload builder, tracker dedup |
| `wobo.ts` | Wobo feed automation |
| `handshake.ts` | Handshake search automation |
| `jack/auth.ts` | Jack session + URL constants |
| `jack/inbox.ts` | Jack inbox fill + review |
| `jack/kanban.ts` | Jack Saved column empty |
| `jackjill.ts` | Re-exports `jack/*` (stable import path) |

## Debug

| Path | Responsibility |
|---|---|
| `scripts/debug-wobo.ts` | Headed Wobo feed investigation |

Data shapes: [data-contracts.md](data-contracts.md). Selectors: [access.md](access.md) + [jack-kanban.md](jack-kanban.md).
