# Reference Index

**Runbook:** [SKILL.md](../SKILL.md) — follow steps 0–11 top to bottom.  
**Rule:** one source of truth per topic; link instead of duplicating.

## Topic index

| Topic | Canonical file |
|---|---|
| Agent sandbox / Playwright runtime | [protocol/agent-runtime.md](../protocol/agent-runtime.md) |
| npm commands | [protocol/pipeline-commands.md](../protocol/pipeline-commands.md) |
| Repository script layout | [protocol/repository-scripts-map.md](../protocol/repository-scripts-map.md) |
| Environment variables and limits | [protocol/environment-variables.md](../protocol/environment-variables.md) |
| Tracker schema and logging eligibility | [notion/tracker-schema.md](../notion/tracker-schema.md) |
| Snapshot, dedup, payload, and insert | [notion/mcp-workflows.md](../notion/mcp-workflows.md) |
| `SourcedJob`, scratch, dedup, and artifacts | [contracts/data-formats.md](../contracts/data-formats.md) |
| Run log filename and template | [contracts/run-log-template.md](../contracts/run-log-template.md) |
| Per-aggregator sourcing behavior | [domain/aggregator-sourcing-spec.md](../domain/aggregator-sourcing-spec.md) |
| Authentication, URLs, and selectors | [domain/auth-and-selectors.md](../domain/auth-and-selectors.md) |
| Jack inbox prompts | [domain/jack-inbox-prompts.md](../domain/jack-inbox-prompts.md) |
| Jack inbox and Saved cleanup | [domain/jack-kanban-cleanup.md](../domain/jack-kanban-cleanup.md) |
| Light skip heuristics | [domain/light-skip-heuristics.md](../domain/light-skip-heuristics.md) |
| Borderline curation judgement | [domain/job-curation-judgement.md](../domain/job-curation-judgement.md) |
| Data cleanup policy | [docs/shared/data-cleanup.md](../../../../docs/shared/data-cleanup.md) |
| Quick topic pointers | [indexes/topic-pointer-index.md](topic-pointer-index.md) |

## Folder catalog

| Folder | Contents |
|---|---|
| `indexes/` | This catalog and the quick topic-pointer index |
| `protocol/` | Commands, repository map, environment, agent runtime |
| `notion/` | Tracker schema and MCP sourcing/logging workflows |
| `contracts/` | Source data formats and run-log template |
| `domain/` | Aggregator behavior, auth/selectors, prompts, cleanup, curation |
| `logs/` | Per-run logs |
| `scripts/` | First-run setup wrapper |
