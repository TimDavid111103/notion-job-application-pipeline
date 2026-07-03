# Elimination Rules (job-aggregators)

> **Light skip only.** These are quick-skim heuristics during sourcing — not a filter or scoring
> step. The pipeline's job is to find postings and get them into Notion fast. **When in doubt,
> keep the role.**

Hardcoded regex (`screeningSignals` in repo `scripts/lib/scratch.ts`) only prints optional `⚠`
alerts for the items below; it **never** eliminates a job. For borderline cases or Saved-kanban
curation, see [job-judgement.md](job-judgement.md).

Apply at a glance — do not deep-read to confirm. Consider skipping a posting only if **any** of
the following is obvious on a genuine (not keyword) look:

1. **Wrong domain** — clearly not AI Engineering, Software Engineering, or agentic AI/workflows
   (e.g. finance analyst, marketing coordinator, sales rep, non-technical ops). If there is any
   plausible software or AI connection, keep it. (Regex alert: `possible-non-tech`.)

2. **Explicitly senior-level** — "Senior," "Staff," "Principal," or "Lead" describes the role's
   *level* in the title, or the description explicitly calls it senior-level. Do not infer
   seniority from responsibilities or tech requirements alone. (Regex alerts: `senior-title`,
   `leadership-title`.)

3. **Explicitly unpaid** — posting states unpaid or no compensation ("volunteer," "no salary,"
   "stipend only"). A missing salary is not "unpaid." (Regex alert: `possibly-unpaid`.)

4. **Hourly-only gig** (Handshake only) — compensation listed as an hourly rate for what is
   clearly a short task, not a full role. When unclear, keep. (Regex alert: `hourly-comp`.)

**Default: keep.** If none of the above is obviously true from a quick glance, log the role and
move on. A regex flag is a prompt to look closer — not a verdict.
