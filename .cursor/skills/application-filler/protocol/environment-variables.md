# Environment Variables (Fill Skill)

| Variable | Default | Purpose |
|----------|---------|---------|
| `HEADED` | `1` for fill script | Visible browser (required for step 9) |
| `FILL_LIMIT` | unlimited | Max jobs per fill run |
| `URL_HEALTH_MODE` | `http` | `http` (fetch, no browser), `browser`, or `auto` (browser→HTTP fallback) |
| `URL_HEALTH_LIMIT` | unlimited | Max URLs per health check |
| `URL_HEALTH_TIMEOUT_MS` | 30000 | Navigation/fetch timeout for health check |
| `URL_HEALTH_DELAY_MS` | 1000 | Delay between health check URLs |
| `AUTO_SUBMIT` | off | When `1`: disconnect CDP → Accessibility click Submit → reconnect + classify spam/success |
| `ANTI_BOT` | on with `AUTO_SUBMIT` | Warm-up + human mouse/keyboard/clipboard input. Set `0` to disable |
| `BROWSER_CDP` | on when headed | Spawn system Chrome and attach over CDP. Set `0` to force `chromium.launch` |
| `CHROME_PATH` | auto | Optional path to Chrome/Chromium for CDP launch |
| `AUTO_PAUSE` | off | Opt-in `page.pause()` (Playwright inspector overlay) |
| `KEEP_BROWSER_OPEN` | on when `HEADED=1` | Keep the fill **process** alive after pre-fill. Unblock via Enter, closing Chrome, or `data/fill/handoff-continue` |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | unset | Optional live AI-fill for open-ended fields when `data/fill/ai-answers.json` is missing |
| `ANTHROPIC_MODEL` / `OPENAI_MODEL` | sonnet / gpt-4o-mini | Model override for live AI-fill |
| `SCRAPE_TIMEOUT_MS` | — | Fallback for URL_HEALTH_TIMEOUT_MS |
| `PLAYWRIGHT_BROWSERS_PATH` | auto | Set by `playwright-env.ts` to `~/Library/Caches/ms-playwright` |
| `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE` | auto on arm64 | Forces `mac*-arm64` when sandbox empties `os.cpus()` |
| `ALLOW_SANDBOX_BROWSER` | off | Escape hatch only — do not use in normal agent runs |

Implementation: `scripts/lib/fill/application-fill.ts`, `scripts/lib/url-health.ts`, `scripts/lib/browser/playwright-env.ts`, `scripts/lib/browser/index.ts`.

→ [protocol/agent-runtime.md](agent-runtime.md)
