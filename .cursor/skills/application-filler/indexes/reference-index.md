# Reference Index

**Runbook:** [SKILL.md](../SKILL.md) — follow steps 0–12 top to bottom.  
**Rule:** one source of truth per topic; link instead of duplicating.

## Topic index

| Topic | Canonical file |
|---|---|
| Agent sandbox / Playwright runtime | [protocol/agent-runtime.md](../protocol/agent-runtime.md) |
| npm commands | [protocol/pipeline-commands.md](../protocol/pipeline-commands.md) |
| Repository script layout | [protocol/repository-scripts-map.md](../protocol/repository-scripts-map.md) |
| Environment variables and limits | [protocol/environment-variables.md](../protocol/environment-variables.md) |
| Tracker schema | [notion/tracker-schema.md](../notion/tracker-schema.md) |
| Shared Notion tracker | [docs/shared/notion-tracker.md](../../../../docs/shared/notion-tracker.md) |
| MCP query / update / delete | [notion/mcp-workflows.md](../notion/mcp-workflows.md) |
| Queue, session, and results JSON | [contracts/data-formats.md](../contracts/data-formats.md) |
| Run log filename and template | [contracts/run-log-template.md](../contracts/run-log-template.md) |
| Fill reference lookup | [domain/fill-references.md](../domain/fill-references.md) |
| ATS form filling | [domain/ats-form-filling.md](../domain/ats-form-filling.md) |
| Human-in-the-loop decisions | [domain/human-in-the-loop.md](../domain/human-in-the-loop.md) |
| URL health policy | [docs/shared/url-health-policy.md](../../../../docs/shared/url-health-policy.md) |
| Data cleanup policy | [docs/shared/data-cleanup.md](../../../../docs/shared/data-cleanup.md) |
| Quick topic pointers | [indexes/topic-pointer-index.md](topic-pointer-index.md) |

## Folder catalog

| Folder | Contents |
|---|---|
| `indexes/` | This catalog and the quick topic-pointer index |
| `protocol/` | Commands, repository map, environment, agent runtime |
| `notion/` | Tracker schema and MCP workflows |
| `contracts/` | Fill data formats and run-log template |
| `domain/` | ATS filling, human handoff, reference lookup |
| `assets/` | Personal information, projects, answers, skills profile, resume, cover letter |
| `logs/` | Per-run logs |
| `scripts/` | First-run setup wrapper |

## Assets

| File | Purpose |
|---|---|
| [personal-information.md](../assets/personal-information.md) | Live standard form values |
| [personal-information.template.md](../assets/personal-information.template.md) | Versioned schema template |
| [projects.md](../assets/projects.md) | Project write-ups |
| [answers.md](../assets/answers.md) | **SoT** for screening Q&A seeds (open-ended AI-fill) |
| [cover-letter.md](../assets/cover-letter.md) | Cover letter text template |
| [skills-profile.md](../assets/skills-profile.md) | Experience defaults + tech/skills for selects |
| [documents/resume.pdf](../assets/documents/resume.pdf) | Required resume upload |
| [documents/cover-letter-template.pdf](../assets/documents/cover-letter-template.pdf) | Static draft twin only — never uploaded; runtime writes tailored PDFs under `data/fill/cover-letters/` |
