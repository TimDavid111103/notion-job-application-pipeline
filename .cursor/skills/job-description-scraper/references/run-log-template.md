# Run Log Template

Every completed run (including partial or failed runs) must end with a log file in
`logs/`. The filename uses an inverted UTC millisecond prefix so **ascending name
sort lists newest logs first**:

```
logs/9999997854321-2026-07-07T14-54-24Z.md
```

Generate the full path at write time:

```bash
npm run run-log:basename:scraper
```

Write under `.cursor/skills/job-description-scraper/logs/`. Implementation:
`scripts/lib/run-log.ts`, `scripts/lib/paths.ts` (`SCRAPER_RUN_LOGS_DIR`).

---

Copy the template below, fill every section, and save.

```markdown
# Run log — {YYYY-MM-DDTHH-MM-SSZ}

## Run metadata

| Field | Value |
|---|---|
| Started (UTC) | |
| Ended (UTC) | |
| Outcome | success / partial / failed |
| Commands run | list npm/tsx commands executed |
| Env overrides | e.g. `HEADED=1`, `SCRAPE_LIMIT=5` |

## Results

| Metric | Count |
|---|---|
| Unmatched queried (Job Match empty) | |
| Queue built (empty page body) | |
| Skipped (non-empty page body) | |
| Scraped ok | |
| Scraped broken | |
| Deletable (dead URLs) | |
| Appended to Notion | |
| Deleted from Notion | |

**Failures / errors:** (none, or per-row error codes)

## Process notes

Brief notes on what happened at each phase. Only include phases that ran.

### 0 — Schema preflight
(Job Match property confirmed)

### 1 — Setup
(skipped / first-time setup)

### 2 — Cleanup (before run)
(temp artifacts removed)

### 3 — Query unmatched
(snapshot row count)

### 4 — Build queue
(read_page checks, queue size)

### 5 — Scrape
(duration, timeout/login issues)

### 6 — Verify
(spot-check one ok row)

### 7 — Append
(MCP append count, errors)

### 8 — Delete
(deleted count)

### 9 — Cleanup (after run)
(temp artifacts removed)

## Self-analysis — skill improvements

| Skill area | Issue | Proposed improvement | Priority |
|---|---|---|---|
| | | | |

**What worked well:** (optional)

**Follow-up actions:** (optional)
```

## Rules

- **Always write a log** — even aborted runs.
- **One file per run** — do not append to prior logs.
- **Self-analysis is required** — even on clean runs.
- **Do not log secrets** — no tokens or session files.
- Optionally skim the newest 1–2 logs at run start.
