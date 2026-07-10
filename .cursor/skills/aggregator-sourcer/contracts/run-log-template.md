# Run Log Template

Every completed run (including partial or failed runs) must end with a log file in
`logs/`. The filename uses an inverted UTC millisecond prefix so **ascending name
sort lists newest logs first** (matches scratch file ordering):

```
logs/9999997854321-2026-07-07T14-54-24Z.md
```

Generate the filename at write time:

```bash
npm run run-log:basename
```

Write under `.cursor/skills/aggregator-sourcer/logs/`. Implementation:
`scripts/lib/run-log.ts`.

Optional suffix before `.md` for debug notes (e.g. `-wobo-debug`):
`{sortKey}-{timestamp}-wobo-debug.md`.

---

Copy the template below, fill every section, and save. Be specific — vague notes don't
help improve the skill.

```markdown
# Run log — {YYYY-MM-DDTHH-MM-SSZ}

## Run metadata

| Field | Value |
|---|---|
| Started (UTC) | |
| Ended (UTC) | |
| Outcome | success / partial / failed |
| RUN_ID | from `source-all.ts` output, if sourcing ran |
| Commands run | list npm/tsx commands executed |
| Env overrides | e.g. `HEADED=1`, `JOB_LIMIT=5`, `PARALLEL=1` |

## Results

| Metric | Count |
|---|---|
| Wobo sourced | |
| Handshake sourced | |
| Jack & Jill sourced | |
| Jack clean-out (inbox + Saved) | |
| Scratch total rows | (cumulative in file) |
| Scratch unique jobs | (distinct `jobKey`; ≤ total rows) |
| Scratch new this run | |
| Scratch dedup skipped | (during sourcing + at append) |
| Notion dedup dropped | |
| Logged to Notion | |

**Failures / errors:** (none, or describe per aggregator with exit codes, timeouts, auth issues)

## Process notes

Brief notes on what happened at each phase. Only include phases that ran.

### 0 — Preflight
(session check, re-auth if needed)

### 1 — Setup
(skipped / first-time setup)

### 2 — Scratch ensure
(prior row count, duplicates pruned, date header updated)

### 3 — Source
(per-aggregator: duration, stop condition hit, surprises)

### 3b — Jack clean-out
(inbox count, Saved count, duplicates skipped)

### 4 — Verify scratch
(total rows, unique jobs by `jobKey`, new-this-run count, shape issues)

### 5 — Clear temp `data/` (before logging)
(everything removed except `sourced-jobs.md` + `.gitkeep`)

### 6 — Dedup
(tracker query size, duplicates found)

### 7–8 — Notion log
(payload count, MCP errors)

### 9 — Clear temp `data/` (after logging)
(everything removed except `sourced-jobs.md` + `.gitkeep`; confirm `data/` is clean)

## Self-analysis — skill improvements

Review friction, confusion, or failures against the skill files (`SKILL.md`,
`indexes/, protocol/, notion/, contracts/, and domain/`, repo scripts). For each item:

| Skill area | Issue | Proposed improvement | Priority |
|---|---|---|---|
| e.g. `domain/jack-kanban-cleanup.md` | Saved column selector missed on slow load | Add explicit waitFor note before first card click | high |
| | | | |

**Skill areas to consider:** see topic index in [reference-index.md](../indexes/reference-index.md).

**What worked well:** (optional — steps or references that were clear and effective)

**Follow-up actions:** (optional — concrete edits to make next run, if any should happen before the next sourcing run)
```

## Rules

- **Always write a log** — even aborted runs. Partial logs are valuable.
- **One file per run** — do not append to prior logs.
- **Self-analysis is required** — if the run was clean, say so and note minor polish ideas or confirm which references were sufficient.
- **Do not log secrets** — no passwords, session tokens, or full `.auth/` contents.
- **Prior logs** — optionally skim the first 1–2 files in `logs/` at the start of a run (newest at top) to avoid repeating known issues.
