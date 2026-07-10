/**
 * Must load before `playwright` / `playwright-core`.
 *
 * Cursor agent sandboxes often:
 * 1. Inject PLAYWRIGHT_BROWSERS_PATH → empty sandbox cache
 * 2. Return os.cpus() === [] so Playwright picks mac-x64 on Apple Silicon
 *
 * Set overrides early so browser binaries resolve to the real arm64 install.
 */
import os from "node:os";
import path from "node:path";

function darwinHostPlatformOverride(): string | undefined {
  if (process.platform !== "darwin") return undefined;
  if (process.arch !== "arm64") return undefined;

  const major = Number.parseInt(os.release().split(".")[0] ?? "", 10);
  if (!Number.isFinite(major)) return "mac15-arm64";

  // Mirror playwright-core hostPlatform.ts (Darwin 24 → mac15, etc.).
  let macVersion: string;
  if (major < 18) macVersion = "mac10.13";
  else if (major === 18) macVersion = "mac10.14";
  else if (major === 19) macVersion = "mac10.15";
  else if (major < 25) macVersion = `mac${major - 9}`;
  else macVersion = `mac${Math.min(major + 1, 26)}`;

  return `${macVersion}-arm64`;
}

function isSandboxBrowserCache(browserPath: string | undefined): boolean {
  if (!browserPath) return false;
  return browserPath.includes("cursor-sandbox-cache");
}

/** Apply env fixes. Safe to call multiple times. Returns applied values. */
export function ensurePlaywrightEnv(): {
  hostPlatform?: string;
  browsersPath?: string;
} {
  const applied: { hostPlatform?: string; browsersPath?: string } = {};

  const override = darwinHostPlatformOverride();
  if (override && !process.env.PLAYWRIGHT_HOST_PLATFORM_OVERRIDE) {
    process.env.PLAYWRIGHT_HOST_PLATFORM_OVERRIDE = override;
    applied.hostPlatform = override;
  } else if (process.env.PLAYWRIGHT_HOST_PLATFORM_OVERRIDE) {
    applied.hostPlatform = process.env.PLAYWRIGHT_HOST_PLATFORM_OVERRIDE;
  }

  const homeCache = path.join(os.homedir(), "Library/Caches/ms-playwright");
  const current = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!current || isSandboxBrowserCache(current)) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = homeCache;
    applied.browsersPath = homeCache;
  } else {
    applied.browsersPath = current;
  }

  return applied;
}

ensurePlaywrightEnv();

/**
 * Cursor agent sandboxes return empty os.cpus() and abort Chrome (SIGSEGV/EPERM).
 * Call before headed/browser launches so the agent fails fast instead of hanging.
 */
export function assertBrowserLaunchAllowed(): void {
  if (process.env.ALLOW_SANDBOX_BROWSER === "1") return;

  const cpusEmpty = process.platform === "darwin" && os.cpus().length === 0;
  const sandboxCache = isSandboxBrowserCache(process.env.PLAYWRIGHT_BROWSERS_PATH);

  // After ensurePlaywrightEnv(), browsersPath is rewritten — detect sandbox via cpus.
  if (!cpusEmpty && !sandboxCache) return;

  if (cpusEmpty) {
    throw new Error(
      [
        "Playwright browser launch blocked: Cursor sandbox detected (os.cpus() is empty).",
        'Re-run this command with required_permissions: ["all"].',
        "URL health can use HTTP mode (default) without a browser.",
      ].join("\n")
    );
  }
}
