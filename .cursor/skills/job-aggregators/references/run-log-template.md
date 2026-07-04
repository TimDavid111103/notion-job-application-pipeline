# Run Log Template

Every completed run (including partial or failed runs) must end with a log file in
`logs/`. The filename is a UTC timestamp so files sort chronologically when listed:

```
logs/2026-07-03T17-33-00Z.md
```

Generate the filename at write time:

```bash
date -u +"%Y-%m-%dT%H-%M-%SZ"
```

Append `.md` and write under `.cursor/skills/job-aggregators/logs/`.

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
(row count, shape issues)

### 5 — Dedup
(tracker query size, duplicates found)

### 6–7 — Notion log
(payload count, MCP errors)

## Self-analysis — skill improvements

Review friction, confusion, or failures against the skill files (`SKILL.md`,
`references/*`, repo scripts). For each item:

| Skill area | Issue | Proposed improvement | Priority |
|---|---|---|---|
| e.g. `references/jack-kanban.md` | Saved column selector missed on slow load | Add explicit waitFor note before first card click | high |
| | | | |

**Skill areas to consider:**
- `SKILL.md` runbook steps (order, clarity, missing checks)
- `references/job-aggregators.md` (per-aggregator spec)
- `references/access.md` (auth, selectors)
- `references/jack-kanban.md` / `references/jack-prompts.md`
- `references/elimination-rules.md` / `references/job-judgement.md`
- Repo scripts — [scripts-map.md](scripts-map.md), [commands.md](commands.md)

**What worked well:** (optional — steps or references that were clear and effective)

**Follow-up actions:** (optional — concrete edits to make next run, if any should happen before the next sourcing run)
```

## Rules

- **Always write a log** — even aborted runs. Partial logs are valuable.
- **One file per run** — do not append to prior logs.
- **Self-analysis is required** — if the run was clean, say so and note minor polish ideas or confirm which references were sufficient.
- **Do not log secrets** — no passwords, session tokens, or full `.auth/` contents.
- **Prior logs** — optionally skim the latest 1–2 files in `logs/` at the start of a run to avoid repeating known issues.
