# Agent Runtime (Description Scraper)

Run Playwright through repository npm scripts from the repo root, not browser MCP tabs. Scraping is headless by default.

## Browser permissions

`scrape:descriptions` can launch Chromium, so run it outside the Cursor sandbox even in headless mode:

```text
required_permissions: ["all"]
```

Set `HEADED=1` only to diagnose selectors, login walls, or extraction failures. Handshake authentication is owned by `scripts/auth/`; the scraper reads `.auth/handshake.json`. Refresh it with `npm run auth:handshake` when needed.

## Execution

Use package scripts, which call `node --import tsx`. Setup downloads Chromium and also requires unrestricted execution:

```bash
bash .cursor/skills/description-scraper/scripts/setup.sh
```
