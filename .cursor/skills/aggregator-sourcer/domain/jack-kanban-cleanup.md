# Jack Kanban Cleanup

Single source of truth for daily Jack clean-out. Runner: `npm run source:jack-empty`.
Auth/URLs: [auth-and-selectors.md](auth-and-selectors.md). Prompts: [jack-inbox-prompts.md](jack-inbox-prompts.md). Curation:
[light-skip-heuristics.md](light-skip-heuristics.md) / [job-curation-judgement.md](job-curation-judgement.md).

**Goal:** empty inbox **and** Jobs-tab Saved column daily — keepers → `data/sourced-jobs.md`,
everything else archived.

## Two surfaces

1. **Inbox** (`/jack/dashboard/inbox`) — review queue. **Track** (keep) or **Not for me**
   (reject + confirm "Skip this role").
2. **Kanban Saved** (`/jack/dashboard/jobs/kanban`) — Jack auto-saves many jobs here without
   inbox review. This is where volume lives.

Tracking inbox jobs moves them to Saved. Order: inbox first → then empty Saved. Overlap
deduped by scratch `jobKey` ([contracts/data-formats.md](../contracts/data-formats.md)).

## Daily flow

1. **`reviewInbox`** — every "Review job" modal: Track keepers, reject rest.
2. **`emptySavedColumn`** — first Saved card → open → right-pane Show details → read URL →
   judge → Archive → back to board. Repeat until Saved = 0.
3. **`appendJobs`** — prepend keepers (strict dedup).

## Kanban DOM

- Board: `/jack/dashboard/jobs/kanban` (bare `/jobs` redirects; `/saved` 404s).
- Saved header: `Saved{N}` in right half (x > ~520). Not the left "Recent jobs" sidebar.
- Saved card: `div[role="button"][aria-roledescription="sortable"]` in column.
- Detail opens `/jobs/kanban/{uuid}` — return via `a[href="/jack/dashboard/jobs/kanban"]`.
- Role/company: breadcrumb `Jobs{Role} at {Company}` (split on last " at ").
- Apply URL: right-pane **"View job post"** after right-pane **Show details** (x > ~520).
- Archive: status button → menu → **Archive** menuitem.

## Operational notes

- Never send a new prompt while Jack is still generating.
- Prefer draining Saved over over-prompting when near job limit (~1–3 jobs per prompt).
- `screeningSignals` flags are advisory only — judgement is yours
  ([job-curation-judgement.md](job-curation-judgement.md)).
