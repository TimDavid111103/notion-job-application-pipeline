# ATS Form Filling

Playwright heuristics for step 9. Implementation: `scripts/lib/fill/application-fill.ts`.

## Flow per job

1. Navigate to Job URL (`normalizeScrapeUrl`)
2. Click Apply / open application form (host-specific)
3. Discover visible inputs, textareas, selects, file inputs
4. **Upload resume first** (`.cursor/skills/application-filler/assets/documents/resume.pdf` on resume/CV file inputs)
5. **Wait** until resume processing/analyzing UI finishes (then re-discover fields)
6. Fill remaining fields from references — overwrite any ATS autofill
7. Handoff in chat — AskQuestion: Applied / Invalid / Feedback (no Playwright inspector unless `AUTO_PAUSE=1`)

## Host-specific Apply navigation

| Host | Apply trigger |
|------|----------------|
| `greenhouse.io` | Link/button "Apply" |
| `jobs.lever.co` | Link "Apply" |
| `jobs.ashbyhq.com` | Link/button with `application` in href |
| Other | First button/link matching `/apply/i` |

## Field discovery

Labels from: associated `<label>`, `aria-label`, `placeholder`, `name` attribute.

## Resume upload (before other fields)

1. Upload resume/CV file input(s) first.
2. If the page shows resume processing (e.g. analyzing / processing / parsing resume), wait until it completes.
3. Re-discover fields, then fill text/selects from references (overwrite existing values).

## Submission

**Do not submit** unless `AUTO_SUBMIT=1` (default off). User reviews in headed browser.

## v1 scope

Greenhouse, Lever, Ashby, Workday (basic), generic fallback for other ATS hosts.

## Out of scope (v1)

- Handshake in-app apply
- Multi-page Workday wizards
- Account creation flows
