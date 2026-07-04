# Jack & Jill — Inbox + Jobs-tab daily clean-out

Goal (per day): leave **both** the Jack inbox **and** the Jobs-tab "Saved" column
completely empty — every good job moved to `sourced-jobs.md`, everything else
archived / skipped — so nothing carries over day-to-day.

Runner: `npx tsx scripts/sources/jack-empty.ts` → `scripts/lib/jack/inbox.ts` + `scripts/lib/jack/kanban.ts`

## The two surfaces (important mental model)

Jack has **two** places jobs live, and they overlap:

1. **Inbox** (`/jack/dashboard/inbox`) — a review queue. Each search batch shows a
   "Review job" button that opens a modal (one or many jobs). You **Track** (keep)
   or say **Not for me** (reject).
2. **Jobs tab → kanban** (`/jack/dashboard/jobs/kanban`) — columns
   **Saved · Applied · In Process · Offer** (+ hidden Archived). Jack **auto-saves
   many web-sourced jobs straight into "Saved"** without them ever hitting the
   inbox. This is why the inbox only ever shows a few while "Saved" can have 100+.

Key relationships:
- **Tracking an inbox job moves it into the "Saved" column.** Daily order: inbox first
  (Track good / reject bad) → then empty Saved (archives everything, capturing keepers).
  Tracked jobs may be captured twice; scratch-file strict dedup collapses them.
- **Duplicates exist between inbox and Saved** — `jobKey` in `scripts/lib/job.ts` / scratch dedup handles overlap.

## Daily flow

1. **Empty the inbox** (`reviewInbox`): loop over every "Review job" button; for each
   modal walk its jobs — **Track** keepers, **Not for me** the rest. Rejecting pops a
   **"Skipping this one?"** confirmation whose **"Skip this role"** button must be
   clicked. Keepers are appended to the scratch file.
2. **Empty the Saved column** (`emptySavedColumn`): repeatedly take the first Saved
   card → open it → expand **right-pane** "Show details" → read role/company/URL →
   judge → if keep, collect for the scratch file → open the status control → **Archive**
   → return to the board. Repeat until the column is 0.
3. Prepend keepers via `appendJobs` (strict dedup, newest at top).

## Selectors / DOM facts

- Kanban board: `https://app.jackandjill.ai/jack/dashboard/jobs/kanban`
  (bare `/jobs` redirects here; `/saved` is a 404).
- Saved column header text is `Saved{N}` (e.g. `Saved122`); it lives in the right
  half of the screen (x > ~520). The left sidebar "Recent jobs" also link to
  `/jobs/kanban/{uuid}` — **do not** confuse them with board cards.
- Saved card: `div[role="button"][aria-roledescription="sortable"]` inside the
  column; text is `{Role}{Company}{Xd ago}`. Clicking opens the detail view at
  `/jobs/kanban/{uuid}` and **replaces the board** in the right pane — you must
  return to the board afterward (SPA breadcrumb link
  `a[href="/jack/dashboard/jobs/kanban"]`, faster than a full reload).
- Detail role+company: breadcrumb `Jobs{Role} at {Company}` (split on last " at ").
- Apply URL: right-pane `a` with text **"View job post"** — only renders after
  clicking the **right-pane** "Show details" (there is a *second* "Show details" in
  the chat feed; pick the one with boundingRect.x > 520). URLs carry
  `?utm_source=jackandjill` (or an Otta code) — normalized away by dedup.
- Status control: right-pane button showing the current status ("Saved") / a
  `svg.lucide-star`; clicking opens a menu with **Saved / Applied / In Process /
  Offer / Archive**. Pick `menuitem` "Archive".
- Inbox: `getByRole("button", { name: /review job/i })`; count via
  `[aria-label*="jobs to review"]`. Reject confirmation: button `/skip this role/i`.
  Keyboard shortcuts exist in the modal (T = Track, N = Not for me, ←/→ navigate).

## Gotchas

- **`locator.isVisible()` does NOT wait** — use `waitFor({ state: "visible", timeout })`.
- Right pane vs chat feed both contain job cards + "Show details"/"Track" buttons.
  Scope everything to the right pane by screen x (> ~520).
- Clicking a Saved card swaps board → detail; re-open the board each iteration.
- Prefer condition waits over fixed sleeps.
- **Never overwrite a Jack prompt while it's still generating** — wait for response to finish.
- **Judgement is the agent's job, not regex.** `screeningSignals` only prints `⚠` flags.
  Accept/reject uses [elimination-rules.md](elimination-rules.md) at a glance or
  [job-judgement.md](job-judgement.md) for deeper reads. Do not re-add a keyword filter as the sole gate.
- Jack yields ~1–3 jobs per inbox prompt; the Saved column is the real volume. Prefer
  draining Saved over over-prompting when hitting a job limit.
