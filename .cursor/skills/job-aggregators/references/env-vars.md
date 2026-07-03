# Environment Variables

Run all commands from **repo root**. Override per run: `HEADED=1 JOB_LIMIT=5 npm run source:all`.

| Var | Default | Effect | Used by |
|---|---|---|---|
| `HEADED` | unset (headless) | `1` = visible browser (debug) | all source scripts |
| `PARALLEL` | unset | `1` = run all aggregators concurrently | `source-all.ts` |
| `JOB_LIMIT` | Wobo 30 / HS 10 / JJ 10 | per-aggregator cap | `scratch.ts getJobLimit` |
| `AGGREGATOR_TIMEOUT_MS` | 300000 | per-aggregator wall-clock kill cap | `source-all.ts` |
| `RUN_ID` | ISO timestamp | groups a single sourcing run (logged by `source-all.ts`) | `source-all.ts` |
| `MAX` | Infinity | cap Saved cards processed | `jack-empty.ts` |
| `SKIP_INBOX` | unset | `1` = only empty Saved column | `jack-empty.ts` |
