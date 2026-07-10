/**
 * Headed one-time login for Wobo — saves session to .auth/wobo.json.
 * Re-run only when test:access fails or sourcing hits an expired session.
 */
import { launchBrowser, createContext, waitForManualLogin } from "../lib/browser/index.js";

const EMAIL = "30.recess_archaea@icloud.com";

const WOBO_LOGGED_IN = /wobo\.ai\/dashboard/i;

async function main(): Promise<void> {
  console.log("=== Wobo login ===");
  console.log("A Chrome window should open. Use EMAIL login (not Google SSO).");
  console.log(`Email: ${EMAIL}`);
  console.log("Password: paste from chat when prompted in browser.\n");

  const browser = await launchBrowser({ headed: true, aggregator: "wobo" });
  const context = await createContext(browser, "wobo", true);
  const page = await context.newPage();

  await page.goto("https://www.wobo.ai/", { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: /sign in/i }).click().catch(() =>
    page.getByRole("button", { name: /sign in/i }).click()
  );

  const emailField = page.getByRole("textbox", { name: /email/i }).or(
    page.locator('input[type="email"]')
  );
  if (await emailField.isVisible({ timeout: 8000 }).catch(() => false)) {
    await emailField.fill(EMAIL);
    console.log("Email filled. Enter password and submit in the browser window.");
  } else {
    console.log("No email field yet — choose email login in the browser if you see Google SSO.");
  }

  console.log("\nWaiting for you to reach the dashboard (https://www.wobo.ai/dashboard)...");
  await waitForManualLogin(page, "wobo", WOBO_LOGGED_IN);
  console.log("Login saved. You can close the window or it will close automatically.");
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
