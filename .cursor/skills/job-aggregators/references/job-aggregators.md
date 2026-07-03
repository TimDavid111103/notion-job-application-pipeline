---
name: job-aggregators-spec
description: "Per-aggregator sourcing spec for Wobo, Handshake, and Jack & Jill. Use when running or debugging Playwright source scripts. Covers filters, stop conditions, output fields, and scratch logging."
---

# Job Aggregators — Sourcing Spec

## Aggregators

- Wobo
- Handshake
- Jack & Jill

## Execution

Run from **repo root** via Playwright npm scripts — not browser MCP tabs or parallel Claude-in-Chrome agents:

```bash
npm run source:all             # default: sequential all three
npm run source:all:parallel      # PARALLEL=1
npm run source:wobo              # single aggregator
npm run source:handshake
npm run source:jackjill
```

Orchestrator: repo `scripts/source-all.ts`. Per-aggregator runners in repo `scripts/sources/`.
See [pipeline-scripts.md](pipeline-scripts.md) for the full script map.

## Logging

`npm run source:all` calls `initScratchFile()` and writes to `sourced-jobs.md` at repo root.

**Strict no-duplicate rule (per scratch file):** `appendJobs`/`jobKey` in repo
`scripts/lib/scratch.ts` skips rows that share a normalized Job URL or Company + Role. An
aggregator must **never** count a duplicate toward its quota (`JOB_LIMIT`).

Light skip while sourcing: [elimination-rules.md](elimination-rules.md) — when in doubt, keep.

## Wobo

**Script:** `scripts/sources/wobo.ts` · **Lib:** `scripts/lib/wobo.ts`

1. Open dashboard feed at `https://www.wobo.ai/dashboard`.
2. For each job card:
   - Capture Company, Role, Location from the card excerpt.
   - Skim against [elimination-rules.md](elimination-rules.md). If a rule is clearly met, press **Decline** and move on. If unclear, keep.
   - Set **Source** to `Wobo`.
   - Read the **href** of the "View original" link for **Job URL**. Do not click the link.
   - Press **Save** to log the role and advance.
   - Wait for the next card to fully render before pressing **Save** again.
   - If the "View original" link is missing or broken, press **Decline** and do not log the role.
3. Stop when **"You're all caught up! No more matches for today"** appears.

## Handshake

**Script:** `scripts/sources/handshake.ts` · **Lib:** `scripts/lib/handshake.ts`

1. Open `https://app.joinhandshake.com/job-search`.
2. Apply filters: Full-Time, Job, Paid, Onsite/Remote/Hybrid, US visa sponsorship + OPT.
3. Search variations of Junior AI Engineering roles: `Junior AI Engineer`, `Agentic AI`, etc.
4. Skim against [elimination-rules.md](elimination-rules.md). Ignore roles where a rule is clearly met, and roles that list compensation as an hourly rate. If unclear, keep.
5. For each remaining role:
   - Open preview panel; rely on job description, not AI Summary badge.
   - Capture **Job URL** from address bar (`https://app.joinhandshake.com/jobs/{id}`).
   - Set **Source** to `Handshake`.
6. Stop a search variation at 10 relevant roles or when exhausted, then move to the next variation.

## Jack & Jill

**Script:** `scripts/sources/jackjill.ts` · **Lib:** `scripts/lib/jackjill.ts`

1. Open `https://app.jackandjill.ai/jack/dashboard/inbox`.
2. **Fill the inbox** to 10+ items using prompts from [jack-prompts.md](jack-prompts.md). Adapt and vary — do not send verbatim in order. Wait for Jack to finish each response before sending the next prompt.
3. **Review each role:** click **Review job →**; for each modal job:
   - Read the **View job post** link `href` as **Job URL** (not `?review=` URL).
   - Capture Company, Role, Location from modal header.
   - Set **Source** to `Jack & Jill`.
   - Skim against [elimination-rules.md](elimination-rules.md). If clearly mismatched, **Not for me**; otherwise **Track**. If unclear, **Track**.
4. Stop when all inbox items are reviewed.

**Daily clean-out (both surfaces):** after sourcing, run `tsx scripts/sources/jack-empty.ts`.
Full flow: [jack-kanban.md](jack-kanban.md).

## Dedup Against Application Tracker

Before logging to Notion, remove postings already tracked. See [notion-schema.md](notion-schema.md).

## Output

One row per posting in `sourced-jobs.md`:

| Field | Description |
|---|---|
| Company | Company name only |
| Role | Job title |
| Job URL | Direct link to the posting |
| Source | `Wobo`, `Handshake`, or `Jack & Jill` |
| Location | City / remote |
