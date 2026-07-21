# Fill References

Assets and lookup rules for form filling.  
Parsers: `scripts/lib/fill/fill-references.ts`, `scripts/lib/fill/ai-fill.ts`.

**Principle:** each question class has one owning path — **auto-fill** from assets, or **AI-fill** from answers/projects + the Notion job description. Do not paste raw exemplars into open-ended fields without JD-aware generation. **Open-ended fields with no `answers.md` retrieval hit stay blank** (handoff) — do not invent answers in `ai-answers.json` or via LLM.

## Auto-fill vs AI-fill

| Class | Path | Source |
|-------|------|--------|
| Identity, contact, links, salary numbers, school **dates**, EEO, work auth, consent | **Auto-fill** | `personal-information.md` |
| Years band, proficiency (max for primary tech), tech/skill selects & radios | **Auto-fill** | `skills-profile.md` |
| Resume upload | **Auto-fill** | `documents/resume.pdf` |
| Cover letter textarea | **Template + AI tailoring** | `cover-letter.md` body; last paragraph placeholders from JD |
| Cover letter file upload | **Auto-fill** | `documents/cover-letter-template.pdf` |
| Experience summary, screening essays, “describe / tell us / how have you…” | **AI-fill** | `answers.md` + `projects.md` **seed** + Notion JD → `data/fill/ai-answers.json` or live LLM |
| Additional Information / anything else | **AI-fill alias** | Same answer as **“Please tell us about your relevant experience.”** |

AI-fill only when `answers.md` ranks a seed for the (possibly aliased) question. Prefer writing `data/fill/ai-answers.json` in the agent run (step 9) from the page JD; optional `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` for live generation. Omit keys for form questions with no seed basis.

## Asset ownership

| Asset | Owns |
|------|------|
| `assets/personal-information.md` | Identity, contact, auth, EEO, logistics, salary numbers, school dates |
| `assets/skills-profile.md` | Years band, proficiency default, skills, tech stacks, outside-scope |
| `assets/answers.md` | Screening Q&A seeds by theme (**AI-fill only** — never paste raw except Additional Information → relevant-experience default) |
| `assets/projects.md` | Portfolio write-ups (**seed for AI-fill**) |
| `assets/cover-letter.md` | Cover letter text template (PDF twin: `documents/cover-letter-template.pdf`) |
| `assets/documents/resume.pdf` | Resume file upload (required) |

Live PII copies are gitignored; schema template: `assets/personal-information.template.md`.

## `answers.md` retrieval

Themes in `answers.md` are **retrieval keys**, not a fixed prompt order. For each form label the engine ranks seeds by question + theme overlap (`rankAnswerExemplars`), prefers distinct themes, and feeds the closest matches into AI-fill.

**No hit → leave blank.** Do not write `ai-answers.json` entries or call an LLM for questions with no ranked seed (e.g. “most interesting paper/blog this month”).

**Additional Information** (and close aliases) always resolve to the **relevant experience** Q&A — look up / tailor that seed, not a separate catch-all paragraph.

When writing `data/fill/ai-answers.json` by hand, map each open-ended form field to the closest theme in `answers.md`, adapt the seed to `{company}` / `{role}` / the Notion JD, and write the tailored text under that field’s label — do not copy a seed verbatim when the form question differs. For Additional Information, key the relevant-experience text under that canonical question (or the form label); never invent a thinner substitute.

## Lookup order

1. Sensitive blocklist → skip (`sensitive_manual_only`)
2. **Auto-fill** owning asset (personal / skills / resume / cover-letter template)
3. **AI-fill** for open-ended text — only with `answers.md` basis (ai-answers.json → LLM → Additional Information seed default → else blank + handoff)
4. Else blank + handoff

## Policies

- **Salary** — midpoint of asset/posting range when a range exists; otherwise `Salary default`.
- **Experience / tech** — skills-profile defaults (years band, max proficiency for in-scope tech, primary > secondary, never outside scope).
- **Sponsorship** — “authorized **without** sponsorship?” → **No** when `Require visa sponsorship` is Yes (even if authorized to work).
- **Current company** — `N/A` when not employed (`Current company` in personal-information); overwrite ATS resume-parsed employers.
- **Portfolio URL** — GitHub profile URL (same as `GitHub` / `Portfolio URL` in personal-information), not project essay text.
- **Cover letter** — full `cover-letter.md` body; only the last paragraph’s placeholders are JD-tailored (`[COMPANY]`, mission/value, two skills).
- **Resume** — canonical path only; fail fast if missing.
- **Sensitive** — never auto-fill SSN, passport, driver’s license, government ID, bank/card, passwords.
- **ATS junk** — delete resume-parsed work-experience rows before filling.
- **Open-ended without answers.md basis** — leave empty for handoff.
- **Additional Information** — always the relevant-experience answer.

## Interpolation

`{company}`, `{role}`, `{jobMatch}` in answers seeds and AI prompts.
