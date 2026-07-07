# Commands

Run from **repo root** (directory containing `package.json`).

## Setup and auth

```bash
bash scripts/setup.sh              # deps + Playwright Chromium + .auth/ + data/

npm run auth:wobo                  # headed login → .auth/wobo.json
npm run auth:handshake
npm run auth:jackjill
npm run test:access                # verify all sessions
```

First-time from skill folder: `bash .cursor/skills/job-aggregators/scripts/setup.sh` (wraps `scripts/setup.sh`).

## Sourcing

```bash
npm run source:all                 # sequential — default
npm run source:all:parallel        # PARALLEL=1
npm run source:wobo
npm run source:handshake
npm run source:jackjill
```

Jack daily clean-out (not in package.json):

```bash
npx tsx scripts/sources/jack-empty.ts
```

## Notion payload prep

```bash
npm run log:notion:deduped         # scratch + data/notion-tracker-snapshot.json → deduped payloads
npm run log:notion                 # format-only — debug, no Notion dedup
npm run test:notion-dedup          # unit checks for dedup helpers
```

Env overrides: [env-vars.md](env-vars.md). Example: `HEADED=1 WOBO_JOB_LIMIT=5 npm run source:wobo`
