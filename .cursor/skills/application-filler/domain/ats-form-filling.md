# ATS Form Filling

Playwright heuristics for step 9. Implementation: `scripts/lib/fill/application-fill.ts`, `ai-fill.ts`.  
Field values: [fill-references.md](fill-references.md).

**Principle:** upload resume → strip ATS-injected work history → **auto-fill** structured fields from assets → **AI-fill** open-ended text (answers/projects + Notion JD) → cover letter from template → chat handoff.

**Additive ATS quirks:** prefer host-agnostic discovery and fill. When a site needs an extra selector or delete strategy, **add a fallback** — do not replace the generic path (so Greenhouse / Lever / Ashby / Breezy keep working).

## Flow per job

1. Navigate to Job URL; click Apply (host-specific table below)
2. Prep AI-fill: `data/fill/ai-answers.json` from page JD + assets, or live LLM via API keys
3. Discover fields (group questions for radios/checkboxes; `label[for]` / `data-field-path` when `id`/`name` missing)
4. Upload resume; wait for processing UI to settle
5. Strip ATS work-experience rows (Delete controls + clear leftover company/title/summary); fill education dates when present
6. Re-discover; auto-fill text / selects / multi-selects / consent / EEO / skills (overwrite ATS)
7. AI-fill open-ended textareas — never paste raw `answers.md` exemplars alone
8. Cover letter: `cover-letter.md` (textarea) or `cover-letter-template.pdf` (file)
9. Chat handoff — AskQuestion: Applied / Invalid / Feedback (`AUTO_PAUSE` off)

## Host-specific Apply navigation

| Host | Apply trigger |
|------|----------------|
| `greenhouse.io` | Link/button "Apply" |
| `jobs.lever.co` | Link "Apply" |
| `jobs.ashbyhq.com` | Link/button with `application` in href |
| Other | First button/link matching `/apply/i` |

## Submission

**Do not submit** unless `AUTO_SUBMIT=1` (default off).

## Scope

**In:** Greenhouse, Lever, Ashby, Workday (basic), Breezy/generic fallback.  
**Out:** Handshake in-app apply, multi-page Workday wizards, account creation.
