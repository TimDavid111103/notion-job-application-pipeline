# Pipeline Commands (Fill Skill)

All commands run from repo root.

| Command | SKILL step | Purpose |
|---------|------------|---------|
| `npm run cleanup:data` | 3, 11 | Remove temp `data/` artifacts |
| `npm run write:jobs-ready-to-apply -- <mcp.json>` | 4 | Wrap eligible query results |
| `npm run write:fill-queue -- <items.json>` | 5 | Write fill queue envelope |
| `npm run check:url-health` | 7 | URL preflight (HTTP by default) |
| `HEADED=1 npm run fill:application` | 9 | Headed form fill loop (**outside sandbox**) |
| `npm run run-log:basename:fill` | 12 | Print run log path |

All scripts use `node --import tsx` (avoids `tsx` IPC `EPERM` in restricted shells).

## Debug overrides

```bash
HEADED=1 FILL_LIMIT=1 npm run fill:application   # outside sandbox
URL_HEALTH_LIMIT=3 npm run check:url-health      # HTTP mode (default)
URL_HEALTH_MODE=browser npm run check:url-health # Playwright (outside sandbox)
URL_HEALTH_MODE=auto npm run check:url-health    # browser, fall back to HTTP
AUTO_PAUSE=1 npm run fill:application            # opt-in inspector (avoid in agent runs)
```

## First-time setup

```bash
# outside sandbox
bash .cursor/skills/application-filler/scripts/setup.sh
```

→ [protocol/agent-runtime.md](agent-runtime.md)
