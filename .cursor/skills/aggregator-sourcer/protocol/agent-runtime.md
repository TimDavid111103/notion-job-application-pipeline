# Agent Runtime (Sourcing Skill)

Run Playwright through repository npm scripts from the repo root, not browser MCP tabs.

Headed vs headless: [environment-variables.md](environment-variables.md) (`isSourceHeaded`).
Headed sourcing keeps Chrome in the background on macOS (`stealFocus: false`); auth and fill
pass `stealFocus: true` when you need the window in front.

## Browser permissions

Every command that opens Chromium — auth, sourcing, and `test:access` — must run
outside the Cursor sandbox:

```text
required_permissions: ["all"]
```

Re-auth only when session preflight fails: `npm run auth:wobo`, `npm run auth:handshake`,
or `npm run auth:jackjill`. Sessions are stored in `.auth/`.

## Execution

Use package scripts, which call `node --import tsx`; avoid direct `npx tsx` agent runs.
`npm run source:jack-empty` is the supported Jack cleanup command.

Setup also downloads Chromium and requires unrestricted execution:

```bash
bash .cursor/skills/aggregator-sourcer/scripts/setup.sh
```
