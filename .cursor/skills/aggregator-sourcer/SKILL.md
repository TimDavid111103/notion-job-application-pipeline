---
name: aggregator-sourcer
description: Sources junior / new-grad AI and software-engineering jobs from Wobo, Handshake, and Jack & Jill, then dedupes against the Notion Application Tracker and logs the new roles. Skips only obvious mismatches (light, keep-when-in-doubt). Use when sourcing, refreshing, or logging job postings, or when the user mentions these aggregators, data/sourced-jobs.md, or the Notion tracker.
disable-model-invocation: true
---

# Aggregator Sourcer

Orchestration runbook — follow steps 0–11 in order. Full reference catalog:
[indexes/reference-index.md](indexes/reference-index.md)

Playwright npm scripts at repo root (not browser MCP tabs). Sourcing is **headed by
default** ([environment-variables.md](protocol/environment-variables.md)); re-auth only
when step 0 fails.

**Agent runtime (read first):** [protocol/agent-runtime.md](protocol/agent-runtime.md) —
browser commands require `required_permissions: ["all"]`.

## Hard rule — `data/` temp cleanup

**Run `npm run cleanup:data` at step 5 and again at step 9. Do not skip either pass.**
After each pass, confirm cleanup left only contracted permanent artifacts.

→ [docs/shared/data-cleanup.md](../../../docs/shared/data-cleanup.md)
→ [contracts/data-formats.md](contracts/data-formats.md) — scratch + source artifacts

## Phase checklist

- [ ] 0 — Sessions verified
- [ ] 1 — Setup (first run only)
- [ ] 2 — Scratch file ensured
- [ ] 3 — Aggregators sourced
- [ ] 3b — Jack inbox + Saved emptied
- [ ] 4 — Scratch verified
- [ ] 5 — **All temp `data/` files cleared (before logging)**
- [ ] 6 — Tracker snapshot saved
- [ ] 7 — Notion payloads prepared
- [ ] 8 — Rows logged via MCP
- [ ] 9 — **All temp `data/` files cleared (after logging)**
- [ ] 10 — Results reported
- [ ] 11 — Run log written

---

## 0. Preflight — sessions

Confirm `.auth/` sessions reach all three aggregators. Re-auth only the one that fails,
then re-run.

```bash
npm run test:access
```

→ [auth-and-selectors.md](domain/auth-and-selectors.md)

---

## 1. Setup (first run only)

Install dependencies, Playwright, session storage, and `data/`.

```bash
bash .cursor/skills/aggregator-sourcer/scripts/setup.sh
```

---

## 2. Ensure scratch file

`source:all` calls `ensureScratchFile()` before aggregators run — no separate command.
Prepares the rolling scratch window used for in-run dedup.

→ [contracts/data-formats.md](contracts/data-formats.md)

---

## 3. Source aggregators

Capture new postings from Wobo, Handshake, and Jack & Jill into the scratch file.

```bash
npm run source:all
```

→ [aggregator-sourcing-spec.md](domain/aggregator-sourcing-spec.md)

### 3b. Jack clean-out

After sourcing, empty Jack inbox and Saved kanban so nothing carries over.

```bash
npm run source:jack-empty
```

→ [jack-kanban-cleanup.md](domain/jack-kanban-cleanup.md)

---

## 4. Verify scratch

Confirm captured rows match the data contract. Report **total rows**, **unique jobs**
(distinct `jobKey` — can be fewer than rows), and **new this run** (today's date).

→ [contracts/data-formats.md](contracts/data-formats.md)

---

## 5. Clear all temporary `data/` files (before logging) — required

**Do this before any Notion snapshot or payload work.**

```bash
npm run cleanup:data
```

**Done when:** cleanup policy is satisfied — [docs/shared/data-cleanup.md](../../../docs/shared/data-cleanup.md).

---

## 6. Tracker snapshot (failsafe dedup input)

Query the full Notion Application Tracker via MCP and save the response for dedup.

→ [notion/mcp-workflows.md](notion/mcp-workflows.md) — query workflow

---

## 7. Prepare Notion payloads

Dedupe **today's** scratch rows against the snapshot; write MCP-ready rows to `data/source/notion-payloads.json`.
Older scratch rows are for sourcing dedup only.

```bash
npm run log:notion:deduped
```

→ [notion/mcp-workflows.md](notion/mcp-workflows.md) — payload file

---

## 8. Log via MCP

Insert prepared payloads into the tracker via `user-notion` MCP.

→ [notion/mcp-workflows.md](notion/mcp-workflows.md) — insert workflow

---

## 9. Clear all temporary `data/` files (after logging) — required

**Do this after MCP insert succeeds (or after you stop logging).**

```bash
npm run cleanup:data
```

**Done when:** cleanup policy is satisfied — [docs/shared/data-cleanup.md](../../../docs/shared/data-cleanup.md).
If anything else remains, run cleanup again or delete it manually before reporting.

---

## 10. Report results

Summarize per-aggregator counts, scratch rows vs unique jobs, Notion dedup drops, rows
logged, and any failures. Confirm step 9 left `data/` clean.

---

## 11. Run log

Write a run summary — required even for partial or failed runs.

```bash
npm run run-log:basename
```

→ [contracts/run-log-template.md](contracts/run-log-template.md)
