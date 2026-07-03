# Notion Job Application Pipeline

Playwright workspace for sourcing jobs from Wobo, Handshake, and Jack & Jill. **Skill assembly is a later step** — for now this repo holds scripts, references, and auth state while we iterate.

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

## Source jobs (when ready)

```bash
npm run source:all:parallel
npm run log:notion
```

Scratch output: `sourced-jobs.md` → dedup → Notion Application Tracker.

## Layout

```
references/          # Workflow spec, access notes, elimination rules, Notion schema
scripts/
  auth/              # Headed login → .auth/*.json
  sources/           # Per-aggregator sourcing
  lib/               # Shared + per-aggregator logic
  setup.sh
.auth/               # Saved sessions (gitignored)
sourced-jobs.md      # Runtime scratch (gitignored)
```

## Docs

- [notes/iteration-one.md](notes/iteration-one.md) — **current iteration status** (start here for context)
- [references/job-aggregators.md](references/job-aggregators.md) — sourcing workflow spec
- [references/access.md](references/access.md) — auth URLs, selectors, limits
- [references/elimination-rules.md](references/elimination-rules.md)
- [references/notion-schema.md](references/notion-schema.md)
