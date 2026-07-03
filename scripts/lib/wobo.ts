import type { Locator, Page } from "playwright";
import { waitForManualLogin } from "./browser.js";
import { shouldEliminate, type SourcedJob } from "./scratch.js";

export const WOBO_DASHBOARD = "https://www.wobo.ai/dashboard";
export const WOBO_LOGGED_IN = /wobo\.ai\/dashboard/i;
const CAUGHT_UP = /all caught up|no more matches/i;

export async function openDashboard(page: Page): Promise<void> {
  await page.goto(WOBO_DASHBOARD, { waitUntil: "domcontentloaded" });
  const needsLogin = await page.getByRole("link", { name: /sign in/i }).isVisible({ timeout: 1500 }).catch(() => false);
  if (!needsLogin && WOBO_LOGGED_IN.test(page.url())) return;

  await page.goto("https://www.wobo.ai/", { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: /sign in/i }).click().catch(() =>
    page.getByRole("button", { name: /sign in/i }).click()
  );
  console.log("\n[Wobo] Session expired — run npm run auth:wobo or complete login in browser.");
  await waitForManualLogin(page, "wobo", WOBO_LOGGED_IN);
  await page.goto(WOBO_DASHBOARD, { waitUntil: "domcontentloaded" });
}

export async function waitForFeedReady(page: Page): Promise<void> {
  await page.getByRole("button", { name: /^save$/i }).first().waitFor({ state: "visible", timeout: 15000 });
}

export function isCaughtUp(page: Page): Promise<boolean> {
  return page.getByText(CAUGHT_UP).isVisible({ timeout: 500 }).catch(() => false);
}

export async function dismissAutopilot(page: Page): Promise<void> {
  const skip = page.getByRole("button", { name: /skip for now/i });
  if (await skip.isVisible({ timeout: 500 }).catch(() => false)) {
    await skip.click({ force: true });
  }
}

function parseCardText(text: string): { company: string; role: string; location: string } {
  const roleMatch = text.match(/(?:SOLID FIT|GOOD FIT|WEAK FIT|STRONG FIT)?\s*\n?([^\n]+)\n(?:Remote|Hybrid|On-?site)/i);
  const role = roleMatch?.[1]?.trim() ?? "Unknown";
  const company = text.split("\n").find((l) => l.length > 1 && l !== role && !/fit|remote|hybrid|\$|yrs|view original|feed|settings|light mode/i.test(l)) ?? "Unknown";
  const location = text.match(/(Remote|Hybrid|On-?site|[A-Z][a-z]+,\s*[A-Z]{2})/)?.[0] ?? "";
  return { company, role, location };
}

export async function extractCardFromLink(page: Page, link: Locator): Promise<SourcedJob | null> {
  let jobUrl = await link.getAttribute("href");
  if (!jobUrl || jobUrl === "#") return null;
  if (jobUrl.startsWith("/")) jobUrl = new URL(jobUrl, page.url()).href;

  const card = link.locator("xpath=ancestor::div[contains(@class,'rounded')][1]").first();
  const text = await card.innerText().catch(() => "");
  const { company, role, location } = parseCardText(text);
  if (shouldEliminate(role, text)) return null;

  return {
    company,
    role,
    jobUrl,
    source: "Wobo",
    location,
  };
}

export async function extractVisibleCards(page: Page, limit: number): Promise<SourcedJob[]> {
  const jobs: SourcedJob[] = [];
  const links = page.getByRole("link", { name: /view original/i });
  const count = Math.min(await links.count(), limit);

  for (let i = 0; i < count; i++) {
    const job = await extractCardFromLink(page, links.nth(i));
    if (job) jobs.push(job);
  }
  return jobs;
}

export async function clickAdvance(page: Page, action: "save" | "decline"): Promise<void> {
  const name = action === "save" ? /^save$/i : /^decline$/i;
  const before = await page.getByRole("link", { name: /view original/i }).first().getAttribute("href");
  await page.getByRole("button", { name }).first().click({ force: true, timeout: 5000 });
  await page.waitForFunction(
    (prev) => {
      const link = document.querySelector('a[href*="greenhouse"], a[href*="ashby"], a[href*="lever"], a[href*="myworkday"], a[href*="smartrecruiters"]');
      return link && link.getAttribute("href") !== prev;
    },
    before,
    { timeout: 8000 }
  ).catch(() => page.waitForTimeout(1000));
}

/** Headless access check */
export async function verifyAccess(page: Page): Promise<{ ok: boolean; ms: number }> {
  const t0 = Date.now();
  await page.goto(WOBO_DASHBOARD, { waitUntil: "domcontentloaded" });
  await waitForFeedReady(page);
  const ok = WOBO_LOGGED_IN.test(page.url());
  return { ok, ms: Date.now() - t0 };
}
