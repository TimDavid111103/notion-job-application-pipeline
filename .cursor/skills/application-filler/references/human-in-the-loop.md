# Human-in-the-Loop

The agent **must** use **AskQuestion** in step 6 before running `fill:application`. This skill is designed for human completion after automation.

## Step 6 — Job selection (before fill)

Ask in order:

### 1. Tier filter
- High only (Recommended for focused sessions)
- High + Medium
- All matched tiers

### 2. Date filter
- Today
- Last 7 days
- All dates

### 3. Status filter
- New only (empty or Not Started)
- Include In Progress (resume)
- In Progress only

### 4. Sort
- Job Match tier (High first) → Date Added (newest first) (Recommended)
- Date Added (oldest first)

### 5. Batch scope
- Next 1 (Recommended)
- Next 3
- All filtered
- Pick specific company (list top 5 from queue)

## Write fill-session.json

After questions, write `data/fill-session.json` with:

- `filters` — human-readable choices from AskQuestion
- `page_ids` — ordered list of page IDs to process

Use `buildFillSessionFile()` from `scripts/lib/fill-artifacts.ts`.

## Step 9 — Per-job confirm (chat only)

**Do not use the Playwright inspector** (`page.pause()` is off by default). After each headed pre-fill, ask **here in chat** — never via a floating Playwright overlay:

- **Applied** — update Status to `Applied` via MCP
- **Skip** — leave Status as `In Progress` or revert to `Not Started`
- **Mark Invalid** — update Status to `Invalid`
- **Keep In Progress** — no change (default if user continues in browser)

## Step 10 — Status on open

When starting a job (before `fill:application` opens the URL), call MCP:

```json
{ "properties": { "Status": "In Progress" } }
```

## Handoff summary

`fill:application` prints filled fields and unfilled fields with suggested answers. User completes sensitive fields and unmatched questions manually in the browser.
