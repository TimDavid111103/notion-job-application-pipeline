# Pipeline Scripts (repo root)

All Playwright runners live in the repo — not in this skill folder. Run npm/tsx commands from
**repo root** (the directory containing `package.json`).

## npm commands

```bash
bash scripts/setup.sh          # install deps + Playwright browser

npm run auth:wobo              # headed logins → .auth/*.json (one-time)
npm run auth:handshake
npm run auth:jackjill
npm run test:access            # verify all sessions

npm run source:wobo            # single aggregator
npm run source:handshake
npm run source:jackjill
npm run source:all             # sequential
npm run source:all:parallel    # PARALLEL=1 (all three at once)

npm run log:notion             # writes notion-payloads.json for MCP add_database_entry
```

Jack daily clean-out (not in package.json):

```bash
tsx scripts/sources/jack-empty.ts     # empties inbox + Saved kanban
```

First-time setup from the skill folder: `bash .cursor/skills/job-aggregators/scripts/setup.sh`

## Script map

| Path | Purpose |
|---|---|
| `scripts/source-all.ts` | Orchestrator (parallel/sequential, timeout, RUN_ID) |
| `scripts/sources/wobo.ts` | Wobo runner |
| `scripts/sources/handshake.ts` | Handshake runner |
| `scripts/sources/jackjill.ts` | Jack inbox runner |
| `scripts/sources/jack-empty.ts` | Jack inbox + Saved clean-out |
| `scripts/log-to-notion.ts` | scratch → `notion-payloads.json` |
| `scripts/auth/login-*.ts` | Headed logins |
| `scripts/test-access.ts` | Session verification |
| `scripts/lib/scratch.ts` | Scratch I/O, `SourcedJob`, `jobKey` dedup, `screeningSignals` |
| `scripts/lib/notion.ts` | Dedup, payload builder, DB ids |
| `scripts/lib/wobo.ts` | Wobo card read + advance |
| `scripts/lib/handshake.ts` | Handshake filters + search |
| `scripts/lib/jackjill.ts` | Jack inbox, kanban, selectors |
| `scripts/lib/browser.ts` | Browser launch, auth state, session I/O |

## Data contracts

### `SourcedJob` (`scripts/lib/scratch.ts`)

```ts
interface SourcedJob {
  company: string;
  role: string;
  jobUrl: string;
  source: "Wobo" | "Handshake" | "Jack & Jill";
  location: string;
}
```

### Scratch file (`sourced-jobs.md`)

```
| Company | Role | Job URL | Source | Location |
|---|---|---|---|---|
```

Append-only via `appendJobs`, which strictly de-dupes by `jobKey` (normalized URL, else company+role).

### Notion payload (`scripts/lib/notion.ts` → MCP `add_database_entry`)

```ts
{
  database_id: "32f1de14-69d8-803a-81ba-fb8cf47a1ccd",
  properties: {
    Name: `${company}: ${role}`,   // title
    Company: company,              // rich_text
    Role: role,                    // rich_text
    Location: source,              // select — stores SOURCE not geographic location
    "Job URL": jobUrl,             // url
    "Date Added": <ISO date>,      // date (today)
  }
}
```

See [notion-schema.md](notion-schema.md) for dedup rules.
