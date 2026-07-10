# Pipeline Commands

Run all commands from **repo root**. Env vars: [environment-variables.md](environment-variables.md).

## Setup

```bash
bash .cursor/skills/description-scraper/scripts/setup.sh
```

## Scrape pipeline

```bash
npm run cleanup:data              # step 2 / 9 — remove temp artifacts
npm run scrape:descriptions       # step 5 — Playwright scrape from queue
npm run run-log:basename:scraper  # step 10 — run log path
```

## Debug

```bash
HEADED=1 SCRAPE_LIMIT=3 npm run scrape:descriptions
SCRAPE_TIMEOUT_MS=60000 npm run scrape:descriptions
```

## Tests

```bash
npm run test:job-description
npm run test:notion-dedup         # shared notion.ts parsers
```

## MCP steps (no npm script)

Steps 3, 4, 7, 8 use `user-notion` MCP directly — see
[notion-mcp-workflows.md](notion-mcp-workflows.md).
