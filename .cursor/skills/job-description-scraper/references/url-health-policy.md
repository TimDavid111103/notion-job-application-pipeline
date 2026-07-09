# URL Health Policy (Scraper Skill)

Canonical policy: [shared-references/url-health-policy.md](../../shared-references/url-health-policy.md)

Implementation: `scripts/lib/url-health.ts` (shared with job-application-fill).

Dead + deletable rows are removed in scraper **step 8** via MCP `delete_database_entry`.
