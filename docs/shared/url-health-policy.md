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

## Lanes using this policy

| Lane | npm script |
|------|------------|
| scrape | `npm run scrape:descriptions` |
| fill | `npm run check:url-health` |

## Rule

Transient failures (`login_required`, `captcha`) must **never** delete a tracker row.
