---
name: job-aggregators
description: Sources junior / new-grad AI and software-engineering jobs from Wobo, Handshake, and Jack & Jill, then dedupes against the Notion Application Tracker and logs the new roles. Skips only obvious mismatches (light, keep-when-in-doubt). Use when sourcing, refreshing, or logging job postings, or when the user mentions these aggregators, data/sourced-jobs.md, or the Notion tracker.
disable-model-invocation: true
---

# Job Aggregators

Repeatable job-sourcing pipeline. Follow this runbook top to bottom in one pass.

**Execution:** Playwright npm scripts at repo root — not browser MCP tabs. Sessions in `.auth/` are reused headlessly; re-auth only on login/expired-session errors (step 0).

**Reference index:** [references/index.md](references/index.md) — one source of truth per topic.

```
source (scratch dedup)  →  dedup vs Notion  →  log new roles  →  run log
```

## Phase checklist

- [ ] Sessions verified (`test:access`)
- [ ] Scratch ensured (`ensureScratchFile` — preserves prior rows)
- [ ] Aggregators sourced → new rows in `data/sourced-jobs.md`
- [ ] Jack inbox + Saved emptied (`jack-empty.ts`)
- [ ] Notion dedup + payloads prepared
- [ ] New roles logged via `user-notion` MCP
- [ ] Run log written to `logs/{timestamp}.md`

---

## 0. Preflight — sessions

```bash
npm run test:access
```

Re-auth **only** the affected aggregator on failure, then re-run `test:access`. Details: [references/access.md](references/access.md).

---

## 1. Setup (first run only)

```bash
bash .cursor/skills/job-aggregators/scripts/setup.sh
```

---

## 2. Ensure scratch file

`npm run source:all` calls `ensureScratchFile()` automatically. Scratch file: `data/sourced-jobs.md` (persists across runs; **newest rows at top**).

Dedup and data shape: [references/data-contracts.md](references/data-contracts.md).

---

## 3. Source aggregators

```bash
npm run source:all
```

Escape hatches: [references/commands.md](references/commands.md). Per-aggregator behavior: [references/job-aggregators.md](references/job-aggregators.md).

### 3a. Light skip

Obvious mismatches only; when in doubt, keep. [references/elimination-rules.md](references/elimination-rules.md).

### 3b. Jack clean-out

```bash
npx tsx scripts/sources/jack-empty.ts
```

Both inbox and Saved kanban: [references/jack-kanban.md](references/jack-kanban.md). Env: [references/env-vars.md](references/env-vars.md).

---

## 4. Verify scratch

Confirm new rows match `SourcedJob`; report **new this run** vs **total in file**. Shape: [references/data-contracts.md](references/data-contracts.md).

---

## 5. Dedup vs Notion tracker

Query **full** tracker history. Drop if normalized Job URL **or** Company + Role already exists.

1. Read `user-notion` tool schemas (`query_database`).
2. `query_database` with database ID `32f1de14-69d8-803a-81ba-fb8cf47a1ccd` — **omit `filter`** (do not pass `filter: {}`).
3. Save JSON to `data/notion-tracker-snapshot.json`.

Rules: [references/notion-schema.md](references/notion-schema.md).

---

## 6. Prepare Notion payloads

```bash
npm run log:notion:deduped
```

Confirm console reports duplicates dropped. Do **not** use `log:notion` for normal runs.

---

## 7. Log via MCP

Agent calls `add_database_entry` (or `add_database_entries`) for each payload in `data/notion-payloads.json`. Database ID and properties: [references/notion-schema.md](references/notion-schema.md).

---

## 8. Report results

Per-aggregator counts, scratch/Notion dedup drops, rows logged, failures.

---

## 9. Run log

Write `.cursor/skills/job-aggregators/logs/{YYYY-MM-DDTHH-MM-SSZ}.md` — including partial/failed runs.

```bash
date -u +"%Y-%m-%dT%H-%M-%SZ"
```

Template: [references/run-log-template.md](references/run-log-template.md). Skim latest 1–2 logs at run start. No secrets in logs.

---

## Gotchas

[references/gotchas.md](references/gotchas.md)
