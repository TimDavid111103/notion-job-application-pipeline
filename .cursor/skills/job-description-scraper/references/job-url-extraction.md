# Job URL Extraction

Single source of truth for Playwright description extraction. Implementation:
`scripts/lib/job-description.ts`.

## Flow

1. Normalize URL (Ashby `/application` → posting page).
2. Navigate to `Job URL` (`domcontentloaded`, `SCRAPE_TIMEOUT_MS`).
2. Brief settle wait (1.5s).
3. Classify hard failures (404, DNS, closed posting, login wall, captcha).
4. Extract structured text via host-specific DOM walk, then generic heuristics.
5. Format as markdown (`formatJobDescriptionMarkdown`) — headings, metadata labels, bullets when recognized; otherwise plain text block.
6. Require ≥ 200 characters or mark `empty_content`.

## Host-specific selectors

| Host pattern | Selectors (first match ≥ 200 chars wins) |
|---|---|
| `greenhouse.io` | `.content`, `#content`, `[data-qa='job-description']` |
| `lever.co` | `.content`, `.posting-page`, `.section-wrapper` |
| `ashbyhq.com` | `[class*='JobDescription']`, `main` |
| `myworkdayjobs.com` | `[data-automation-id='jobPostingDescription']`, `[data-automation-id='jobPostingPage']` |
| `joinhandshake.com` | `[data-hook='job-description']`, `main`, `article` |

### Ashby URL normalization

Queue URLs ending in `/application` are rewritten to the posting page before navigation
(e.g. `…/uuid/application` → `…/uuid`).

### Lever URL normalization

Queue URLs ending in `/apply` are rewritten to the posting page before navigation
(e.g. `…/posting-id/apply` → `…/posting-id`).

## Generic fallback

Tried in order when host shortcuts miss:

- `[class*='job-description']`, `[class*='JobDescription']`
- `[id*='job-description']`, `[id*='jobDescription']`
- `[data-testid*='job-description']`
- `main article`, `main`, `article`, `[role='main']`
- Largest `p` / `li` / `div` text block (≥ 80 chars)

## Failure classification

| Code | Detection | Deletable |
|---|---|---|
| `404` | HTTP 404/410 | Yes |
| `dns_failure` | `ERR_NAME_NOT_RESOLVED`, connection refused | Yes |
| `posting_closed` | Body matches closed/filled patterns | Yes |
| `login_required` | Sign-in / log-in prompts in first 1500 chars | Yes |
| `captcha` | captcha / verify-human text | Yes |
| `empty_content` | Extracted text < 200 chars | Yes |
| `timeout` | Navigation timeout | Yes |
| `navigation_error` | Other navigation failures | Yes |
| `missing_url` | Empty Job URL in queue | Yes |

Delete policy: [notion-mcp-workflows.md](notion-mcp-workflows.md).

## Debug

```bash
HEADED=1 SCRAPE_LIMIT=3 npm run scrape:descriptions
```

Visible browser helps diagnose login walls and selector misses.
