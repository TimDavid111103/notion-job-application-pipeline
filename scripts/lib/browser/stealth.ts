/**
 * Anti-bot / ATS spam mitigations for headed fill.
 *
 * Principle: prefer real Chrome (CDP) + strip Playwright tells + human-like
 * input telemetry. Avoid inconsistent navigator spoofing (plugins/canvas noise
 * often increases detection).
 */
import type { BrowserContext, Locator, Page } from "playwright";

export function antiBotEnabled(): boolean {
  if (process.env.ANTI_BOT === "0") return false;
  if (process.env.ANTI_BOT === "1") return true;
  // On by default whenever we auto-submit (Ashby spam probes).
  return process.env.AUTO_SUBMIT === "1";
}

/** Init scripts that remove Playwright fingerprints without inventing fake hardware. */
export async function applyAntiBotInitScripts(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const g = globalThis as unknown as {
      __name?: (fn: unknown) => unknown;
      __pwInitScripts?: unknown;
      __playwright?: unknown;
      __PW_cleanup?: unknown;
    };
    if (!g.__name) g.__name = (fn: unknown) => fn;

    // Playwright injection markers (isPlaywright detectors).
    try {
      delete g.__pwInitScripts;
      delete g.__playwright;
      delete g.__PW_cleanup;
    } catch {
      /* ignore */
    }

    // Prefer boolean false over undefined — undefined is itself a bot tell on some detectors.
    try {
      Object.defineProperty(Navigator.prototype, "webdriver", {
        get: () => false,
        configurable: true,
      });
    } catch {
      /* already defined */
    }

    // Ensure window.chrome looks present under CDP-attached Chrome.
    const w = globalThis as unknown as { chrome?: { runtime?: unknown } };
    if (!w.chrome) w.chrome = {};
    if (!("runtime" in w.chrome)) w.chrome.runtime = {};
  });
}

export async function humanPause(page: Page, minMs = 180, maxMs = 520): Promise<void> {
  const ms = minMs + Math.floor(Math.random() * Math.max(1, maxMs - minMs));
  await page.waitForTimeout(ms);
}

/** Bezier-ish mouse move toward a locator before interacting. */
export async function humanMoveTo(page: Page, locator: Locator): Promise<void> {
  const box = await locator.boundingBox().catch(() => null);
  if (!box) return;
  const x = box.x + box.width * (0.3 + Math.random() * 0.4);
  const y = box.y + box.height * (0.3 + Math.random() * 0.4);
  await page.mouse.move(x, y, { steps: 8 + Math.floor(Math.random() * 14) });
  await humanPause(page, 60, 180);
}

/** Scroll / idle after navigation so submit is not load→fill→submit. */
export async function warmUpPage(page: Page): Promise<void> {
  await humanPause(page, 800, 1600);
  await page.mouse.move(120 + Math.random() * 200, 160 + Math.random() * 200, { steps: 6 });
  await page.evaluate(() => window.scrollBy(0, 180 + Math.floor(Math.random() * 220)));
  await humanPause(page, 400, 900);
  await page.evaluate(() => window.scrollBy(0, -80));
  await humanPause(page, 200, 500);
}

/**
 * Type via real key events (not element.value assignment).
 * Short fields: pressSequentially. Long fields: clipboard paste + input event.
 */
export async function humanTypeValue(page: Page, locator: Locator, value: string): Promise<void> {
  try {
    await humanMoveTo(page, locator);
    await locator.click({ timeout: 5_000 });
    await humanPause(page, 80, 200);
    await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
    await page.keyboard.press("Backspace");
    await humanPause(page, 60, 160);

    if (value.length > 120) {
      // Clipboard paste generates paste/input events Ashby sees more often than .fill().
      const wrote = await page
        .evaluate(async (text) => {
          try {
            await navigator.clipboard.writeText(text);
            return true;
          } catch {
            return false;
          }
        }, value)
        .catch(() => false);
      if (wrote) {
        await page.keyboard.press(process.platform === "darwin" ? "Meta+V" : "Control+V");
        await humanPause(page, 120, 280);
        return;
      }
      await locator.evaluate((el, text) => {
        const input = el as HTMLInputElement | HTMLTextAreaElement;
        input.focus();
        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        document.execCommand("insertText", false, text);
      }, value);
      await humanPause(page, 120, 280);
      return;
    }

    const delay = 28 + Math.floor(Math.random() * 35);
    await locator.pressSequentially(value, { delay, timeout: 60_000 });
    await humanPause(page, 100, 280);
  } catch {
    // Lever/Ashby custom widgets sometimes reject sequential input — fall back.
    await locator.click({ clickCount: 3 }).catch(() => {});
    await locator.fill("");
    await locator.fill(value);
  }
}
