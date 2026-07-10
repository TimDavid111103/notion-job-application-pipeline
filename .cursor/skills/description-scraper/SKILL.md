---
name: description-scraper
description: Scrapes job descriptions from Application Tracker entries that have no Job Match and empty page body, appends descriptions to Notion page content, and deletes entries with dead URLs. Use when enriching tracker rows, scraping job URLs, or when the user mentions job descriptions, Job Match, or description scraping.
disable-model-invocation: true
---

# Description Scraper

Orchestration runbook — follow steps 0–10 in order. Full reference catalog:
[references/reference-index.md](references/reference-index.md)

Playwright npm scripts at repo root (not browser MCP tabs). Headless by default.

## Phase checklist

- [ ] 0 — Schema verified
- [ ] 1 — Setup (first run only)
- [ ] 2 — Temp artifacts cleaned (before run)
- [ ] 3 — Unmatched rows queried
- [ ] 4 — Scrape queue built
- [ ] 5 — Descriptions scraped
- [ ] 6 — Results verified
- [ ] 7 — Content appended via MCP
- [ ] 8 — Dead URLs deleted via MCP
- [ ] 9 — Temp artifacts cleaned (after run)
- [ ] 10 — Results reported + run log written

---

## 0. Schema preflight

Confirm Application Tracker properties via MCP `get_database` (especially **Job Match**).
Codified constants live in `scripts/lib/notion.ts`.

→ [notion-tracker-schema.md](references/notion-tracker-schema.md)

---

## 1. Setup (first run only)

Install dependencies, Playwright, and `data/`.

```bash
bash .cursor/skills/description-scraper/scripts/setup.sh
```

---

## 2. Cleanup (before run)

Clear stale temporary `data/` files from prior runs.

```bash
npm run cleanup:data
```

→ [scrape-data-formats.md](references/scrape-data-formats.md) — runtime artifacts

---

## 3. Query unmatched rows

Query Application Tracker entries where **Job Match** is empty. Save the MCP `results`
array to `data/jobs-needing-descriptions.json`:

```bash
npm run write:jobs-needing-descriptions -- /path/to/mcp-query.json
# or pipe MCP JSON: … | npm run write:jobs-needing-descriptions
```

→ [notion-mcp-workflows.md](references/notion-mcp-workflows.md) — query workflow

---

## 4. Build scrape queue

For each row in the snapshot, call MCP `read_page` (`max_blocks: 5`). Include a row in
`data/notion-scrape-queue.json` only when **both** are true:

1. Job Match is empty (already filtered in step 3).
2. Page body is empty (`isEmptyPageMarkdown` in `scripts/lib/notion.ts`).

Write the queue envelope (requires step 3 snapshot on disk):

```bash
npm run write:scrape-queue -- /path/to/queue-items.json
```

→ [scrape-data-formats.md](references/scrape-data-formats.md) — queue file

---

## 5. Scrape descriptions

Visit each Job URL in the queue and extract posting text.

```bash
npm run scrape:descriptions
```

→ [job-url-extraction.md](references/job-url-extraction.md)

---

## 6. Verify results

Report **queued**, **ok**, **broken**, and **deletable** counts from
`data/scrape-results.json` → `summary`. Spot-check one `ok` row in `items` for sensible
content length and markdown structure.

→ [scrape-data-formats.md](references/scrape-data-formats.md) — results file

---

## 7. Append via MCP

For each `status: "ok"` row, call MCP `append_content` with the prepared markdown.

→ [notion-mcp-workflows.md](references/notion-mcp-workflows.md) — append workflow

---

## 8. Delete dead URLs via MCP

For each `status: "broken"` row, call MCP `delete_database_entry`.

→ [notion-mcp-workflows.md](references/notion-mcp-workflows.md) — delete workflow

---

## 9. Cleanup (after run)

Remove snapshot, queue, and results files. Only permanent `data/` files remain.

```bash
npm run cleanup:data
```

→ [scrape-data-formats.md](references/scrape-data-formats.md) — runtime artifacts

---

## 10. Report + run log

Summarize queue size, scrape outcomes, append/delete counts, and failures.

```bash
npm run run-log:basename:scraper
```

→ [run-log-template.md](references/run-log-template.md)
