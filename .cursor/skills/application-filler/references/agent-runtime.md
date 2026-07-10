# Agent Runtime (Fill Skill)

Hard requirements for Cursor agent runs. Skipping these caused multi-minute stalls.

## Always use unrestricted shell for Playwright

Browser launch **fails inside the Cursor sandbox** (`os.cpus()` empty → wrong `mac-x64` binary; Chrome aborts with `SIGSEGV`/`EPERM`).

For any command that opens Chromium/Chrome (`fill:application`, `URL_HEALTH_MODE=browser`, auth scripts):

```text
required_permissions: ["all"]
```

URL health **defaults to HTTP** (`URL_HEALTH_MODE=http`) and does **not** need a browser, but **does** need network (`full_network` or `all`).

## Prefer `node --import tsx` (already in package.json)

Bare `tsx …` opens an IPC pipe that can fail with `listen EPERM` in restricted shells. All npm scripts use:

```bash
node --import tsx scripts/…
```

## Resume — fail fast, never search

Canonical path only:

```text
.cursor/skills/application-filler/references/documents/resume.pdf
```

Do **not** `find` the filesystem. If missing, stop and ask the user to copy it there.

## Playwright env bootstrap

`scripts/lib/playwright-env.ts` (imported by `browser.ts`) sets:

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
