---
name: job-aggregators-spec
description: "Per-aggregator sourcing spec for Wobo, Handshake, and Jack & Jill. Use when running or debugging Playwright source scripts."
---

# Sourcing Spec

Commands and script paths: [commands.md](commands.md), [scripts-map.md](scripts-map.md).  
Light skip rules: [elimination-rules.md](elimination-rules.md). Selectors: [access.md](access.md).

## Wobo

**Runner:** `scripts/sources/wobo.ts` · **Lib:** `scripts/lib/wobo.ts`

1. Open `https://www.wobo.ai/dashboard`.
2. For each card: read Company, Role, Location; **View original** `href` → Job URL.
3. **Save** keepers / **Decline** obvious mismatches — card-**footer** buttons only ([access.md](access.md)).
4. Stop: caught-up message (`all caught up` / `no more matches`), `WOBO_JOB_LIMIT` new jobs, or feed stall. Caught-up is a **normal** stop when the daily feed is exhausted — not a failure.

Scratch-known postings: still Save to advance feed; do not count toward limit.

## Handshake

**Runner:** `scripts/sources/handshake.ts` · **Lib:** `scripts/lib/handshake.ts`

1. Open `/job-search`; apply Full-Time, Paid, OPT/sponsorship filters.
2. Search terms: `Junior AI Engineer`, `Agentic AI` (see `SEARCH_TERMS` in lib).
3. Scrape list cards; skip hourly-only gigs when obvious.
4. Stop: `HANDSHAKE_JOB_LIMIT` new jobs or exhausted results.

## Jack & Jill

**Runner:** `scripts/sources/jackjill.ts` · **Lib:** `scripts/lib/jack/inbox.ts`  
**Clean-out:** `scripts/sources/jack-empty.ts` · **Lib:** `scripts/lib/jack/kanban.ts`

1. Fill inbox to `JACKJILL_JOB_LIMIT` via [jack-prompts.md](jack-prompts.md) (vary wording; wait for Jack between prompts).
2. Review each inbox batch: **View job post** `href` → Job URL; **Track** / **Not for me**.
3. After sourcing, empty inbox + Saved kanban: [jack-kanban.md](jack-kanban.md).

## Notion logging

After sourcing: tracker dedup then MCP insert — [notion-schema.md](notion-schema.md). Not part of aggregator scripts.
