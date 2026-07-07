# Reference Index

**Runbook:** [SKILL.md](../SKILL.md) — follow steps 0–11 top to bottom.  
**Rule:** one source of truth per topic; link instead of duplicating.

## Topic index

| Topic | File |
|---|---|
| npm / tsx commands | [pipeline-commands.md](pipeline-commands.md) |
| Repo script layout | [repository-scripts-map.md](repository-scripts-map.md) |
| `SourcedJob`, scratch file, dedup, `data/` artifacts | [scratch-data-formats.md](scratch-data-formats.md) |
| Env vars and job limits | [environment-variables.md](environment-variables.md) |
| Auth, URLs, selectors | [auth-and-selectors.md](auth-and-selectors.md) |
| Per-aggregator sourcing behavior | [aggregator-sourcing-spec.md](aggregator-sourcing-spec.md) |
| Notion tracker, dedup, MCP logging | [notion-tracker-logging.md](notion-tracker-logging.md) |
| Light skip heuristics | [light-skip-heuristics.md](light-skip-heuristics.md) |
| Borderline keep/reject judgement | [job-curation-judgement.md](job-curation-judgement.md) |
| Jack inbox prompts | [jack-inbox-prompts.md](jack-inbox-prompts.md) |
| Jack inbox + Saved kanban clean-out | [jack-kanban-cleanup.md](jack-kanban-cleanup.md) |
| Run log filename + template | [run-log-template.md](run-log-template.md) |
| Topic pointer index | [topic-pointer-index.md](topic-pointer-index.md) |

## Skill file catalog

Every path under `.cursor/skills/job-aggregators/`:

| Path | Purpose |
|---|---|
| [SKILL.md](../SKILL.md) | Orchestration runbook — step order, commands, overviews |
| [scripts/setup.sh](../scripts/setup.sh) | First-run wrapper → repo `scripts/setup.sh` |
| [logs/](../logs/) | Run logs (`*.md` gitignored; newest-first by filename) |
| [logs/.gitkeep](../logs/.gitkeep) | Keeps `logs/` in git |
| [references/reference-index.md](reference-index.md) | This file — topic + file catalog |
| [references/pipeline-commands.md](pipeline-commands.md) | All npm/tsx commands |
| [references/repository-scripts-map.md](repository-scripts-map.md) | Repo `scripts/` layout |
| [references/scratch-data-formats.md](scratch-data-formats.md) | Data types, scratch, dedup, artifacts |
| [references/environment-variables.md](environment-variables.md) | Environment variables |
| [references/auth-and-selectors.md](auth-and-selectors.md) | Auth, URLs, selectors |
| [references/aggregator-sourcing-spec.md](aggregator-sourcing-spec.md) | Wobo / Handshake / Jack sourcing spec |
| [references/notion-tracker-logging.md](notion-tracker-logging.md) | Notion schema, dedup, MCP workflow |
| [references/light-skip-heuristics.md](light-skip-heuristics.md) | Light skip heuristics |
| [references/job-curation-judgement.md](job-curation-judgement.md) | Deep keep/reject judgement |
| [references/jack-inbox-prompts.md](jack-inbox-prompts.md) | Example Jack inbox search prompts |
| [references/jack-kanban-cleanup.md](jack-kanban-cleanup.md) | Jack clean-out flow + kanban DOM |
| [references/run-log-template.md](run-log-template.md) | Run log content template |
| [references/topic-pointer-index.md](topic-pointer-index.md) | Pointer index to canonical refs |

**Repo (outside skill):** Playwright scripts in `scripts/`; runtime data in `data/` (gitignored).
