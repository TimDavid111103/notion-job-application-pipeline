# Job URL Extraction

Single source of truth for Playwright description extraction. Implementation:
`scripts/lib/scrape/job-description.ts`.

## Flow

1. Normalize URL (Ashby `/application` → posting page).
2. **Workday (`myworkdayjobs.com`)**: fetch via public CXS JSON API first
   (`scripts/lib/scrape/workday.ts`) — no browser needed. Falls back to Playwright on API miss.
3. Navigate to `Job URL` (`domcontentloaded`, `SCRAPE_TIMEOUT_MS`).
4. **Workday DOM fallback**: wait for `[data-automation-id='jobPostingDescription']` (up to 10s).
5. Brief settle wait (1.5s).
6. **Expand truncated content** (`expandTruncatedSections`): click "show/see/read more",
   "More", and "show full description" toggles so collapsed descriptions are complete
   before reading. Generalized across hosts; **required for Handshake**, which hides the
   full posting behind a "More" button (`aria-label` "Show more (…)").
7. Classify hard failures (404, DNS, closed posting, login wall, captcha).
8. Extract structured text via host-specific DOM walk, then generic heuristics.
9. **Language check** (`isEnglishDescription` in `scripts/lib/scrape/language.ts`): non-English
   postings → `non_english` (deletable).
10. Format as markdown (`formatJobDescriptionMarkdown`) — headings, metadata labels, bullets
   when recognized; otherwise plain text block. Chrome strippers remove recommendation
   sections, applicant CTAs, and empty headings (see below).
11. Require ≥ 200 characters or mark `empty_content`.

## Host-specific selectors

| Host pattern | Selectors (first match ≥ 200 chars wins) |
|---|---|
| `greenhouse.io` | `.content`, `#content`, `[data-qa='job-description']` |
| `lever.co` | `.content`, `.posting-page`, `.section-wrapper` |
| `ashbyhq.com` | `[class*='JobDescription']`, `main` |
| `myworkdayjobs.com` | CXS API primary (`/wday/cxs/{tenant}/{site}/job/…`); DOM: `[data-automation-id='jobPostingDescription']`, `[data-automation-id='jobPostingPage']` |
| `joinhandshake.com` | `[data-hook='job-details-page']`, `main`, `article` (requires expand step) |

### Ashby URL normalization

Queue URLs ending in `/application` are rewritten to the posting page before navigation
(e.g. `…/uuid/application` → `…/uuid`).

### Lever URL normalization

Queue URLs ending in `/apply` are rewritten to the posting page before navigation
(e.g. `…/posting-id/apply` → `…/posting-id`).

### Workday CXS API

Workday postings are fetched via the public Candidate Experience Service JSON endpoint
before opening a browser tab. URL parsing handles both locale-prefixed paths
(`…/en-US/RTS/job/ML-Engineer_R1191`) and bare site paths
(`…/AccentureCareers/job/London/…`). Implementation: `scripts/lib/scrape/workday.ts`.

## Generic fallback

Tried in order when host shortcuts miss:

- `[class*='job-description']`, `[class*='JobDescription']`
- `[id*='job-description']`, `[id*='jobDescription']`
- `[data-testid*='job-description']`
- `main article`, `main`, `article`, `[role='main']`
- Largest `p` / `li` / `div` text block (≥ 80 chars)

## Chrome stripping

Applied during markdown formatting (`scripts/lib/scrape/scrape-markdown.ts`), generalized across
hosts:

- **Recommendation sections** (`stripRecommendationSections`): everything from the first
  cross-sell heading onward is dropped — "Similar Jobs", "Related/Recommended Jobs",
  "Alumni in similar roles", "People also viewed", etc.
- **Applicant CTAs** (`stripApplicantNoise`): profile-match banners ("You match all
  qualifications", "Matching is based on your profile", "Update profile") and the
  "Message the hiring team" recruiter block.
- **Empty headings** (`dropEmptyHeadings`): heading lines with no body before the next
  heading (e.g. Handshake's "What they're looking for") are removed.

## Failure classification

| Code | Detection | Deletable |
|---|---|---|
| `404` | HTTP 404/410 | Yes |
| `dns_failure` | `ERR_NAME_NOT_RESOLVED`, connection refused | Yes |
| `posting_closed` | Body matches closed/filled patterns | Yes |
| `login_required` | Sign-in / log-in prompts in first 1500 chars without public job content — see [url-health-policy.md](../../../../docs/shared/url-health-policy.md) | **No** |
| `captcha` | captcha / verify-human text | **No** |
| `empty_content` | Extracted text < 200 chars | Yes |
| `non_english` | Description fails `isEnglishDescription()` | Yes |
| `timeout` | Navigation timeout | Yes |
| `navigation_error` | Other navigation failures | Yes |
| `missing_url` | Empty Job URL in queue | Yes |

`login_required` and `captcha` are transient/auth failures — they leave the tracker
row intact so a missing session never deletes a valid posting. Delete policy:
[notion/mcp-workflows.md](../notion/mcp-workflows.md).

## Authenticated hosts

Handshake postings (`app.joinhandshake.com`) sit behind login. The scraper reuses the
`.auth/handshake.json` session created by `scripts/auth/login-handshake.ts`
(`npm run auth:handshake`) — `aggregatorForUrl()` in `scripts/lib/browser/` routes
Handshake URLs to that session while all other ATS hosts scrape without auth. If
Handshake rows come back `login_required`, refresh the session and re-run; the rows
are preserved (not deleted) for the retry.

## Debug

```bash
HEADED=1 SCRAPE_LIMIT=3 npm run scrape:descriptions
```

Visible browser helps diagnose login walls and selector misses.
