# URL Health Policy (Fill Skill)

Canonical policy: [shared-references/url-health-policy.md](../../shared-references/url-health-policy.md)

This skill runs URL health in **step 7** via `npm run check:url-health` before headed fill.

Dead + deletable rows are removed in **step 8** via MCP `delete_database_entry`.

Transient failures (`login_required`, `captcha`) are preserved — the headed fill session may resolve them.
