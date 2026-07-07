# Repository Scripts Map

Repo layout for the job-aggregators pipeline. Commands: [pipeline-commands.md](pipeline-commands.md).
Data shapes and `data/` artifacts: [scratch-data-formats.md](scratch-data-formats.md).

## Orchestration (`scripts/pipeline/`)

| Path | Responsibility |
|---|---|
| `source-all.ts` | Spawn aggregators, timeouts, `RUN_ID`, `ensureScratchFile` |
| `cleanup-data.ts` | Delete temp `data/` artifacts (`npm run cleanup:data`) |
| `log-to-notion-deduped.ts` | scratch + snapshot → payloads (**use this**) |
| `log-to-notion.ts` | scratch → payloads, no dedup (debug) |
| `run-log-basename.ts` | Print newest-first run log filename |

## Aggregator runners (`scripts/sources/`)

| Path | Aggregator |
|---|---|
| `wobo.ts` | Wobo dashboard swipe feed |
| `handshake.ts` | Handshake job search |
| `jackjill.ts` | Jack inbox fill + review |
| `jack-empty.ts` | Jack inbox + Saved clean-out |

## Tests (`scripts/test/`)

| Path | Responsibility |
|---|---|
| `access.ts` | Session smoke test |
| `notion-dedup.ts` | Dedup helper unit checks |

## Auth (`scripts/auth/`)

| Path | Responsibility |
|---|---|
| `login-*.ts` | Headed one-time logins → `.auth/*.json` |

## Shared libraries (`scripts/lib/`)

| Path | Responsibility |
|---|---|
| `paths.ts` | `data/` paths, `RUN_LOGS_DIR` |
| `cleanup.ts` | Temp artifact deletion rules |
| `run-log.ts` | Run log filename helpers |
| `browser.ts` | Playwright launch, session I/O |
| `job.ts` | `SourcedJob`, `jobKey`, URL normalization |
| `limits.ts` | `getJobLimit`, `DEFAULT_LIMITS` |
| `screening.ts` | Advisory `screeningSignals` flags |
| `scratch.ts` | Scratch file I/O, retention, dedup keys |
| `notion.ts` | Payload builder, tracker dedup |
| `wobo.ts` | Wobo feed automation |
| `handshake.ts` | Handshake search automation |
| `jack/auth.ts` | Jack session + URL constants |
| `jack/inbox.ts` | Jack inbox fill + review |
| `jack/kanban.ts` | Jack Saved column empty |
| `jackjill.ts` | Re-exports `jack/*` |

## Setup

`scripts/setup.sh` — deps, Playwright, `.auth/`, `data/`. Skill wrapper:
`.cursor/skills/job-aggregators/scripts/setup.sh`.

Selectors: [auth-and-selectors.md](auth-and-selectors.md), [jack-kanban-cleanup.md](jack-kanban-cleanup.md).
