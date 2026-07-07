---
name: job-aggregators
description: Sources junior / new-grad AI and software-engineering jobs from Wobo, Handshake, and Jack & Jill, then dedupes against the Notion Application Tracker and logs the new roles. Skips only obvious mismatches (light, keep-when-in-doubt). Use when sourcing, refreshing, or logging job postings, or when the user mentions these aggregators, data/sourced-jobs.md, or the Notion tracker.
disable-model-invocation: true
---

# Job Aggregators

Orchestration runbook — follow steps 0–11 in order. Full reference catalog:
[references/reference-index.md](references/reference-index.md)

Playwright npm scripts at repo root (not browser MCP tabs). Headless by default; re-auth only
when step 0 fails.

## Phase checklist

- [ ] 0 — Sessions verified
- [ ] 1 — Setup (first run only)
- [ ] 2 — Scratch file ensured
- [ ] 3 — Aggregators sourced
- [ ] 3b — Jack inbox + Saved emptied
- [ ] 4 — Scratch verified
- [ ] 5 — Temp artifacts cleaned (before logging)
- [ ] 6 — Tracker snapshot saved
- [ ] 7 — Notion payloads prepared
- [ ] 8 — Rows logged via MCP
- [ ] 9 — Temp artifacts cleaned (after logging)
- [ ] 10 — Results reported
- [ ] 11 — Run log written

---

## 0. Preflight — sessions

Confirm `.auth/` sessions reach all three aggregators. Re-auth only the one that fails,
then re-run.

```bash
npm run test:access
```

→ [auth-and-selectors.md](references/auth-and-selectors.md)

---

## 1. Setup (first run only)

Install dependencies, Playwright, session storage, and `data/`.

```bash
bash .cursor/skills/job-aggregators/scripts/setup.sh
```

---

## 2. Ensure scratch file

`source:all` calls `ensureScratchFile()` before aggregators run — no separate command.
Prepares the rolling scratch window used for in-run dedup.

→ [scratch-data-formats.md](references/scratch-data-formats.md)

---

## 3. Source aggregators

Capture new postings from Wobo, Handshake, and Jack & Jill into the scratch file.

```bash
npm run source:all
```

→ [aggregator-sourcing-spec.md](references/aggregator-sourcing-spec.md)

### 3b. Jack clean-out

After sourcing, empty Jack inbox and Saved kanban so nothing carries over.

```bash
npx tsx scripts/sources/jack-empty.ts
```

→ [jack-kanban-cleanup.md](references/jack-kanban-cleanup.md)

---

## 4. Verify scratch

Confirm captured rows match the data contract. Report **total rows**, **unique jobs**
(distinct `jobKey` — can be fewer than rows), and **new this run** (today's date).

→ [scratch-data-formats.md](references/scratch-data-formats.md)

---

## 5. Cleanup (before logging)

Clear stale temporary `data/` files from prior runs. Permanent scratch is untouched.

```bash
npm run cleanup:data
```

→ [scratch-data-formats.md](references/scratch-data-formats.md) — runtime artifacts

---

## 6. Tracker snapshot (failsafe dedup input)

Query the full Notion Application Tracker via MCP and save the response for dedup.

→ [notion-tracker-logging.md](references/notion-tracker-logging.md) — query workflow

---

## 7. Prepare Notion payloads

Dedupe **today's** scratch rows against the snapshot; write MCP-ready rows to `data/notion-payloads.json`.
Older scratch rows are for sourcing dedup only.

```bash
npm run log:notion:deduped
```

→ [notion-tracker-logging.md](references/notion-tracker-logging.md) — payload file

---

## 8. Log via MCP

Insert prepared payloads into the tracker via `user-notion` MCP.

→ [notion-tracker-logging.md](references/notion-tracker-logging.md) — insert workflow

---

## 9. Cleanup (after logging)

Remove snapshot and payload files from this run. Only the scratch file should remain.

```bash
npm run cleanup:data
```

→ [scratch-data-formats.md](references/scratch-data-formats.md) — runtime artifacts

---

## 10. Report results

Summarize per-aggregator counts, scratch rows vs unique jobs, Notion dedup drops, rows
logged, and any failures.

---

## 11. Run log

Write a run summary — required even for partial or failed runs.

```bash
npm run run-log:basename
```

→ [run-log-template.md](references/run-log-template.md)
