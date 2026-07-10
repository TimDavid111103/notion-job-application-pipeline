# URL Health Policy

Single source of truth for dead/broken URL handling across **description-scraper** and **application-filler**.

Implementation: `scripts/lib/url-health.ts`, `isDeletableFailure()` in `scripts/lib/scrape-artifacts.ts` (re-exported via `job-description.ts`).

## Failure reasons

| Reason | Deletable | Action |
|--------|-----------|--------|
| `404` | Yes | `delete_database_entry` |
| `dns_failure` | Yes | `delete_database_entry` |
| `posting_closed` | Yes | `delete_database_entry` |
| `empty_content` | Yes | `delete_database_entry` |
| `non_english` | Yes | `delete_database_entry` (scraper only) |
| `timeout` | Yes | `delete_database_entry` |
| `navigation_error` | Yes | `delete_database_entry` |
| `missing_url` | Yes | `delete_database_entry` |
| `login_required` | **No** | Preserve row; user may fix in headed session |
| `captcha` | **No** | Preserve row; retry later |

## Skills using this policy

| Skill | Step | Script |
|-------|------|--------|
| description-scraper | 5 scrape, 8 delete | `npm run scrape:descriptions` |
| application-filler | 7 preflight, 8 delete | `npm run check:url-health` |

## Rule

Transient failures (`login_required`, `captcha`) must **never** delete a tracker row — a missing session or bot wall would otherwise destroy a valid job.
