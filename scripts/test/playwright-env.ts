/**
 * Unit checks for Playwright env bootstrap (no browser launch).
 */
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";

// Capture pre-import pollution then re-apply via module under test.
delete process.env.PLAYWRIGHT_HOST_PLATFORM_OVERRIDE;
process.env.PLAYWRIGHT_BROWSERS_PATH =
  "/var/folders/tmp/cursor-sandbox-cache/fake/playwright";

const { ensurePlaywrightEnv } = await import("../lib/playwright-env.js");

function main(): void {
  const applied = ensurePlaywrightEnv();
  if (process.platform === "darwin" && process.arch === "arm64") {
    assert.ok(
      applied.hostPlatform?.endsWith("-arm64"),
      `expected arm64 hostPlatform, got ${applied.hostPlatform}`
    );
    assert.equal(
      process.env.PLAYWRIGHT_HOST_PLATFORM_OVERRIDE,
      applied.hostPlatform
    );
  }
  assert.equal(
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    path.join(os.homedir(), "Library/Caches/ms-playwright")
  );
  assert.ok(!process.env.PLAYWRIGHT_BROWSERS_PATH?.includes("cursor-sandbox-cache"));
  console.log("playwright-env tests passed", applied);
}

main();
