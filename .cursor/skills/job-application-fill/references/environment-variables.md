# Environment Variables (Fill Skill)

| Variable | Default | Purpose |
|----------|---------|---------|
| `HEADED` | `1` for fill script | Visible browser (required for step 9) |
| `FILL_LIMIT` | unlimited | Max jobs per fill run |
| `URL_HEALTH_LIMIT` | unlimited | Max URLs per health check |
| `URL_HEALTH_TIMEOUT_MS` | 30000 | Navigation timeout for health check |
| `URL_HEALTH_DELAY_MS` | 1000 | Delay between health check URLs |
| `AUTO_SUBMIT` | off | Never auto-submit in v1 |
| `AUTO_PAUSE` | on | `page.pause()` between jobs |
| `SCRAPE_TIMEOUT_MS` | — | Fallback for URL_HEALTH_TIMEOUT_MS |

Implementation: `scripts/lib/application-fill.ts`, `scripts/lib/url-health.ts`.
