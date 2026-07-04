# Aggregator Access

Auth, URLs, and selectors. Commands: [commands.md](commands.md). Job limits: [env-vars.md](env-vars.md).

Sessions: `.auth/{wobo,handshake,jackjill}.json`. Default: **headless** (`HEADED=1` to debug).

## Auth (fallback only)

```bash
npm run auth:wobo        # email: 30.recess_archaea@icloud.com
npm run auth:handshake   # school credentials; Cloudflare if prompted
npm run auth:jackjill    # email: tim.david1111@gmail.com; verification code
npm run test:access
```

## Wobo

| Item | Value |
|---|---|
| URL | `https://www.wobo.ai/dashboard` (not `/feed`) |
| Auth | `.auth/wobo.json` |
| View original | `getByRole('link', { name: /view original/i })` |
| Save / Decline | Card-footer only — `feedActionButton()` → `.last()` |
| Caught up | `/all caught up\|no more matches/i` |

Sticky header Save/Decline do **not** advance. Keyboard `s` / `a` fallback. Force-click for SwipeCard overlay.

## Handshake

| Item | Value |
|---|---|
| URL | `https://app.joinhandshake.com/job-search` |
| Auth | `.auth/handshake.json` |
| Search | `input[name="query"]` |
| Filters | `getByRole('button', { name: /filters/i })` |

Do not use `role=combobox` or `placeholder*="Search"` for main search. Headed login once for Cloudflare.

## Jack & Jill

| Item | Value |
|---|---|
| Inbox | `https://app.jackandjill.ai/jack/dashboard/inbox` |
| Kanban | `https://app.jackandjill.ai/jack/dashboard/jobs/kanban` |
| Auth | `.auth/jackjill.json` |
| Inbox selectors | Review job, View job post, Track, Not for me |

Kanban selectors and clean-out flow: [jack-kanban.md](jack-kanban.md). Prompts: [jack-prompts.md](jack-prompts.md).
