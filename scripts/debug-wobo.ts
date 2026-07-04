/**
 * One-off Wobo feed debugger — headed only. Logs DOM state around Save/Decline and
 * tests advance strategies. Delete or keep for future Wobo regressions.
 */
import { launchBrowser, createContext, closeBrowser } from "./lib/browser.js";
import {
  dismissAutopilot,
  openDashboard,
  readCardFingerprint,
  waitForFeedReady,
  WOBO_DASHBOARD,
} from "./lib/wobo.js";

async function dumpState(page: import("playwright").Page, label: string) {
  const info = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"))
      .filter((b) => b.getBoundingClientRect().width > 0)
      .map((b) => ({
        text: (b.textContent || "").trim().slice(0, 40),
        aria: b.getAttribute("aria-label"),
        disabled: (b as HTMLButtonElement).disabled,
        x: Math.round(b.getBoundingClientRect().x),
        y: Math.round(b.getBoundingClientRect().y),
      }));
    const links = Array.from(document.querySelectorAll("a"))
      .filter((a) => /view original/i.test(a.textContent || ""))
      .map((a) => ({ href: a.getAttribute("href"), text: (a.textContent || "").trim() }));
    const h3s = Array.from(document.querySelectorAll("h3")).map((h) => (h.textContent || "").trim());
    const bodySnippet = document.body.innerText.slice(0, 500);
    return { buttons, links, h3s, bodySnippet };
  });
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(info, null, 2));
}

async function main() {
  const browser = await launchBrowser({ headed: true, aggregator: "wobo" });
  const page = await (await createContext(browser, "wobo", true)).newPage();
  try {
    await openDashboard(page);
    await waitForFeedReady(page);
    await dismissAutopilot(page);
    const before = await readCardFingerprint(page);
    console.log("Fingerprint before:", before);
    await dumpState(page, "before action");

    // Test bottom Save button (not sticky header)
    const saveAll = page.getByRole("button", { name: /^save$/i }).and(page.locator(":visible"));
    const n = await saveAll.count();
    console.log("\nSave button count:", n);
    if (n >= 2) {
      await saveAll.nth(n - 1).click({ force: true, timeout: 5000 });
      await page.waitForTimeout(2000);
      console.log("Fingerprint after bottom Save:", await readCardFingerprint(page));
    }

    await page.screenshot({ path: "wobo-debug.png", fullPage: true });
    console.log("\nScreenshot: wobo-debug.png");

    // Pause so user can inspect if needed
    await page.waitForTimeout(5000);
  } finally {
    await closeBrowser(browser);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
