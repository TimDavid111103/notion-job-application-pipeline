import type { Page } from "playwright";
import { waitForManualLogin } from "./browser.js";
import { isHourlyCompensation, shouldEliminate, type SourcedJob } from "./scratch.js";

export const HANDSHAKE_JOB_SEARCH = "https://app.joinhandshake.com/job-search";
export const HANDSHAKE_LOGGED_IN = /joinhandshake\.com\/(job-search|jobs\/)/i;
export const SEARCH_TERMS = ["Junior AI Engineer", "Agentic AI"];

export function jobSearchInput(page: Page) {
  return page.locator('input[name="query"]');
}

export function isHandshakeLoggedIn(url: string, title: string): boolean {
  return HANDSHAKE_LOGGED_IN.test(url) && !/just a moment/i.test(title);
}

export async function waitForJobSearchReady(page: Page): Promise<void> {
  await jobSearchInput(page).waitFor({ state: "visible", timeout: 15000 });
}

export async function ensureLoggedIn(page: Page): Promise<void> {
  await page.goto(HANDSHAKE_JOB_SEARCH, { waitUntil: "domcontentloaded" });
  const title = await page.title();
  const body = await page.locator("body").innerText();
  if (/just a moment|cloudflare/i.test(title) || /\b(sign in|log in)\b/i.test(body)) {
    console.log("\n[Handshake] Session expired — run npm run auth:handshake.");
    await waitForManualLogin(page, "handshake", HANDSHAKE_LOGGED_IN);
  }
}

export async function applyFilters(page: Page): Promise<void> {
  await page.goto(HANDSHAKE_JOB_SEARCH, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /filters/i }).click();
  await page.waitForTimeout(1000);

  const selectOption = async (label: string, value: RegExp) => {
    await page.locator(`text=${label}`).locator("..").getByText(value).click().catch(() => {});
  };

  await selectOption("Employment type", /full-?time/i);
  await selectOption("Job type", /^job$/i);
  await selectOption("Pay and benefits", /paid/i);
  for (const loc of [/onsite/i, /remote/i, /hybrid/i]) {
    await selectOption("Onsite/remote", loc).catch(() => {});
  }
  await selectOption("Work authorization", /visa sponsorship/i).catch(() => {});
  await selectOption("Work authorization", /optional practical training|opt/i).catch(() => {});
  await page.getByRole("button", { name: /^apply$/i }).click();
  await page.waitForLoadState("networkidle").catch(() => page.waitForTimeout(1500));
}

export async function searchAndCollect(page: Page, term: string, limit: number): Promise<SourcedJob[]> {
  const jobs: SourcedJob[] = [];
  await waitForJobSearchReady(page);
  const searchBox = jobSearchInput(page);
  await searchBox.fill(term);
  await searchBox.press("Enter");
  await page.waitForLoadState("networkidle").catch(() => page.waitForTimeout(2000));

  const jobLinks = page.locator('a[href*="/jobs/"]');
  const count = Math.min(await jobLinks.count(), limit * 3);

  for (let i = 0; i < count && jobs.length < limit; i++) {
    const link = jobLinks.nth(i);
    const listingText = await link.innerText().catch(() => "");
    const title = listingText.split("\n")[0] ?? "";
    if (shouldEliminate(title, listingText) || isHourlyCompensation(listingText)) continue;

    await link.click();
    await page.waitForTimeout(1500);
    const jobUrl = page.url();
    if (!jobUrl.includes("/jobs/")) continue;

    const panelText = await page.locator("main, [role='main']").innerText().catch(() => listingText);
    if (shouldEliminate(title, panelText) || isHourlyCompensation(panelText)) continue;

    const moreBtn = page.getByRole("button", { name: /^more$/i });
    if (await moreBtn.isVisible({ timeout: 500 }).catch(() => false)) await moreBtn.click();

    const lines = listingText.split("\n").map((l) => l.trim()).filter(Boolean);
    jobs.push({
      company: lines[1] ?? "Unknown",
      role: lines[0] ?? "Unknown",
      jobUrl,
      source: "Handshake",
      location: lines.find((l) => /remote|hybrid|onsite|, [A-Z]{2}/i.test(l)) ?? "",
    });
    console.log(`Captured: ${lines[1]} — ${lines[0]}`);
  }
  return jobs;
}

export async function verifyAccess(page: Page): Promise<{ ok: boolean; ms: number }> {
  const t0 = Date.now();
  await page.goto(HANDSHAKE_JOB_SEARCH, { waitUntil: "domcontentloaded" });
  const title = await page.title();
  const url = page.url();
  await waitForJobSearchReady(page).catch(() => {});
  const ok = isHandshakeLoggedIn(url, title) && (await jobSearchInput(page).isVisible());
  return { ok, ms: Date.now() - t0 };
}
