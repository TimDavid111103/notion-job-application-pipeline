# Reference Index

**Runbook:** [SKILL.md](../SKILL.md) — follow steps 0–10 top to bottom.  
**Rule:** one source of truth per topic; link instead of duplicating.

## Topic index

| Topic | File |
|---|---|
| npm / tsx commands | [pipeline-commands.md](pipeline-commands.md) |
| Repo script layout | [repository-scripts-map.md](repository-scripts-map.md) |
| Tracker schema (Job Match, Job URL) | [notion-tracker-schema.md](notion-tracker-schema.md) |
| MCP query / append / delete | [notion-mcp-workflows.md](notion-mcp-workflows.md) |
| Queue + results JSON, `data/` artifacts | [scrape-data-formats.md](scrape-data-formats.md) |
| URL extraction heuristics | [job-url-extraction.md](job-url-extraction.md) |
| Dead URL policy | [url-health-policy.md](url-health-policy.md) |
| Env vars and scrape limits | [environment-variables.md](environment-variables.md) |
| Run log filename + template | [run-log-template.md](run-log-template.md) |
| Topic pointer index | [topic-pointer-index.md](topic-pointer-index.md) |

## Skill file catalog

| File | Purpose | SKILL step | Also linked from |
|---|---|---|---|
| [reference-index.md](reference-index.md) | Topic + file catalog | intro | topic-pointer-index |
| [topic-pointer-index.md](topic-pointer-index.md) | Quick topic → canonical ref | — | reference-index |
| [notion-tracker-schema.md](notion-tracker-schema.md) | DB ID, properties, entry rules | 0, 3, 4 | notion-mcp-workflows |
| [notion-mcp-workflows.md](notion-mcp-workflows.md) | MCP query, read_page, append, delete | 3, 4, 7, 8 | scrape-data-formats |
| [scrape-data-formats.md](scrape-data-formats.md) | Queue/results JSON, artifacts | 2, 4, 6, 9 | notion-mcp-workflows |
| [job-url-extraction.md](job-url-extraction.md) | Playwright extraction heuristics | 5 | scrape-data-formats |
| [pipeline-commands.md](pipeline-commands.md) | npm/tsx commands | — | environment-variables |
| [repository-scripts-map.md](repository-scripts-map.md) | Repo `scripts/` layout | — | pipeline-commands |
| [environment-variables.md](environment-variables.md) | Env vars and scrape limits | — | pipeline-commands |
| [run-log-template.md](run-log-template.md) | Run log content template | 10 | reference-index |

Every path under `.cursor/skills/description-scraper/`:

| Path | Purpose |
|---|---|
| [SKILL.md](../SKILL.md) | Orchestration runbook — step order, commands, overviews |
| [scripts/setup.sh](../scripts/setup.sh) | First-run wrapper → repo `scripts/setup.sh` |
| [logs/](../logs/) | Run logs (`*.md` gitignored; newest-first by filename) |
| [logs/.gitkeep](../logs/.gitkeep) | Keeps `logs/` in git |

**Repo (outside skill):** Playwright scripts in `scripts/`; runtime data in `data/` (gitignored).
