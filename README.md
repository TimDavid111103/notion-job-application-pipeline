# Notion Job Application Pipeline

Playwright workspace for sourcing, enriching, and filling jobs in the Notion Application Tracker.

## Skills

| Skill | Runbook |
|-------|---------|
| Aggregator sourcer | [`.cursor/skills/aggregator-sourcer/SKILL.md`](.cursor/skills/aggregator-sourcer/SKILL.md) |
| Description scraper | [`.cursor/skills/description-scraper/SKILL.md`](.cursor/skills/description-scraper/SKILL.md) |
| Application filler | [`.cursor/skills/application-filler/SKILL.md`](.cursor/skills/application-filler/SKILL.md) |

Shared policy: [`docs/shared/`](docs/shared/).

## Setup

```bash
bash scripts/setup.sh
```

## Auth (one-time, headed)

```bash
npm run auth:wobo
npm run auth:handshake
npm run auth:jackjill
npm run test:access
```

## Source and log

```bash
npm run source:all
npm run cleanup:data          # before logging — wipe temp data/ (keep sourced-jobs.md)
npm run log:notion:deduped
# then user-notion MCP add_database_entry per data/source/notion-payloads.json
npm run cleanup:data          # after logging
```

## Layout

```
.cursor/skills/<skill>/     # SKILL.md + indexes/protocol/notion/contracts/domain/(assets)/logs
docs/shared/                # Cross-skill policy (URL health, Notion overview, cleanup)
data/
  sourced-jobs.md           # Permanent scratch
  source/ scrape/ fill/     # Temporary lane artifacts (gitignored)
scripts/
  auth/                     # Headed login → .auth/*.json
  source/                   # Aggregator runners + Notion payload prep
  scrape/                   # Description scrape CLIs
  fill/                     # URL health + application fill
  shared/                   # cleanup-data, run-log-basename
  test/source/              # Session preflight (test:access)
  lib/                      # browser, job, notion, artifacts, aggregators, scrape, fill
  setup.sh
.auth/                      # Saved sessions (gitignored)
```
