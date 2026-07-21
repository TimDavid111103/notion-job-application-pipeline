# Fill References

Assets and lookup rules for form filling.  
Parsers: `scripts/lib/fill/fill-references.ts`, `scripts/lib/fill/ai-fill.ts`.

**Principle:** each question class has one owning path. For open-ended screening text, **`assets/answers.md` is the only source of truth.** Rank a seed for the form label (after aliases); optional live LLM may rewrite that seed for the JD. No seed hit → leave blank.

## Auto-fill vs AI-fill

| Class | Path | Source |
|-------|------|--------|
| Identity, contact, links, salary numbers, school **dates**, EEO, work auth, consent | **Auto-fill** | `personal-information.md` |
| Years band, proficiency (max for primary tech), tech/skill selects & radios | **Auto-fill** | `skills-profile.md` |
| Resume upload | **Auto-fill** | `documents/resume.pdf` |
| Cover letter textarea | **Template + AI tailoring** | `cover-letter.md` body; last paragraph placeholders from JD |
| Cover letter file upload | **Generated tailored PDF** | Fill placeholders → write `data/fill/cover-letters/{Name}-{Company}-cover-letter.pdf` → upload (never `cover-letter-template.pdf`) |
| Experience summary, screening essays, “describe / tell us / how have you…” | **AI-fill** | Rank `answers.md` seeds → optional LLM tailor → fill |
| Additional Information / anything else | **AI-fill alias** | Same answer as **“Please tell us about your relevant experience.”** in `answers.md` |

## Asset ownership

| Asset | Owns |
|------|------|
| `assets/personal-information.md` | Identity, contact, auth, EEO, logistics, salary numbers, school dates |
| `assets/skills-profile.md` | Years band, proficiency default, skills, tech stacks, outside-scope |
| `assets/answers.md` | **Sole SoT** for screening Q&A seeds by theme |
| `assets/projects.md` | Portfolio write-ups (extra context for LLM tailoring of seeds) |
| `assets/cover-letter.md` | Cover letter text template (static PDF twin for drafting only: `documents/cover-letter-template.pdf`) |
| `assets/documents/resume.pdf` | Resume file upload (required) |

Live PII copies are gitignored; schema template: `assets/personal-information.template.md`.

## `answers.md` retrieval (source of truth)

Themes in `answers.md` are **retrieval keys**. For each form label the engine:

1. Aliases catch-alls (Additional Information → relevant experience)
2. Ranks seeds with `rankAnswerExemplars` / `seedAnswerForLabel`
3. **No hit → leave blank** (e.g. “most interesting paper this month”) — do not invent
4. **Hit → fill** with interpolated seed; optional live LLM (`ANTHROPIC_API_KEY` / `OPENAI_API_KEY`) rewrites that seed using the JD

## Lookup order

1. Sensitive blocklist → skip (`sensitive_manual_only`)
2. **Auto-fill** owning asset (personal / skills / resume / cover letter)
3. **AI-fill** — `answers.md` seed required; then optional LLM or seed text
4. Else blank + handoff

## Policies

- **Salary** — midpoint of asset/posting range when a range exists; otherwise `Salary default`.
- **Experience / tech** — skills-profile defaults (years band, max proficiency for in-scope tech, primary > secondary, never outside scope).
- **Sponsorship** — “authorized **without** sponsorship?” → **No** when `Require visa sponsorship` is Yes (even if authorized to work). Plain “require sponsorship?” → asset value (`Yes`/`No`).
- **Yes/No clicks** — work authorization, sponsorship, and relocate/Bay Area questions are filled by clicking the matching Yes/No control (not by checking a lone unlabeled box).
- **Current company** — `N/A` when not employed (`Current company` in personal-information); overwrite ATS resume-parsed employers.
- **Portfolio URL** — GitHub profile URL (same as `GitHub` / `Portfolio URL` in personal-information), not project essay text.
- **Cover letter** — fill last-paragraph placeholders from the JD; textarea uses tailored text; file upload uses a generated PDF under `data/fill/cover-letters/` with a `{Name}-{Company}-cover-letter.pdf` filename. **Never** attach `cover-letter-template.pdf` with placeholders left in.
- **Resume** — canonical path only; fail fast if missing.
- **Sensitive** — never auto-fill SSN, passport, driver’s license, government ID, bank/card, passwords.
- **ATS junk** — delete resume-parsed work-experience rows before filling.
- **Open-ended without answers.md basis** — leave empty for handoff.
- **Additional Information** — always the relevant-experience answer from `answers.md`.

## Interpolation

`{company}`, `{role}`, `{jobMatch}` in answers seeds and AI prompts.
