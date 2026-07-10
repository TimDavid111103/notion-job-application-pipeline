# Repository Scripts Map (Sourcing Skill)

Commands: [pipeline-commands.md](pipeline-commands.md). Data contract: [../contracts/data-formats.md](../contracts/data-formats.md).

## Source entry points (`scripts/source/`)

| Path | Responsibility |
|---|---|
| `source-all.ts` | Sequential/parallel orchestration, timeouts, `RUN_ID`, scratch ensure |
| `wobo.ts` | Wobo runner |
| `handshake.ts` | Handshake runner |
| `jackjill.ts` | Jack inbox fill and review |
| `jack-empty.ts` | Jack inbox and Saved cleanup |
| `log-to-notion-deduped.ts` | Scratch + tracker snapshot → payloads |

## Auth and shared entry points

- `scripts/auth/login-*.ts` — headed logins to `.auth/*.json`.
- `scripts/shared/cleanup-data.ts` — cleanup command; policy: [docs/shared/data-cleanup.md](../../../../docs/shared/data-cleanup.md).
- `scripts/shared/run-log-basename.ts` — run-log path command.

## Libraries (`scripts/lib/`)

| Path | Responsibility |
|---|---|
| `aggregators/wobo.ts` | Wobo feed automation |
| `aggregators/handshake.ts` | Handshake search automation |
| `aggregators/jack/{auth,inbox,kanban}.ts` | Jack session, inbox, and Saved behavior |
| `aggregators/jackjill.ts` | Jack exports |
| `browser/` | Playwright launch, session I/O, runtime environment |
| `job/` | `SourcedJob`, limits, screening, scratch retention/dedup |
| `notion/` | Tracker parsing, payloads, and dedup |
| `artifacts/` | Versioned artifact helpers |
| `paths.ts` | `data/source/` and run-log paths |

## Session preflight

`scripts/test/source/access.ts` (`npm run test:access`) verifies aggregator sessions.
