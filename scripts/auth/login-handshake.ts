/**
 * Headed one-time login for Handshake — saves session to .auth/handshake.json.
 * Cloudflare challenge may appear on first login; complete it in the browser.
 */
import { launchBrowser, createContext, waitForManualLogin } from "../lib/browser/index.js";

const HANDSHAKE_JOB_SEARCH = "https://app.joinhandshake.com/job-search";
const HANDSHAKE_LOGGED_IN = /joinhandshake\.com\/(stu\/|edu\/|job-search|jobs\/)/i;

async function main(): Promise<void> {
  console.log("=== Handshake login ===");
  console.log("A Chrome window should open.");
  console.log("If Cloudflare appears, complete the challenge.");
  console.log("Log in with your school/Handshake credentials.");
  console.log(`Target after login: ${HANDSHAKE_JOB_SEARCH}\n`);

  const browser = await launchBrowser({ headed: true, aggregator: "handshake" });
  const context = await createContext(browser, "handshake", true);
  const page = await context.newPage();

  await page.goto(HANDSHAKE_JOB_SEARCH, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const title = await page.title();
  if (/just a moment/i.test(title)) {
    console.log("Cloudflare challenge detected — complete it in the browser.");
  }

  const needsLogin = await page.getByRole("link", { name: /log in|sign in/i }).isVisible({ timeout: 3000 }).catch(() => false)
    || await page.getByRole("button", { name: /log in|sign in/i }).isVisible({ timeout: 1000 }).catch(() => false);

  if (needsLogin) {
    console.log("Sign in when ready. Waiting for job search page...");
  } else if (HANDSHAKE_LOGGED_IN.test(page.url())) {
    console.log("Already logged in — saving session.");
  } else {
    console.log("Complete any login prompts in the browser...");
  }

  await waitForManualLogin(page, "handshake", HANDSHAKE_LOGGED_IN);
  console.log("Login saved to .auth/handshake.json");
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
