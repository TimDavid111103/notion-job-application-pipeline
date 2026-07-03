import { launchBrowser, createContext, waitForManualLogin } from "../lib/browser.js";

const EMAIL = "tim.david1111@gmail.com";
const JACK_INBOX = "https://app.jackandjill.ai/jack/dashboard/inbox";
const JACK_LOGGED_IN = /jackandjill\.ai\/jack\/dashboard\/inbox/i;

async function main(): Promise<void> {
  console.log("=== Jack & Jill login ===");
  console.log("A Chrome window should open.");
  console.log(`Email: ${EMAIL}`);
  console.log("Complete password or verification code in the browser.");
  console.log(`Target after login: ${JACK_INBOX}\n`);

  const browser = await launchBrowser({ headed: true, aggregator: "jackjill" });
  const context = await createContext(browser, "jackjill", true);
  const page = await context.newPage();

  await page.goto(JACK_INBOX, { waitUntil: "domcontentloaded" });

  if (page.url().includes("sign-in")) {
    const emailField = page.getByRole("textbox", { name: /email/i }).or(
      page.locator('input[type="email"]')
    );
    if (await emailField.isVisible({ timeout: 8000 }).catch(() => false)) {
      await emailField.fill(EMAIL);
      console.log("Email filled. Enter password/verification code and submit.");
    }
  } else if (JACK_LOGGED_IN.test(page.url())) {
    console.log("Already logged in — saving session.");
  }

  console.log("\nWaiting for inbox...");
  await waitForManualLogin(page, "jackjill", JACK_LOGGED_IN);
  console.log("Login saved to .auth/jackjill.json");
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
