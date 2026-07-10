---
name: application-filler
description: Headed Playwright application filling for Application Tracker jobs with Job Match set, descriptions present, and non-terminal Status. Pre-fills forms from personal-information.md, projects.md, and answers.md; updates Status to In Progress and Applied; removes dead URLs. Use when applying to jobs, filling applications, or running the fill pipeline.
disable-model-invocation: true
---

# Application Filler

Orchestration runbook — follow steps 0–12 in order. Full reference catalog:
[references/reference-index.md](references/reference-index.md)

Playwright npm scripts at repo root (not browser MCP tabs). **Headed by default** for this skill.

**Agent runtime (read first):** [references/agent-runtime.md](references/agent-runtime.md) —
sandbox kills Chrome; use `required_permissions: ["all"]` for browser steps; URL health is HTTP by default.

## Phase checklist

- [ ] 0 — Schema verified
- [ ] 1 — Setup (first run only)
- [ ] 2 — References verified
- [ ] 3 — Temp artifacts cleaned (before run)
- [ ] 4 — Eligible rows queried
- [ ] 5 — Fill queue built
- [ ] 6 — Human job selection (AskQuestion)
- [ ] 7 — URL health preflight
- [ ] 8 — Dead URLs deleted via MCP
- [ ] 9 — Applications filled (headed)
- [ ] 10 — Status updated via MCP
- [ ] 11 — Temp artifacts cleaned (after run)
- [ ] 12 — Results reported + run log written

---

## 0. Schema preflight

Confirm Application Tracker properties via MCP `get_database` (especially **Status**, **Job Match**).
Codified constants live in `scripts/lib/notion.ts`.

→ [notion-tracker-schema.md](references/notion-tracker-schema.md)

---

## 1. Setup (first run only)

Run **outside the Cursor sandbox** (needs Chromium download + real browser cache):

```bash
bash .cursor/skills/application-filler/scripts/setup.sh
```

→ [agent-runtime.md](references/agent-runtime.md)

---

## 2. References verified

Confirm these files exist and are populated. **Do not search the filesystem** for the resume — if missing, stop and ask the user to copy it.

- `references/personal-information.md` — standard form fields
- `references/projects.md` — project write-ups
- `references/answers.md` — screening Q&A exemplars
- `references/documents/resume.pdf` — resume for file uploads (required)

→ [fill-references.md](references/fill-references.md)

---

## 3. Cleanup (before run)

```bash
npm run cleanup:data
```

→ [fill-data-formats.md](references/fill-data-formats.md)

---

## 4. Query eligible rows

Query rows where **Job Match** is set and **Status** is not `Invalid`, `Rejected`, or `Applied`.
Save MCP `results` to `data/jobs-ready-to-apply.json`:

```bash
npm run write:jobs-ready-to-apply -- /path/to/mcp-query.json
```

→ [notion-mcp-workflows.md](references/notion-mcp-workflows.md)

---

## 5. Build fill queue

For each row, call MCP `read_page` (`max_blocks: 5`). Include only when page body has a
description (`!isEmptyPageMarkdown`) and Job URL is non-empty.

```bash
npm run write:fill-queue -- /path/to/queue-items.json
```

→ [fill-data-formats.md](references/fill-data-formats.md)

---

## 6. Human job selection

**Use AskQuestion** before filling. See decision tree:

→ [human-in-the-loop.md](references/human-in-the-loop.md)

Write selection to `data/fill-session.json` (page IDs + filter choices).

---

## 7. URL health preflight

Default is **HTTP fetch** (no browser — fast, sandbox-safe):

```bash
npm run check:url-health
```

Use Playwright only when needed (e.g. Handshake), **outside sandbox**:

```bash
URL_HEALTH_MODE=browser npm run check:url-health
```

→ [url-health-policy.md](references/url-health-policy.md)

---

## 8. Delete dead URLs via MCP

For each `status: "broken"` + `deletable: true` in `data/url-health-results.json`,
call MCP `delete_database_entry`.

→ [notion-mcp-workflows.md](references/notion-mcp-workflows.md)

---

## 9. Fill applications (headed)

Opens a visible browser, pre-fills fields, leaves the tab open. **Handoff is in chat** — use AskQuestion for Applied / Skip / Mark Invalid. Do **not** use Playwright inspector (`AUTO_PAUSE` is off by default).

**Must run outside the Cursor sandbox** (`required_permissions: ["all"]`).

```bash
HEADED=1 npm run fill:application
```

Before each job: MCP `update_database_entry` → Status `In Progress`.
After user confirms in chat: Status `Applied`.

→ [ats-form-filling.md](references/ats-form-filling.md)

---

## 10. Status updates via MCP

| Event | Status |
|-------|--------|
| Job opened for filling | `In Progress` |
| User confirms submission | `Applied` |
| User skips / invalid posting | `Invalid` (optional) |

→ [notion-mcp-workflows.md](references/notion-mcp-workflows.md)

---

## 11. Cleanup (after run)

```bash
npm run cleanup:data
```

---

## 12. Report + run log

```bash
npm run run-log:basename:fill
```

→ [run-log-template.md](references/run-log-template.md)
