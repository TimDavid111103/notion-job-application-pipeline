/**
 * Cookie / consent banner dismissal — shared by the generic ATS filler and Workday filler.
 */
import type { Page } from "playwright";

const COOKIE_ACCEPT_PATTERNS = [
  /accept\s*all\s*cookies/i,
  /accept\s*all/i,
  /allow\s*all\s*cookies/i,
  /allow\s*all/i,
  /^accept$/i,
  /agree\s*and\s*continue/i,
  /i\s*agree/i,
];

/** Dismiss cookie / consent overlays that block Apply and form fields (Workable, Workday, etc.). */
export async function dismissCookieBanner(page: Page): Promise<boolean> {
  for (const re of COOKIE_ACCEPT_PATTERNS) {
    const btn = page.getByRole("button", { name: re }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ timeout: 3_000 }).catch(() => {});
      await page.waitForTimeout(500);
      return true;
    }
  }
  // Some banners use links or custom roles.
  for (const re of COOKIE_ACCEPT_PATTERNS) {
    const el = page.locator("button, a, [role='button']").filter({ hasText: re }).first();
    if (await el.isVisible().catch(() => false)) {
      await el.click({ timeout: 3_000 }).catch(() => {});
      await page.waitForTimeout(500);
      return true;
    }
  }
  return false;
}
