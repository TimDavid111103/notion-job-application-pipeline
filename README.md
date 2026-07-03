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
npm run log:notion
# then user-notion MCP add_database_entry per notion-payloads.json
```

Scratch output: `sourced-jobs.md` → dedup → Notion Application Tracker.

## Layout

```
.cursor/skills/job-aggregators/   # Skill runbook + references + run logs
scripts/
  auth/                           # Headed login → .auth/*.json
  sources/                        # Per-aggregator sourcing
  lib/                            # Shared + per-aggregator logic
  setup.sh
.auth/                            # Saved sessions (gitignored)
sourced-jobs.md                   # Runtime scratch (gitignored)
```
