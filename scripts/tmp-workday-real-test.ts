/**
 * TEMP — exercises the real fillWorkdayApplicationForm() end-to-end. Delete after confirmed.
 * Usage: node --import tsx scripts/tmp-workday-real-test.ts <jobUrl>
 */
import { launchBrowser, createContext, openPage } from "./lib/browser/index.js";
import { fillApplicationForm } from "./lib/fill/application-fill.js";
import { fillWorkdayApplicationForm } from "./lib/fill/workday-fill.js";
import { loadFillReferences } from "./lib/fill/fill-references.js";
import type { FillQueueItem } from "./lib/artifacts/fill-artifacts.js";

async function main(): Promise<void> {
  const jobUrl = process.argv[2];
  if (!jobUrl) {
    console.error("Usage: node --import tsx scripts/tmp-workday-real-test.ts <jobUrl>");
    process.exit(1);
  }

  const refs = loadFillReferences();
  const browser = await launchBrowser({ headed: true, stealFocus: true });
  const context = await createContext(browser);
  const page = await openPage(context);

  const item: FillQueueItem = {
    page_id: "tmp-test",
    company: "Test Co",
    role: "Test Role",
    jobUrl,
    jobMatch: "",
    dateAdded: new Date().toISOString(),
    status: "test",
  };

  const useDirect = process.argv[3] === "--direct";
  const result = useDirect
    ? await fillWorkdayApplicationForm(page, item, refs)
    : await fillApplicationForm(page, item, refs);
  console.log("\n=== RESULT ===");
  console.log(JSON.stringify(result, null, 2));

  if (process.argv[4] === "--inspect-name") {
    const html = await page
      .locator('[data-automation-id="formField-legalName--firstName"]')
      .first()
      .evaluate((el) => el.outerHTML)
      .catch((e) => `<error: ${e}>`);
    console.log(`\n--- formField-legalName--firstName outerHTML ---\n${html}`);
  }

  if (process.argv[4] === "--inspect-travel") {
    const ids = await page.evaluate(() =>
      [...document.querySelectorAll('[data-automation-id^="formField-"]')].map((el) =>
        el.getAttribute("data-automation-id")
      )
    );
    const travelId = ids.find((id) => id && /cb8e36d0006/.test(id));
    if (travelId) {
      const btn = page.locator(`[data-automation-id="${travelId}"] button`).first();
      await btn.scrollIntoViewIfNeeded();
      await btn.click();
      await page.waitForTimeout(800);
      const listboxHtml = await page.evaluate(() => {
        const lb = document.querySelector('[role="listbox"]');
        return lb ? lb.outerHTML.slice(0, 3000) : "(no listbox found)";
      });
      console.log(`\n--- listbox options for ${travelId} ---\n${listboxHtml}`);
    } else {
      console.log("travel field not found on current page");
    }
  }
  await page.screenshot({ path: "data/fill/tmp-workday/real-test-final.png", fullPage: true }).catch(() => {});
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
