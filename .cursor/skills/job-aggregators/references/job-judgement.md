# Job Judgement

The final keep/reject decision is **yours to make with judgement**, not a keyword match.
Hardcoded regex (`screeningSignals` in repo `scripts/lib/screening.ts`) exists only to **flag things
worth a second look** — it never eliminates a job on its own. Read the posting, weigh it against
the candidate profile below, and decide.

**Default bias: keep.** Sourcing is cheap; a missed good role is expensive. When a posting is
borderline or you're unsure, keep it and log to Notion. Only reject when the mismatch is clear
on a genuine read (not a keyword hit). For quick glances during sourcing, use
[elimination-rules.md](elimination-rules.md) instead.

## Candidate profile (what we're looking for)

- **Level:** junior / associate / new-grad / entry-level (roughly 0–2 years). Open to
  "software engineer" with no level stated.
- **Focus:** AI / ML engineering, agentic AI, LLM pipelines, RAG / vector search, workflow &
  process automation, LLM-powered internal tooling, eval / observability for LLM systems. Also
  plain software engineering roles that build AI features.
- **Sector:** AI-native startups *and* non-AI sectors (fintech, healthtech, legaltech, enterprise
  SaaS) where the work is specifically building AI/LLM features or automation.
- **Location:** US or Europe (UK, Germany, Netherlands, Ireland). Remote is fine.
- **Visa:** roles that sponsor (H-1B / OPT) are ideal. Absence of an explicit sponsorship
  statement is **not** grounds to reject — most postings say nothing either way.

## How to weigh a posting

Treat these as **factors**, not switches. A single negative factor rarely justifies a reject on
its own; combine them and use judgement.

### Keep when
- Title or description points at AI/ML/agentic/LLM/automation work, **or** it's a general
  software-engineering role with no seniority label.
- Level reads as entry/junior/associate/new-grad, or level is simply unstated.
- There's any plausible path for the candidate to do meaningful software/AI work in the role.

### Lean reject when (and only when it's clearly true on a real read)
- **Clearly senior.** The title or body states Senior / Staff / Principal / Lead / Director /
  Manager as the *level of the role*. Do **not** infer seniority from a long list of
  "nice-to-have" skills or years-of-experience bullets — many junior roles over-list requirements.
  The regex `senior-title` / `leadership-title` flag is an alert to go read the level, not a verdict.
- **Wrong domain.** The role has no plausible software/AI component at all (e.g. pure finance
  analyst, marketing coordinator, sales rep, non-technical ops/recruiting). If there's *any*
  credible software or AI angle, keep it. The `possible-non-tech` flag is an alert, not a verdict.
- **Explicitly unpaid.** The posting itself says unpaid / volunteer / no salary / stipend-only.
  A missing salary is not "unpaid." The `possibly-unpaid` flag just points you at the wording.
- **Clearly wrong level of pay/engagement for a full role** — e.g. a short hourly gig framed as
  a task, not a job. The `hourly-comp` flag means "check whether this is a real role"; plenty of
  legitimate roles quote an hourly rate, so read before rejecting.

## What the regex signals mean

`screeningSignals(title, description)` returns zero or more of these advisory flags. Each is a
**prompt to look closer**, never an auto-reject:

| Flag | What it caught | What to actually check |
| --- | --- | --- |
| `senior-title` | Senior/Staff/Principal/Lead/Sr in the title | Is the *role's level* senior, or is it a junior role that merely lists senior-ish skills? |
| `leadership-title` | Director/VP/Head/Manager in the title | Is this a people-management role, or an IC role that happens to contain the word? |
| `possible-non-tech` | Non-tech role words with no software/AI words nearby | Is there any real software/AI component? |
| `possibly-unpaid` | "unpaid"/"volunteer"/"stipend only" wording | Does the posting truly state it's unpaid? |
| `hourly-comp` | An hourly pay rate | Is this a real ongoing role or a one-off hourly task? |

If a job has flags but your read says it fits the profile, **keep it** and move on. If it has no
flags but clearly doesn't fit (regex can't catch everything), **reject it**. The flags inform you;
they don't decide for you.
