# Run Log Template

Every completed run (including partial or failed runs) must end with a log file in
`logs/`. Generate path at write time:

```bash
npm run run-log:basename:fill
```

Write under `.cursor/skills/job-application-fill/logs/`.

---

```markdown
# Run log — {YYYY-MM-DDTHH-MM-SSZ}

## Run metadata

| Field | Value |
|---|---|
| Started (UTC) | |
| Ended (UTC) | |
| Outcome | success / partial / failed |
| Commands run | |
| Env overrides | e.g. `HEADED=1`, `FILL_LIMIT=1` |

## Results

| Metric | Count |
|---|---|
| Eligible queried | |
| Queue built (has description) | |
| Filtered by user (session) | |
| URL health ok | |
| URL health broken / deletable | |
| Deleted from Notion | |
| Filled complete | |
| Filled partial | |
| Blocked / broken | |
| Status → In Progress | |
| Status → Applied | |

**Failures / errors:** (none, or per-row)

## Process notes

### 0 — Schema preflight
### 2 — References verified
### 6 — Human selection
### 9 — Headed fill

## Self-analysis — skill improvements

| Skill area | Issue | Proposed improvement | Priority |
|---|---|---|---|
| | | | |

**What worked:**

**Follow-ups:**
```
