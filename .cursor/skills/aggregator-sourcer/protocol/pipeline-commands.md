# Pipeline Commands

Run from **repo root** (directory containing `package.json`). Env overrides:
[environment-variables.md](environment-variables.md).

## Setup and auth

```bash
bash scripts/setup.sh              # deps + Playwright Chromium + .auth/ + data/

npm run auth:wobo                  # headed login → .auth/wobo.json
npm run auth:handshake
npm run auth:jackjill
npm run test:access                # verify all sessions
```

First-time from skill folder: `bash .cursor/skills/aggregator-sourcer/scripts/setup.sh`.

## Sourcing

```bash
npm run source:all                 # sequential — default
npm run source:all:parallel        # PARALLEL=1
npm run source:wobo
npm run source:handshake
npm run source:jackjill
npm run source:jack-empty   # Jack inbox + Saved clean-out
```

## Logging pipeline

```bash
npm run cleanup:data               # step 5 & 9 — required; policy: docs/shared/data-cleanup.md
npm run log:notion:deduped         # scratch + snapshot → payloads
npm run run-log:basename           # step 11 — run log filename
```

Run `cleanup:data` at step 5 (before logging) and again at step 9 (after MCP insert).
Do not skip either pass. Keep/delete rules: [docs/shared/data-cleanup.md](../../../../docs/shared/data-cleanup.md).

Example override: `HEADED=0 WOBO_JOB_LIMIT=5 npm run source:wobo`
