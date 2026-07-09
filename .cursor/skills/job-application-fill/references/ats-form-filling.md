# ATS Form Filling

Playwright heuristics for step 9. Implementation: `scripts/lib/application-fill.ts`.

## Flow per job

1. Navigate to Job URL (`normalizeScrapeUrl`)
2. Click Apply / open application form (host-specific)
3. Discover visible inputs, textareas, selects, file inputs
4. Lookup values via `fill-references.ts`
5. Fill high-confidence matches; flag rest for handoff
6. `page.pause()` — user completes and submits manually

## Host-specific Apply navigation

| Host | Apply trigger |
|------|----------------|
| `greenhouse.io` | Link/button "Apply" |
| `jobs.lever.co` | Link "Apply" |
| `jobs.ashbyhq.com` | Link/button with `application` in href |
| Other | First button/link matching `/apply/i` |

## Field discovery

Labels from: associated `<label>`, `aria-label`, `placeholder`, `name` attribute.

## File uploads

Resume path: `references/documents/resume.pdf` when label matches resume/CV.

## Submission

**Do not submit** unless `AUTO_SUBMIT=1` (default off). User reviews in headed browser.

## v1 scope

Greenhouse, Lever, Ashby, Workday (basic), generic fallback for other ATS hosts.

## Out of scope (v1)

- Handshake in-app apply
- Multi-page Workday wizards
- Account creation flows
