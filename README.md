# Notion Job Application Pipeline

Playwright workspace for sourcing jobs from Wobo, Handshake, and Jack & Jill into the Notion Application Tracker.

**Skill:** attach or invoke [`.cursor/skills/job-aggregators/SKILL.md`](.cursor/skills/job-aggregators/SKILL.md) for the full runbook.

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
npm run log:notion:deduped
# then user-notion MCP add_database_entry per data/notion-payloads.json
```

Scratch output: `data/sourced-jobs.md` → dedup → Notion Application Tracker.

## Layout

```
.cursor/skills/job-aggregators/   # Skill runbook + references + run logs
data/                             # Runtime scratch + Notion artifacts (gitignored)
scripts/
  auth/                           # Headed login → .auth/*.json
  sources/                        # Per-aggregator sourcing
  pipeline/                       # Orchestration + Notion payload prep
  test/                           # Access smoke test + dedup unit checks
  lib/                            # Shared + per-aggregator logic
  setup.sh
.auth/                            # Saved sessions (gitignored)
```
