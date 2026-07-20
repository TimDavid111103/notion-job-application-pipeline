# Environment Variables

Run all commands from **repo root**. Override per run:
`HEADED=0 JOB_LIMIT=5 npm run source:all`.

**Source of truth for default caps:** `scripts/lib/job/limits.ts` `DEFAULT_LIMITS`

**Source of truth for headed vs headless:** this file + `isSourceHeaded()` in
`scripts/lib/browser/index.ts`. Do not restate the default elsewhere.

| Var | Default | Effect | Used by |
|---|---|---|---|
| `HEADED` | unset (**headed**) | Visible browser for source + `test:access`. Set `0` for headless | `isSourceHeaded()` — all source scripts, `jack-empty`, `test:access` |
| `PARALLEL` | unset | `1` = run all aggregators concurrently | `source-all.ts` |
| `JOB_LIMIT` | — | Same cap for all aggregators when set | `limits.ts` |
| *(defaults)* | Wobo **30** / Handshake **20** / Jack **20** | Per-aggregator when `JOB_LIMIT` unset | `limits.ts` `DEFAULT_LIMITS` |
| `WOBO_JOB_LIMIT` | — | Wobo only | `limits.ts` |
| `HANDSHAKE_JOB_LIMIT` | — | Handshake only | `limits.ts` |
| `JACKJILL_JOB_LIMIT` | — | Jack only | `limits.ts` |
| `AGGREGATOR_TIMEOUT_MS` | 300000 | per-aggregator wall-clock kill cap (Wobo, Handshake) | `source-all.ts` |
| `JACK_TIMEOUT_MS` / `JACK_TIMEOUT` | 600000 | Jack & Jill wall-clock cap (fill + review) | `source-all.ts`, `jackjill.ts` |
| `RUN_ID` | ISO timestamp | groups a single sourcing run (logged by `source-all.ts`) | `source-all.ts` |
| `SCRATCH_RETENTION_DAYS` | 7 | days of scratch rows kept for sourcing dedup | `scratch.ts` |
| `NOTION_LOG_DATE` | today UTC | `YYYY-MM-DD` — which scratch rows to log to Notion | `log-to-notion*.ts` |
| `MAX` | Infinity | cap Saved cards processed | `jack-empty.ts` |
| `SKIP_INBOX` | unset | `1` = only empty Saved column | `jack-empty.ts` |

Sourcing stays headed by default so Cloudflare-protected aggregators (Handshake) and
manual auth recovery work without a per-run override. Use `HEADED=0` only when you
intentionally want headless (Wobo/Jack often work; Handshake may still fail).
