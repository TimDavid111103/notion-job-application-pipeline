/**
 * Shared Playwright browser lifecycle — launch, auth state, graceful shutdown.
 *
 * Sessions persist in `.auth/{aggregator}.json` and reload on each headless run.
 * Auth scripts (headed) create/update these files once; sourcing reuses them.
 */
import "./playwright-env.js";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { assertBrowserLaunchAllowed, ensurePlaywrightEnv } from "./playwright-env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "../../..");
export const AUTH_DIR = path.join(REPO_ROOT, ".auth");

export type Aggregator = "wobo" | "handshake" | "jackjill";

export function authPath(aggregator: Aggregator): string {
  return path.join(AUTH_DIR, `${aggregator}.json`);
}

/**
 * Maps a job posting URL to the aggregator whose saved session can reach it.
 * Handshake postings live behind login; other ATS hosts (Greenhouse, Lever,
 * Ashby, Workday, …) are public and need no session. Extend here when another
 * authenticated host is added.
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
}

export async function ensureAuthDir(): Promise<void> {
  await mkdir(AUTH_DIR, { recursive: true });
}

function launchArgs(headed: boolean): string[] {
  return headed
    ? ["--start-maximized"]
    : ["--disable-blink-features=AutomationControlled"];
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
 * Launch order: system Chrome → bundled Chromium.
 * Env bootstrap (arm64 host + real browser cache) runs first via playwright-env.
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

  const attempts: Array<{ label: string; opts: Parameters<typeof chromium.launch>[0] }> = [
    { label: "channel=chrome", opts: { channel: "chrome", headless: !headed, args } },
    { label: "bundled chromium", opts: { headless: !headed, args } },
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
  const { existsSync } = await import("node:fs");
  const storageState = stateFile && existsSync(stateFile) ? stateFile : undefined;

  const context = await browser.newContext({
    storageState,
    viewport: headed ? null : { width: 1440, height: 900 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  // tsx/esbuild (keepNames) injects `__name(...)` into page.evaluate'd code, which
  // isn't defined in the browser. Shim it so evaluate callbacks don't throw.
  await context.addInitScript(() => {
    const g = globalThis as unknown as { __name?: (fn: unknown) => unknown };
    if (!g.__name) g.__name = (fn: unknown) => fn;
  });
  return context;
}

/**
 * Closes the browser but never hangs — some SPAs (Wobo, Jack) keep CDP busy and
 * `browser.close()` can block indefinitely, stalling the whole run. Race it.
 */
export async function closeBrowser(browser: Browser, ms = 5000): Promise<void> {
  await Promise.race([
    browser.close().catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, ms)),
  ]);
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
