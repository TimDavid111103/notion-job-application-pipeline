# Aggregator Access Reference

Auth is one-time per aggregator. Sessions live in `.auth/{wobo,handshake,jackjill}.json`. Sourcing runs **headless** by default (`HEADED=1` for debug).

## Auth (headed, one-time)

```bash
npm run auth:wobo        # email: 30.recess_archaea@icloud.com
npm run auth:handshake   # school credentials; pass Cloudflare if prompted
npm run auth:jackjill    # email: tim.david1111@gmail.com; verification code
```

Verify all sessions:

```bash
npm run test:access
```

## Wobo

| Item | Value |
|---|---|
| Post-login URL | `https://www.wobo.ai/dashboard` |
| Feed location | Dashboard (not `/feed` — that URL 404s) |
| Auth file | `.auth/wobo.json` |

**Selectors**

| Element | Selector |
|---|---|
| View original | `getByRole('link', { name: /view original/i })` |
| Save / Decline | `getByRole('button', { name: /^save$/i })` / `/^decline$/i` |
| Feed ready | Save button visible |
| Caught up | text matching `/all caught up\|no more matches/i` |

**Notes:** SwipeCard overlay blocks normal clicks — use `click({ force: true })`. Batch-scrape visible cards before click-advance loop.

## Handshake

| Item | Value |
|---|---|
| Post-login URL | `https://app.joinhandshake.com/job-search` |
| Auth file | `.auth/handshake.json` |

**Selectors**

| Element | Selector |
|---|---|
| Job search | `input[name="query"]` (placeholder: "Describe a job you want") |
| Filters | `getByRole('button', { name: /filters/i })` |
| Job links | `a[href*="/jobs/"]` |

**Notes:** Headed login required once for Cloudflare. Do not use `role=combobox` or `placeholder*="Search"` for the main search input.

## Jack & Jill

| Item | Value |
|---|---|
| Post-login URL | `https://app.jackandjill.ai/jack/dashboard/inbox` |
| Auth file | `.auth/jackjill.json` |

**Selectors**

| Element | Selector |
|---|---|
| Chat input | `getByPlaceholder(/message\|ask\|search/i)` or `textarea` |
| Review job | `getByRole('button', { name: /review job/i })` |
| View job post | `getByRole('link', { name: /view job post/i })` — href is Job URL, not `?review=` |
| Track / Not for me | `getByRole('button', { name: /^track$/i })` / `/not for me/i` |

**Notes:** Fill inbox to 10+ via prompts in `references/jack-prompts.md`. Inbox fill is the main time sink.

## Sourcing defaults

| Aggregator | Default job limit | Env override |
|---|---|---|
| Wobo | 30 (until caught up) | `JOB_LIMIT` |
| Handshake | 10 per run (2 search terms) | `JOB_LIMIT` |
| Jack & Jill | 10 | `JOB_LIMIT` |

Scratch output: `sourced-jobs.md` (runtime, gitignored).
