# Auth and Selectors

Single source of truth for auth, URLs, and selectors. Commands: [pipeline-commands.md](../protocol/pipeline-commands.md).
Job limits: [environment-variables.md](../protocol/environment-variables.md). Sourcing behavior: [aggregator-sourcing-spec.md](aggregator-sourcing-spec.md).

Sessions: `.auth/{wobo,handshake,jackjill}.json`. Headed vs headless:
[environment-variables.md](../protocol/environment-variables.md).

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

Sticky header Save/Decline do **not** advance the feed. Keyboard `s` / `a` fallback.
Force-click for SwipeCard overlay.

## Handshake

| Item | Value |
|---|---|
| URL | `https://app.joinhandshake.com/job-search` |
| Auth | `.auth/handshake.json` |
| Search | `input[name="query"]` |
| Filters | `getByRole('button', { name: /filters/i })` |

Do not use `role=combobox` or `placeholder*="Search"` for main search. Headed login once
for Cloudflare.

## Jack & Jill

| Item | Value |
|---|---|
| Inbox | `https://app.jackandjill.ai/jack/dashboard/inbox` |
| Kanban | `https://app.jackandjill.ai/jack/dashboard/jobs/kanban` |
| Auth | `.auth/jackjill.json` |
| Inbox | `getByRole("button", { name: /review job/i })`; reject confirm `/skip this role/i` |

Clean-out flow and kanban DOM: [jack-kanban-cleanup.md](jack-kanban-cleanup.md). Search prompts:
[jack-inbox-prompts.md](jack-inbox-prompts.md).

## DOM waits

- **`locator.isVisible()` does not wait** — use `waitFor({ state: "visible" })`.
- Jack: scope to right pane (x > ~520) — chat feed has look-alike buttons.
