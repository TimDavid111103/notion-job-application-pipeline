# Environment Variables (Fill Skill)

| Variable | Default | Purpose |
|----------|---------|---------|
| `HEADED` | `1` for fill script | Visible browser (required for step 9) |
| `FILL_LIMIT` | unlimited | Max jobs per fill run |
| `URL_HEALTH_MODE` | `http` | `http` (fetch, no browser), `browser`, or `auto` (browser→HTTP fallback) |
| `URL_HEALTH_LIMIT` | unlimited | Max URLs per health check |
| `URL_HEALTH_TIMEOUT_MS` | 30000 | Navigation/fetch timeout for health check |
| `URL_HEALTH_DELAY_MS` | 1000 | Delay between health check URLs |
| `AUTO_SUBMIT` | off | Never auto-submit in v1 |
| `AUTO_PAUSE` | off | Opt-in `page.pause()` (Playwright inspector overlay) |
| `KEEP_BROWSER_OPEN` | on when `HEADED=1` | Leave browser open after pre-fill instead of closing |
| `SCRAPE_TIMEOUT_MS` | — | Fallback for URL_HEALTH_TIMEOUT_MS |
| `PLAYWRIGHT_BROWSERS_PATH` | auto | Set by `playwright-env.ts` to `~/Library/Caches/ms-playwright` |
| `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE` | auto on arm64 | Forces `mac*-arm64` when sandbox empties `os.cpus()` |
| `ALLOW_SANDBOX_BROWSER` | off | Escape hatch only — do not use in normal agent runs |

Implementation: `scripts/lib/application-fill.ts`, `scripts/lib/url-health.ts`, `scripts/lib/playwright-env.ts`.

→ [agent-runtime.md](agent-runtime.md)
