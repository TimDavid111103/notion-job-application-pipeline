# Agent Runtime (Sourcing Skill)

Run Playwright through repository npm scripts from the repo root, not browser MCP tabs.

## Browser permissions

Every command that opens Chromium, including headed auth and headless sourcing, must run outside the Cursor sandbox:

```text
required_permissions: ["all"]
```

Use headed auth only when session preflight fails: `npm run auth:wobo`, `npm run auth:handshake`, or `npm run auth:jackjill`. Sessions are stored in `.auth/`. Normal `npm run source:all` is headless; set `HEADED=1` only for diagnosis.

## Execution

Use package scripts, which call `node --import tsx`; avoid direct `npx tsx` agent runs. `npm run source:jack-empty` is the supported Jack cleanup command.

Setup also downloads Chromium and requires unrestricted execution:

```bash
bash .cursor/skills/aggregator-sourcer/scripts/setup.sh
```
