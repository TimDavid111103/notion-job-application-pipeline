# ATS Form Filling

Playwright heuristics for step 9. Implementation: `scripts/lib/fill/application-fill.ts`, `ai-fill.ts`.  
Field values: [fill-references.md](fill-references.md).

**Principle:** upload resume → strip ATS-injected work history → **auto-fill** structured fields from assets → **AI-fill** open-ended text (answers/projects + Notion JD) → cover letter from template → chat handoff.

**Anti-bot launch (keep these):** CDP-attached system Chrome (not `chromium.launch`),
strip `--enable-automation`, `--disable-blink-features=AutomationControlled`, clear
Playwright markers (`__pwInitScripts`), set `navigator.webdriver` to `false`.

**Anti-bot input (`ANTI_BOT=1` or with `AUTO_SUBMIT=1`):** page warm-up scroll, mouse
move before fields, keystroke/clipboard paste instead of instant `.fill()`.

**Auto-submit (`AUTO_SUBMIT=1`):** disconnect CDP → macOS Accessibility click Submit →
reconnect and classify spam vs success. Requires Accessibility permission for Cursor.

**Workable quirks:** dismiss cookie banners first; prefer `input.labels` for field titles (wrapping labels); unlabeled required file inputs next to “Resume” still upload; convert annual salary → monthly when the label says per month; skip website NPS widgets.

**Yes/No (work auth, sponsorship, relocate):** map from `personal-information.md` via `matchYesNo`. Click the **Yes** or **No** control in that question’s field container (visible option button, radio, checkbox, or label) — never skip because the native input is visually hidden, and never click a page-wide “Yes” that belongs to another question.

## Flow per job

1. Navigate to Job URL; **dismiss cookie banners** (`Accept all cookies` / `Accept all` / etc.); click Apply (host-specific table below)
2. Open-ended fields: resolve from **`answers.md`** (optional LLM tailor to the JD). No seed hit → leave blank.
3. Discover fields (group questions for radios/checkboxes; `label[for]` / `data-field-path` when `id`/`name` missing)
4. Upload resume; wait for processing UI to settle
5. Strip ATS work-experience rows (Delete controls + clear leftover company/title/summary); fill education dates when present
6. Re-discover; auto-fill text / selects / multi-selects / consent / EEO / skills (overwrite ATS)
7. AI-fill open-ended textareas — only when `answers.md` ranks a seed; Additional Information uses relevant experience; never invent for unmatched questions
8. Cover letter: tailored `cover-letter.md` text (textarea) **or** generated PDF under `data/fill/cover-letters/` with placeholders filled and a proper filename (file) — never the static template PDF
9. Chat handoff — AskQuestion: Applied / Invalid / Feedback (`AUTO_PAUSE` off)

## Host-specific Apply navigation

| Host | Apply trigger |
|------|----------------|
| `greenhouse.io` | Link/button "Apply" |
| `jobs.lever.co` | Link "Apply" |
| `jobs.ashbyhq.com` | Link/button with `application` in href |
| `myworkdayjobs.com` | Apply → prefer Autofill with Resume |
| `jobs.workable.com` | Link/button "Apply" (after cookie accept) |
| `joinhandshake.com` | Button `Apply` / `aria-label=Apply` → wait for Apply modal (`Apply to…` / Submit Application) |
| Other | First button/link matching `/apply/i` |

## Submission

**Do not submit** unless `AUTO_SUBMIT=1` (default off).

## Scope

**Principle:** auto-fill hosts whose Apply → form path is under active headed hardening. Prefer one Chrome window; every job is a new tab.

**Proven in:** Greenhouse, Lever, Ashby, Workday (basic), Breezy/generic fallback.

**High priority — Handshake:** in-app Apply modal (not external ATS). Click **Apply** → modal with profile resume (often pre-attached — do **not** upload `resume.pdf` into the cover-letter file input), cover letter via generated PDF to `file-Cover Letter` / “Upload new”, **Submit Application**; may show school-year mismatch warnings. Iterate headed fills (reuse `.auth/handshake.json`) until discovery + cover-letter PDF + chat handoff match Ashby reliability.

**Still out:** multi-page Workday wizards, account creation.
