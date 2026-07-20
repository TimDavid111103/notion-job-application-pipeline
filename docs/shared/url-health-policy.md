# URL Health Policy

Single source of truth for dead/broken URL handling (scrape + fill lanes).

Implementation: `scripts/lib/url-health.ts`, `isDeletableFailure()` in `scripts/lib/artifacts/scrape-artifacts.ts`.

## Failure reasons

| Reason | Deletable | Action |
|--------|-----------|--------|
| `404` | Yes | `delete_database_entry` |
| `dns_failure` | Yes | `delete_database_entry` |
| `posting_closed` | Yes | `delete_database_entry` |
| `empty_content` | Yes | `delete_database_entry` |
| `non_english` | Yes | `delete_database_entry` (scrape lane only) |
| `timeout` | Yes | `delete_database_entry` |
| `navigation_error` | Yes | `delete_database_entry` |
| `missing_url` | Yes | `delete_database_entry` |
| `login_required` | **No** | Preserve row; user may fix in headed session |
| `captcha` | **No** | Preserve row; retry later |
| `spam_flag` | **No** | Preserve row; ATS anti-bot rejected the submission |

## Lanes using this policy

| Lane | npm script |
|------|------------|
| scrape | `npm run scrape:descriptions` |
| fill | `npm run check:url-health` |

## Rule

Transient failures (`login_required`, `captcha`) must **never** delete a tracker row.

## Login vs public posting

`login_required` is inferred from "sign in" / "log in" text in the first 1500
characters of the page body. Many public ATS boards put that wording in nav chrome
while the full posting is still visible. Classification skips `login_required` when
the body already contains public job-content signals (e.g. Responsibilities,
Requirements, About the Role). Host-agnostic — implemented in
`pageHasPublicJobContent()` in `scripts/lib/url-health.ts`.

## HTTP SPA shells are not dead

HTTP fetch often gets a JS app shell (HTTP 200, real `<title>`, almost no body text).
That is **not** `empty_content` and must not delete the row. Classify as reachable via
`isHttpSpaShellReachable()` (large HTML + thin text + real title, or known SPA markers).
Use browser mode when you need the rendered posting, not to prove the URL is dead.
