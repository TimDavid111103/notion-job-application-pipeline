---
name: job-aggregators
description: Sources junior / new-grad AI and software-engineering jobs from Wobo, Handshake, and Jack & Jill, then dedupes against the Notion Application Tracker and logs the new roles. Skips only obvious mismatches (light, keep-when-in-doubt). Use when sourcing, refreshing, or logging job postings, or when the user mentions these aggregators, sourced-jobs.md, or the Notion tracker.
disable-model-invocation: true
---

# Job Aggregators

Repeatable job-sourcing pipeline: find postings across Wobo, Handshake, and Jack & Jill, dedupe against the Notion Application Tracker, and log new roles. Follow this runbook top to bottom in one pass.

**Execution path:** Playwright npm scripts at repo root — not browser MCP tabs. All `npm`/`tsx` commands run from the directory containing `package.json`. Sessions in `.auth/` are reused headlessly; re-authenticate only when a run hits a login or expired-session error (see step 0).

```
source per aggregator  →  dedup vs Notion tracker  →  log new roles to Notion  →  run log + self-analysis
```

## Phase checklist

- [ ] Scratch file initialized (table header only)
- [ ] Each aggregator sourced → rows appended to `sourced-jobs.md`
- [ ] Jack inbox + Saved kanban emptied (`jack-empty.ts`)
- [ ] Merged list deduped vs full Notion history
- [ ] New roles logged via `user-notion` MCP `add_database_entry`
- [ ] Run log + self-analysis written to `.cursor/skills/job-aggregators/logs/{timestamp}.md`

---

## 0. Preflight — sessions (auth is fallback only)

Sessions live in `.auth/{wobo,handshake,jackjill}.json` and are reused on every run. **Do not re-authenticate as part of the normal flow.**

Verify sessions are valid:

```bash
npm run test:access
```

If a source script fails on a login screen or expired session, re-auth **only the affected aggregator**, then retry:

```bash
npm run auth:wobo          # or auth:handshake / auth:jackjill
npm run test:access
```

Auth URLs, credentials handling, selectors: [references/access.md](references/access.md)

---

## 1. Setup (first run only)

From repo root:

```bash
bash .cursor/skills/job-aggregators/scripts/setup.sh
```

Installs deps and the Playwright browser. Skip if already done.

---

## 2. Initialize scratch file

`npm run source:all` calls `initScratchFile()` automatically. The scratch file is `sourced-jobs.md` at repo root:

```
| Company | Role | Job URL | Source | Location |
|---|---|---|---|---|
```

Data contract and strict in-file dedup (`appendJobs` / `jobKey`): [references/pipeline-scripts.md](references/pipeline-scripts.md)

---

## 3. Source all aggregators

**Default — run all three sequentially (from repo root):**

```bash
npm run source:all
```

**Escape hatches:**

```bash
npm run source:all:parallel    # PARALLEL=1 — all three at once
npm run source:wobo              # single aggregator
npm run source:handshake
npm run source:jackjill
```

Per-aggregator steps, stop conditions, and output fields: [references/job-aggregators.md](references/job-aggregators.md). **Run via Playwright scripts** listed in [references/pipeline-scripts.md](references/pipeline-scripts.md), not manual browser MCP tabs.

| Aggregator | Script | Key behavior |
|---|---|---|
| Wobo | `scripts/sources/wobo.ts` | Dashboard feed; Save/Decline cards; read "View original" href |
| Handshake | `scripts/sources/handshake.ts` | `/job-search`; Full-Time/Paid/OPT filters; search variations |
| Jack & Jill | `scripts/sources/jackjill.ts` | Inbox review queue; fill inbox with prompts then review |

Jack inbox prompts: [references/jack-prompts.md](references/jack-prompts.md)

### 3a. Light skip while sourcing

At a glance, drop only obvious mismatches (clearly senior, clearly wrong domain, clearly unpaid). **When in doubt, keep.** Regex `screeningSignals` prints optional `⚠` alerts and **never** eliminates. No scoring engine.

Details: [references/elimination-rules.md](references/elimination-rules.md)

### 3b. Jack daily clean-out (both surfaces)

Jack has **two** job surfaces — inbox *and* auto-populated "Saved" kanban. Empty both so nothing carries over day-to-day:

```bash
tsx scripts/sources/jack-empty.ts
```

Full flow, selectors, gotchas: [references/jack-kanban.md](references/jack-kanban.md)

Escape hatches: see [references/env-vars.md](references/env-vars.md) (`HEADED`, `MAX`, `SKIP_INBOX`).

---

## 4. Verify scratch output

Read `sourced-jobs.md` and confirm rows match the `SourcedJob` shape:

| Field | Values |
|---|---|
| company, role, jobUrl, location | strings |
| source | `Wobo` \| `Handshake` \| `Jack & Jill` |

Check the sourcing summary printed by `source-all.ts` (includes `Run ID` for correlating with run logs).

---

## 5. Dedup against Notion tracker

Query the **full** tracker history (not just recent entries — postings resurface after a week). Drop a posting if its **normalized Job URL** *or* **Company + Role** already exists.

1. Read MCP tool schemas for `user-notion` (`get_database`, `query_database`).
2. Call `query_database` with database ID `32f1de14-69d8-803a-81ba-fb8cf47a1ccd` and empty filter `{}` (full history).
3. Apply dedup logic from `dedupeAgainstNotion` / `normalizeJobUrl` in repo `scripts/lib/notion.ts`.

Dedup rules and schema: [references/notion-schema.md](references/notion-schema.md)

> **Location = Source:** the tracker's **Location** select stores the aggregator source (`Wobo`, `Handshake`, `Jack & Jill`), not geographic location. Do not "fix" this silently.

---

## 6. Prepare Notion payloads

After dedup, write payloads for MCP:

```bash
npm run log:notion
```

Reads `sourced-jobs.md` and writes `notion-payloads.json` for jobs that passed step 5 dedup. Payload shape: [references/pipeline-scripts.md](references/pipeline-scripts.md)

---

## 7. Log new roles via MCP

The scripts **prepare** payloads; the agent performs MCP calls.

1. Read `user-notion` tool descriptors (`get_database`, `query_database`, `add_database_entry`).
2. Optionally call `get_database` to confirm property names and select options.
3. For each payload in `notion-payloads.json`, call `add_database_entry` with `database_id` and `properties`.

Database ID (MCP-accessible): `32f1de14-69d8-803a-81ba-fb8cf47a1ccd`  
Data source ID (user-specified): `32f1de14-69d8-8016-9135-000ba274e2bd`

For batch inserts, `add_database_entries` is available as an alternative.

---

## 8. Report results

Summarize for the user:

- Rows sourced (per aggregator if available)
- Rows dropped by scratch dedup / Notion dedup
- Rows logged to Notion
- Any aggregator failures, timeouts, or auth issues

---

## 9. Run log and self-analysis

At the **end of every run** — including partial or failed runs — write a log file to
`.cursor/skills/job-aggregators/logs/` using a UTC timestamp filename so files auto-sort chronologically:

```
.cursor/skills/job-aggregators/logs/2026-07-03T17-33-00Z.md
```

Filename format: `YYYY-MM-DDTHH-MM-SSZ.md` (generate with `date -u +"%Y-%m-%dT%H-%M-%SZ"`).

Each log must capture:

1. **Results** — per-aggregator counts, dedup totals, Notion rows logged, failures/errors.
2. **Process notes** — what happened at each phase that ran (blockers, surprises, timing).
3. **Self-analysis** — which parts of the skill (`SKILL.md`, `references/*`, repo scripts)
   caused friction or could be improved, with concrete proposed changes and priority.

Use the full template: [references/run-log-template.md](references/run-log-template.md)

Optionally skim the latest 1–2 logs in `.cursor/skills/job-aggregators/logs/` at the start of a new run to avoid
repeating known issues. Do not log secrets (passwords, tokens, `.auth/` contents).

---

## Environment variables

Full table: [references/env-vars.md](references/env-vars.md)

---

## Gotchas

- **Keep elimination light** — skip obvious mismatches only; when in doubt, keep. No scoring engine.
- **Jack has two surfaces** — inbox and Saved kanban; empty both daily. Tracking an inbox job moves it to Saved; scratch dedup collapses overlap.
- **Never overwrite a Jack prompt while generating** — use condition-based waits, not fixed timers.
- **Strict scratch dedup** (`appendJobs`/`jobKey`) prevents quota-padding by duplicates.
- **`locator.isVisible()` does not wait** — use `waitFor({ state: "visible" })` on SPAs.
- **Scope Jack DOM to the right pane** (x > ~520); the chat feed has look-alike buttons.
- **Process hygiene** — `closeBrowser` + detached process-group kill in `source-all.ts` prevent hung Node processes.

More context: [references/jack-kanban.md](references/jack-kanban.md)

---

## Additional resources (background, not required steps)

- [references/access.md](references/access.md) — auth, URLs, selectors, limits
- [references/job-judgement.md](references/job-judgement.md) — extended keep/reject notes for borderline postings
- [references/pipeline-scripts.md](references/pipeline-scripts.md) — npm commands, script map, data contracts
- [references/run-log-template.md](references/run-log-template.md) — run log format and self-analysis template
