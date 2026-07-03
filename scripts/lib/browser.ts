/**
 * Shared Playwright browser lifecycle — launch, auth state, graceful shutdown.
 *
 * Sessions persist in `.auth/{aggregator}.json` and reload on each headless run.
 * Auth scripts (headed) create/update these files once; sourcing reuses them.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "../..");
export const AUTH_DIR = path.join(REPO_ROOT, ".auth");

export type Aggregator = "wobo" | "handshake" | "jackjill";

export function authPath(aggregator: Aggregator): string {
  return path.join(AUTH_DIR, `${aggregator}.json`);
}

export interface LaunchOptions {
  headed?: boolean;
  aggregator?: Aggregator;
}

export async function ensureAuthDir(): Promise<void> {
  await mkdir(AUTH_DIR, { recursive: true });
}

export async function launchBrowser(options: LaunchOptions = {}): Promise<Browser> {
  const headed = options.headed ?? process.env.HEADED === "1";
  console.log(headed ? "Launching headed browser..." : "Launching headless browser...");

  try {
    // Prefer installed Chrome (better SPA compatibility); fall back to bundled Chromium.
    return await chromium.launch({
      channel: "chrome",
      headless: !headed,
      args: headed ? ["--start-maximized"] : ["--disable-blink-features=AutomationControlled"],
    });
  } catch {
    return chromium.launch({
      headless: !headed,
      args: headed ? ["--start-maximized"] : ["--disable-blink-features=AutomationControlled"],
    });
  }
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
