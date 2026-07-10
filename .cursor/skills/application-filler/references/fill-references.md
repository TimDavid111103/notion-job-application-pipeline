# Fill References

Three markdown files power form filling. Parser: `scripts/lib/fill-references.ts`.

## Files

| File | Purpose |
|------|---------|
| `personal-information.md` | Standard fields — never stop to ask for basics |
| `projects.md` | Portfolio / "describe a project" answers |
| `answers.md` | Open-ended screening Q&A exemplars |

Templates ship in git; live PII files are gitignored (see `personal-information.template.md`).

## Lookup priority

1. **Sensitive blocklist** → skip + flag (`sensitive_manual_only`)
2. **personal-information.md** → label match on table rows
3. **answers.md** → fuzzy Q match for textareas
4. **projects.md** → project-related labels
5. **No match** → blank + handoff suggestion

## Sensitive fields (never auto-fill)

SSN, passport, driver's license, government ID, bank/card numbers, passwords.

## Interpolation

`{company}`, `{role}`, `{jobMatch}` in answers.md templates.

## Resume

**Canonical path (required):** `references/documents/resume.pdf` (gitignored).

Copy once — do not search the filesystem at fill time:

```bash
cp /path/to/your-resume.pdf .cursor/skills/application-filler/references/documents/resume.pdf
```

`loadFillReferences()` fails fast if this file is missing. Used for file inputs matching resume/CV labels.
