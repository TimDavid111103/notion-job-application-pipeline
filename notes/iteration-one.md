# Iteration One

## Status (setup complete — ready to streamline sourcing)

This repo is a **Playwright iteration workspace** for job aggregators. A Cursor skill has **not** been written yet — iterate here first, then assemble the skill later.

### Done

- [x] **Stack:** TypeScript + Playwright (`package.json`, `scripts/setup.sh`)
- [x] **Auth (all three aggregators):** headed login scripts save sessions to `.auth/`
  - Wobo → `.auth/wobo.json` — post-login: `https://www.wobo.ai/dashboard`
  - Handshake → `.auth/handshake.json` — post-login: `https://app.joinhandshake.com/job-search`
  - Jack & Jill → `.auth/jackjill.json` — post-login: `https://app.jackandjill.ai/jack/dashboard/inbox`
- [x] **Headless access verified:** `npm run test:access` passes for all three
- [x] **Per-aggregator libs:** selectors and auth helpers extracted into `scripts/lib/`
- [x] **Scratch format:** `sourced-jobs.md` (runtime, gitignored) — no Notes column
- [x] **Notion mapping:** Name, Company, Role, Location (source), Job URL, Date Added — see `references/notion-schema.md`

### Current step

**Streamline the sourcing process itself** — run and harden `scripts/sources/{wobo,handshake,jackjill}.ts`, then wire dedup + Notion logging. Do not score or rank jobs; apply quick-skim elimination only.

### Not done yet

- [ ] Full sourcing run across all aggregators with real job capture
- [ ] Notion dedup + `add_database_entry` logging end-to-end
- [ ] Cursor skill assembly (gated until iteration is stable)

---

## File map (zero-context onboarding)

| What | Path |
|---|---|
| Start here | `README.md` |
| This iteration log | `notes/iteration-one.md` |
| Sourcing workflow spec | `references/job-aggregators.md` |
| Auth URLs, selectors, limits | `references/access.md` |
| Quick-skim discard rules | `references/elimination-rules.md` |
| Jack & Jill inbox prompts | `references/jack-prompts.md` |
| Notion Application Tracker columns | `references/notion-schema.md` |
| Runtime scratch (per-run output) | `sourced-jobs.md` |
| Saved browser sessions | `.auth/wobo.json`, `.auth/handshake.json`, `.auth/jackjill.json` |

### Scripts

| Command | File | Purpose |
|---|---|---|
| `npm run auth:wobo` | `scripts/auth/login-wobo.ts` | Headed Wobo login |
| `npm run auth:handshake` | `scripts/auth/login-handshake.ts` | Headed Handshake login |
| `npm run auth:jackjill` | `scripts/auth/login-jackjill.ts` | Headed Jack & Jill login |
| `npm run test:access` | `scripts/test-access.ts` | Headless auth check (all three) |
| `npm run source:wobo` | `scripts/sources/wobo.ts` | Source from Wobo |
| `npm run source:handshake` | `scripts/sources/handshake.ts` | Source from Handshake |
| `npm run source:jackjill` | `scripts/sources/jackjill.ts` | Source from Jack & Jill |
| `npm run source:all:parallel` | `scripts/source-all.ts` | All aggregators (parallel) |
| `npm run log:notion` | `scripts/log-to-notion.ts` | Prepare Notion payloads → `notion-payloads.json` |

### Shared libraries (`scripts/lib/`)

| File | Responsibility |
|---|---|
| `browser.ts` | Launch browser, load/save `storageState`, manual login wait |
| `scratch.ts` | `SourcedJob` type, `sourced-jobs.md` read/write, elimination helpers, dedup within source |
| `notion.ts` | Notion property formatting, dedup helpers, payload prep |
| `wobo.ts` | Dashboard access, card extraction, feed-ready waits |
| `handshake.ts` | Job search input (`input[name="query"]`), filters, search/collect |
| `jackjill.ts` | Inbox fill, review modal, Track/Not for me |

### Key conventions

- **Headless by default** for sourcing; `HEADED=1` for debug; auth scripts always headed
- **Job limits:** `JOB_LIMIT` env overrides defaults (Wobo 30, Handshake 10, Jack & Jill 10)
- **Notion database ID:** `32f1de14-69d8-803a-81ba-fb8cf47a1ccd`
- **No Notes column** anywhere — scratch or Notion

### Scratch output columns

```
| Company | Role | Job URL | Source | Location |
```

---

## Iteration log

<!-- Add findings, timing, selector fixes, and streamlining notes below -->
