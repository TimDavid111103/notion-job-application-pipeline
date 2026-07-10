# URL Health Policy (Fill Skill)

Canonical policy: [shared-references/url-health-policy.md](../../shared-references/url-health-policy.md)

This skill runs URL health in **step 7** via `npm run check:url-health` before headed fill.

## Modes (`URL_HEALTH_MODE`)

| Mode | Behavior |
|------|----------|
| `http` (default) | `fetch` + HTML text classification — no Playwright; needs network (`full_network` or `all`) |
| `browser` | Playwright navigation (needs unrestricted shell `all`) |
| `auto` | Try browser; on launch failure, fall back to HTTP |

HTTP mode treats JS app shells (e.g. Ashby title + “enable JavaScript”) with HTTP 200 as **ok** so SPA postings are not deleted as `empty_content`.

Dead + deletable rows are removed in **step 8** via MCP `delete_database_entry`.

Transient failures (`login_required`, `captcha`) are preserved — the headed fill session may resolve them.
