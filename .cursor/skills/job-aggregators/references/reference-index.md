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

Every reference file and how to reach it. **SKILL.md** links one entry-point ref per step;
other refs are reached via cross-links below or from code comments.

| File | Purpose | SKILL step | Also linked from |
|---|---|---|---|
| [reference-index.md](reference-index.md) | Topic + file catalog | intro | topic-pointer-index |
| [topic-pointer-index.md](topic-pointer-index.md) | Quick topic → canonical ref | — | reference-index |
| [auth-and-selectors.md](auth-and-selectors.md) | Auth, URLs, selectors | 0 | aggregator-sourcing-spec |
| [repository-scripts-map.md](repository-scripts-map.md) | Repo `scripts/` layout | — | aggregator-sourcing-spec |
| [scratch-data-formats.md](scratch-data-formats.md) | Data types, scratch, dedup, artifacts | 2, 4, 5, 9 | notion-tracker-logging |
| [aggregator-sourcing-spec.md](aggregator-sourcing-spec.md) | Wobo / Handshake / Jack sourcing | 3 | auth-and-selectors |
| [light-skip-heuristics.md](light-skip-heuristics.md) | Light skip during sourcing | — | aggregator-sourcing-spec |
| [job-curation-judgement.md](job-curation-judgement.md) | Borderline keep/reject | — | light-skip-heuristics, jack-kanban-cleanup |
| [jack-inbox-prompts.md](jack-inbox-prompts.md) | Jack inbox search prompts | — | aggregator-sourcing-spec, `jack/inbox.ts` |
| [pipeline-commands.md](pipeline-commands.md) | npm/tsx commands | — | aggregator-sourcing-spec |
| [environment-variables.md](environment-variables.md) | Env vars and job limits | — | pipeline-commands, `limits.ts` |
| [jack-kanban-cleanup.md](jack-kanban-cleanup.md) | Jack clean-out flow | 3b | aggregator-sourcing-spec |
| [notion-tracker-logging.md](notion-tracker-logging.md) | Notion schema, dedup, MCP | 6, 7, 8 | scratch-data-formats, `notion.ts` |
| [run-log-template.md](run-log-template.md) | Run log content template | 11 | reference-index |

Every path under `.cursor/skills/job-aggregators/`:

| Path | Purpose |
|---|---|
| [SKILL.md](../SKILL.md) | Orchestration runbook — step order, commands, overviews |
| [scripts/setup.sh](../scripts/setup.sh) | First-run wrapper → repo `scripts/setup.sh` |
| [logs/](../logs/) | Run logs (`*.md` gitignored; newest-first by filename) |
| [logs/.gitkeep](../logs/.gitkeep) | Keeps `logs/` in git |

**Repo (outside skill):** Playwright scripts in `scripts/`; runtime data in `data/` (gitignored).
