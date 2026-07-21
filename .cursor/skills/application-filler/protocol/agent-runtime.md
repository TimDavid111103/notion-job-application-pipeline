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

**Principle:** during step 9 review, the fill shell must stay alive until the user finishes in the browser and answers AskQuestion. Jobs in one run open as **tabs in a single Chrome window** (shared browser context) — not separate windows.

Agent rules:

1. Run `HEADED=1 npm run fill:application` **in the background** (`block_until_ms: 0`) so a chat message does not interrupt/kill the shell.
2. Wait for `Pre-fill complete` / `Handoff wait` in the output, then read `data/fill/fill-results.json`.
3. AskQuestion: Applied / Invalid / Feedback **while the browser is still open**.
4. To release the wait without closing Chrome: write an empty file at `data/fill/handoff-continue` (or close the window / press Enter in that terminal).
5. Never interrupt the fill shell while the user is reviewing the form.

## Prefer `node --import tsx` (already in package.json)

Bare `tsx …` opens an IPC pipe that can fail with `listen EPERM` in restricted shells. All npm scripts use:

```bash
node --import tsx scripts/…
```

## Resume

Canonical path and fail-fast rules: [domain/fill-references.md](../domain/fill-references.md). Do not search the filesystem for a resume.

## Playwright env bootstrap

`scripts/lib/browser/playwright-env.ts` (imported by `browser.ts`) sets:

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
