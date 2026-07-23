# Agent Runtime (Fill Skill)

Hard requirements for Cursor agent runs. Skipping these caused multi-minute stalls.

## Always use unrestricted shell for Playwright

Browser launch **fails inside the Cursor sandbox** (`os.cpus()` empty → wrong `mac-x64` binary; Chrome aborts with `SIGSEGV`/`EPERM`).

For any command that opens Chromium/Chrome (`fill:application`, `URL_HEALTH_MODE=browser`, auth scripts):

```text
required_permissions: ["all"]
```

URL health **defaults to HTTP** (`URL_HEALTH_MODE=http`) and does **not** need a browser, but **does** need network (`full_network` or `all`).

## Headed handoff — keep the fill process alive

`KEEP_BROWSER_OPEN` only works while the **Node fill process** is still running. Exiting (or killing) that process closes Chrome.

**Principle:** one fill Chrome window for the whole session. Every job opens as a **new tab in that window**. Never macOS `open` (Safari/default browser), never a second Chrome window for the next job.

Agent rules:

1. Put the full remaining batch in `fill-session.json` / the queue **before** starting fill. Run `HEADED=1 npm run fill:application` **once** in the background (`block_until_ms: 0`).
2. Wait for `Pre-fill complete` / `Handoff wait` in the output, then read `data/fill/fill-results.json`.
3. AskQuestion: Applied / Invalid / Feedback **while the browser is still open**.
4. After Applied/Invalid: update Notion Status, then write `data/fill/handoff-continue` so the **same** fill process advances to the next queued job as another tab. Do **not** start a new `fill:application` while that process (or its Chrome) is still alive.
5. Never interrupt the fill shell while the user is reviewing the form.
6. If the fill process already exited but fill Chrome is still open, a new `fill:application` reuses that CDP window (tabs). Only force a fresh Chrome with `BROWSER_CDP_REUSE=0`.

## Prefer `node --import tsx` (already in package.json)

Bare `tsx …` opens an IPC pipe that can fail with `listen EPERM` in restricted shells. All npm scripts use:

```bash
node --import tsx scripts/…
```

## Resume

Canonical path and fail-fast rules: [domain/fill-references.md](../domain/fill-references.md). Do not search the filesystem for a resume.

## Playwright env bootstrap

`scripts/lib/browser/playwright-env.ts` (imported by `scripts/lib/browser/index.ts`) sets:

| Variable | Purpose |
|----------|---------|
| `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE` | Force `mac*-arm64` on Apple Silicon when `os.cpus()` is empty |
| `PLAYWRIGHT_BROWSERS_PATH` | Prefer `~/Library/Caches/ms-playwright`; rewrite Cursor sandbox cache paths |

`launchBrowser()` calls `assertBrowserLaunchAllowed()` and fails immediately in sandbox instead of hanging on install/launch.

## Setup

```bash
bash .cursor/skills/application-filler/scripts/setup.sh
```

Must also run outside the sandbox (downloads Chromium).
