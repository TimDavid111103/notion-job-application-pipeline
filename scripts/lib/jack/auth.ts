/**
 * Jack & Jill — session and URL constants.
 */
import type { Page } from "playwright";
import { waitForManualLogin } from "../browser.js";

export const JACK_INBOX = "https://app.jackandjill.ai/jack/dashboard/inbox";
export const JACK_KANBAN = "https://app.jackandjill.ai/jack/dashboard/jobs/kanban";
export const JACK_LOGGED_IN = /jackandjill\.ai\/jack\/dashboard\/inbox/i;
export const JACK_EMAIL = "tim.david1111@gmail.com";

export async function ensureLoggedIn(page: Page): Promise<void> {
  await page.goto(JACK_INBOX, { waitUntil: "domcontentloaded" });
  if (!page.url().includes("sign-in")) return;

  const emailField = page.getByRole("textbox", { name: /email/i }).or(page.locator('input[type="email"]'));
  if (await emailField.isVisible({ timeout: 5000 }).catch(() => false)) {
    await emailField.fill(JACK_EMAIL);
    console.log("\n[Jack & Jill] Session expired — run npm run auth:jackjill.");
  }
  await waitForManualLogin(page, "jackjill", JACK_LOGGED_IN);
}

export async function verifyAccess(page: Page): Promise<{ ok: boolean; ms: number }> {
  const t0 = Date.now();
  await page.goto(JACK_INBOX, { waitUntil: "domcontentloaded" });
  const ok = JACK_LOGGED_IN.test(page.url());
  return { ok, ms: Date.now() - t0 };
}
