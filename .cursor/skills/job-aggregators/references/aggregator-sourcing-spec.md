# Aggregator Sourcing Spec

Per-aggregator Playwright behavior. Commands: [pipeline-commands.md](pipeline-commands.md). Script paths:
[repository-scripts-map.md](repository-scripts-map.md). Light skip: [light-skip-heuristics.md](light-skip-heuristics.md).
Selectors: [auth-and-selectors.md](auth-and-selectors.md).

## Wobo

**Runner:** `scripts/sources/wobo.ts` · **Lib:** `scripts/lib/wobo.ts`

1. Open dashboard ([auth-and-selectors.md](auth-and-selectors.md)).
2. Per card: read Company, Role, Location; **View original** `href` → Job URL.
3. **Save** keepers / **Decline** obvious mismatches — card-footer buttons only.
4. Stop: caught-up message, `WOBO_JOB_LIMIT` new jobs, or feed stall. Caught-up is **normal**.

Scratch-known postings: still Save to advance; do not count toward limit
([scratch-data-formats.md](scratch-data-formats.md)).

## Handshake

**Runner:** `scripts/sources/handshake.ts` · **Lib:** `scripts/lib/handshake.ts`

1. Open `/job-search`; apply Full-Time, Paid, OPT/sponsorship filters.
2. Search terms: `Junior AI Engineer`, `Agentic AI` (`SEARCH_TERMS` in lib).
3. Scrape list cards; advisory flags only — see [light-skip-heuristics.md](light-skip-heuristics.md).
4. Stop: `HANDSHAKE_JOB_LIMIT` new jobs or exhausted results.

## Jack & Jill

**Runner:** `scripts/sources/jackjill.ts` · **Lib:** `scripts/lib/jack/inbox.ts`  
**Clean-out:** `scripts/sources/jack-empty.ts` · **Lib:** `scripts/lib/jack/kanban.ts`

1. Fill inbox to `JACKJILL_JOB_LIMIT` via [jack-inbox-prompts.md](jack-inbox-prompts.md) (vary wording;
   wait for Jack between prompts — never overwrite while generating).
2. Review inbox: **View job post** `href` → Job URL; **Track** / **Not for me**.
3. Daily clean-out (inbox + Saved): [jack-kanban-cleanup.md](jack-kanban-cleanup.md).

Notion logging is separate — [notion-tracker-logging.md](notion-tracker-logging.md).
