# Agent Runtime (Description Scraper)

Run Playwright through repository npm scripts from the repo root, not browser MCP tabs. Scraping is headless by default.

## Browser permissions

`scrape:descriptions` can launch Chromium, so run it outside the Cursor sandbox even in headless mode:

```text
required_permissions: ["all"]
```

Handshake authentication is owned by `scripts/auth/`; the scraper reads `.auth/handshake.json`. Refresh it with `npm run auth:handshake` when needed.

## Headed fallback (required)

Default to headless. If headless fails for a URL — `captcha`, `login_required`, bot-interstitial text misclassified as `ok`, or empty extraction on an authenticated host — **do not append those rows**. Rebuild the queue to only the failed URLs and re-run immediately:

```bash
HEADED=1 npm run scrape:descriptions
```

Use headed for the retry, not as a one-off debug toggle. Append only after the headed pass succeeds (or after a fresh `auth:handshake` if headed still returns `login_required`).

## Execution

Use package scripts, which call `node --import tsx`. Setup downloads Chromium and also requires unrestricted execution:

```bash
bash .cursor/skills/description-scraper/scripts/setup.sh
```
