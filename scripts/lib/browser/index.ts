/**
 * Shared Playwright browser lifecycle — launch, auth state, graceful shutdown.
 *
 * Sessions persist in `.auth/{aggregator}.json` and reload on each headless run.
 *
 * Headed fill prefers CDP-attached system Chrome: Playwright does not spawn the
 * browser with automation switches. Submit probes disconnect CDP and click via
 * macOS Accessibility (highest practical success vs Ashby spam fingerprinting).
 */
import "./playwright-env.js";
import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { assertBrowserLaunchAllowed, ensurePlaywrightEnv } from "./playwright-env.js";
import { applyAntiBotInitScripts } from "./stealth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "../../..");
export const AUTH_DIR = path.join(REPO_ROOT, ".auth");
export const CHROME_FILL_PROFILE_DIR = path.join(AUTH_DIR, "chrome-fill-profile");

export type Aggregator = "wobo" | "handshake" | "jackjill";

export function authPath(aggregator: Aggregator): string {
  return path.join(AUTH_DIR, `${aggregator}.json`);
}

/**
 * Maps a job posting URL to the aggregator whose saved session can reach it.
 * Handshake postings live behind login; other ATS hosts are public.
 */
export function aggregatorForUrl(url: string): Aggregator | undefined {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("joinhandshake.com")) return "handshake";
  } catch {
    /* invalid url — treat as public */
  }
  return undefined;
}

export interface LaunchOptions {
  headed?: boolean;
  aggregator?: Aggregator;
  /** When true, Playwright will not auto-close Chrome on process signals (headed handoff). */
  ignoreDefaultSignals?: boolean;
  /**
   * Attach to a real Chrome process over CDP instead of `chromium.launch`.
   * Defaults on for headed when `BROWSER_CDP` is unset or `1`.
   */
  cdp?: boolean;
}

let cdpChromeProc: ChildProcess | null = null;
let cdpPort: number | null = null;

export function getCdpPort(): number | null {
  return cdpPort;
}

/** Disconnect Playwright from CDP Chrome without killing the Chrome process. */
export async function disconnectCdpBrowser(browser: Browser): Promise<void> {
  await Promise.race([
    browser.close().catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
}

/** Re-attach to the still-running CDP Chrome after an OS submit click. */
export async function reconnectCdpBrowser(): Promise<Browser> {
  if (!cdpPort) throw new Error("No CDP port to reconnect");
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`);
  console.log(`Reconnected to CDP Chrome on port ${cdpPort}`);
  return browser;
}

export async function ensureAuthDir(): Promise<void> {
  await mkdir(AUTH_DIR, { recursive: true });
}

function launchArgs(headed: boolean): string[] {
  const args = [
    "--disable-blink-features=AutomationControlled",
    "--disable-infobars",
    "--no-default-browser-check",
    "--no-first-run",
  ];
  if (headed) args.push("--start-maximized");
  return args;
}

const IGNORE_AUTOMATION_DEFAULT_ARGS = ["--enable-automation"] as const;

function shouldUseCdp(options: LaunchOptions, headed: boolean): boolean {
  if (options.cdp === true) return true;
  if (options.cdp === false) return false;
  if (process.env.BROWSER_CDP === "0") return false;
  if (process.env.BROWSER_CDP === "1") return true;
  return headed;
}

function chromeExecutablePath(): string | null {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ].filter(Boolean) as string[];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

async function waitForCdp(port: number, timeoutMs = 20_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Chrome CDP not ready on port ${port} within ${timeoutMs}ms`);
}

async function launchBrowserViaCdp(headed: boolean): Promise<Browser> {
  const chromePath = chromeExecutablePath();
  if (!chromePath) throw new Error("Google Chrome not found for CDP launch");
  await mkdir(CHROME_FILL_PROFILE_DIR, { recursive: true });
  const port = 9222 + Math.floor(Math.random() * 800);
  cdpPort = port;
  const profileDir = path.join(CHROME_FILL_PROFILE_DIR, "default");
  await mkdir(profileDir, { recursive: true });
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    "--disable-blink-features=AutomationControlled",
    "--disable-infobars",
    "--no-first-run",
    "--no-default-browser-check",
    ...(headed ? ["--start-maximized"] : ["--headless=new"]),
    "about:blank",
  ];
  console.log(`Spawning Chrome for CDP attach (port ${port})...`);
  cdpChromeProc = spawn(chromePath, args, { stdio: "ignore", detached: true });
  cdpChromeProc.unref();
  await waitForCdp(port);
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  console.log("Browser attached via CDP (system Chrome)");
  return browser;
}

async function applyStealthInitScripts(context: BrowserContext): Promise<void> {
  await applyAntiBotInitScripts(context);
}

function formatLaunchError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const log = (err as Error & { log?: string[] }).log;
  const hint =
    /EPERM|SIGSEGV|SIGABRT|Target page, context or browser has been closed/i.test(err.message) ||
    (Array.isArray(log) && log.some((line) => /EPERM|SIGSEGV|SIGABRT/i.test(line)))
      ? " Hint: run Playwright steps outside the Cursor sandbox (required_permissions: [\"all\"])."
      : "";
  return `${err.message.split("\n")[0]}${hint}`;
}

/**
 * Launch order: CDP system Chrome (headed default) → channel=chrome → bundled Chromium.
 */
export async function launchBrowser(options: LaunchOptions = {}): Promise<Browser> {
  const env = ensurePlaywrightEnv();
  assertBrowserLaunchAllowed();
  const headed = options.headed ?? process.env.HEADED === "1";
  const args = launchArgs(headed);
  console.log(headed ? "Launching headed browser..." : "Launching headless browser...");
  if (env.hostPlatform || env.browsersPath) {
    console.log(
      `Playwright env: host=${env.hostPlatform ?? "(default)"} browsers=${env.browsersPath ?? "(default)"}`
    );
  }

  if (shouldUseCdp(options, headed)) {
    try {
      return await launchBrowserViaCdp(headed);
    } catch (err) {
      console.warn(`CDP Chrome launch failed, falling back: ${formatLaunchError(err)}`);
    }
  }

  const signalOpts = options.ignoreDefaultSignals
    ? { handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false }
    : {};

  const attempts: Array<{ label: string; opts: Parameters<typeof chromium.launch>[0] }> = [
    {
      label: "channel=chrome",
      opts: {
        channel: "chrome",
        headless: !headed,
        args,
        ignoreDefaultArgs: [...IGNORE_AUTOMATION_DEFAULT_ARGS],
        ...signalOpts,
      },
    },
    {
      label: "bundled chromium",
      opts: {
        headless: !headed,
        args,
        ignoreDefaultArgs: [...IGNORE_AUTOMATION_DEFAULT_ARGS],
        ...signalOpts,
      },
    },
  ];

  const errors: string[] = [];
  for (const attempt of attempts) {
    try {
      const browser = await chromium.launch(attempt.opts);
      console.log(`Browser launched via ${attempt.label}`);
      return browser;
    } catch (err) {
      errors.push(`${attempt.label}: ${formatLaunchError(err)}`);
    }
  }

  const exe = (() => {
    try {
      return chromium.executablePath();
    } catch {
      return "(unavailable)";
    }
  })();
  const exeExists = typeof exe === "string" && exe !== "(unavailable)" && existsSync(exe);

  throw new Error(
    [
      "Failed to launch Playwright browser.",
      ...errors.map((e) => `  - ${e}`),
      `  executablePath=${exe} exists=${exeExists}`,
      "  Fix: npx playwright install chromium (outside sandbox), or install Google Chrome.",
      '  Agent: re-run with required_permissions: ["all"].',
    ].join("\n")
  );
}

export async function createContext(
  browser: Browser,
  aggregator?: Aggregator,
  headed = process.env.HEADED === "1"
): Promise<BrowserContext> {
  await ensureAuthDir();
  const stateFile = aggregator ? authPath(aggregator) : undefined;
  const storageState = stateFile && existsSync(stateFile) ? stateFile : undefined;

  const existing = browser.contexts()[0];
  if (existing && cdpChromeProc) {
    await applyStealthInitScripts(existing);
    try {
      await existing.grantPermissions(["clipboard-read", "clipboard-write"]);
    } catch {
      /* optional */
    }
    if (storageState) {
      try {
        const raw = JSON.parse(await readFile(storageState, "utf8")) as {
          cookies?: Parameters<BrowserContext["addCookies"]>[0];
        };
        if (raw.cookies?.length) await existing.addCookies(raw.cookies);
      } catch {
        /* optional auth */
      }
    }
    return existing;
  }

  const context = await browser.newContext({
    storageState,
    viewport: headed ? null : { width: 1440, height: 900 },
    locale: "en-US",
    timezoneId: "America/New_York",
    extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  await applyStealthInitScripts(context);
  return context;
}

export async function closeBrowser(browser: Browser, ms = 5000): Promise<void> {
  await Promise.race([
    browser.close().catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, ms)),
  ]);
  cdpChromeProc = null;
}

export async function saveAuthState(page: Page, aggregator: Aggregator): Promise<void> {
  await ensureAuthDir();
  await page.context().storageState({ path: authPath(aggregator) });
  console.log(`Saved auth state to ${authPath(aggregator)}`);
}

export async function waitForManualLogin(
  page: Page,
  aggregator: Aggregator,
  successUrlPattern: RegExp,
  timeoutMs = 300_000
): Promise<void> {
  console.log(`\n[${aggregator}] Complete login in the browser window.`);
  console.log(`Waiting up to ${timeoutMs / 1000}s for URL matching ${successUrlPattern}...`);
  await page.waitForURL(successUrlPattern, { timeout: timeoutMs });
  await saveAuthState(page, aggregator);
}
