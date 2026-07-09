# Pipeline Commands (Fill Skill)

All commands run from repo root.

| Command | SKILL step | Purpose |
|---------|------------|---------|
| `npm run cleanup:data` | 3, 11 | Remove temp `data/` artifacts |
| `npm run write:jobs-ready-to-apply -- <mcp.json>` | 4 | Wrap eligible query results |
| `npm run write:fill-queue -- <items.json>` | 5 | Write fill queue envelope |
| `npm run check:url-health` | 7 | Headless URL preflight |
| `HEADED=1 npm run fill:application` | 9 | Headed form fill loop |
| `npm run run-log:basename:fill` | 12 | Print run log path |

## Debug overrides

```bash
HEADED=1 FILL_LIMIT=1 npm run fill:application
URL_HEALTH_LIMIT=3 npm run check:url-health
AUTO_PAUSE=0 npm run fill:application   # skip page.pause() between jobs
```

## Tests

```bash
npm run test:fill-references
npm run test:url-health
```

## First-time setup

```bash
bash .cursor/skills/job-application-fill/scripts/setup.sh
```
