/**
 * Handshake job-search automation — filter panel + list-scrape (no per-job navigation).
 *
 * Jobs are extracted from search results in one pass. List cards are distinguished from
 * the detail-panel "Similar Jobs" by their "Save {role}" aria-label (not "Save this job").
 */
import type { Page } from "playwright";
import { waitForManualLogin } from "./browser.js";
import { screeningSignals } from "./screening.js";
import { isScratchDuplicate } from "./scratch.js";
import type { SourcedJob } from "./job.js";

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
  // Cloudflare interstitial or sign-in page both require headed re-auth.
  if (/just a moment|cloudflare/i.test(title) || /\b(sign in|log in)\b/i.test(body)) {
    console.log("\n[Handshake] Session expired — run npm run auth:handshake.");
    await waitForManualLogin(page, "handshake", HANDSHAKE_LOGGED_IN);
  }
}

/**
 * Best-effort filter application. Never throws — if the panel layout shifts we
 * still fall through to searching (search + elimination is the real filter).
 * The Apply button is the filters-form submit, disambiguated from the many
 * per-job "Apply" buttons by its `form` attribute.
 */
export async function applyFilters(page: Page): Promise<void> {
  try {
    await page.goto(HANDSHAKE_JOB_SEARCH, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /^filters$/i }).first().click({ timeout: 5000 });
    await page.waitForTimeout(800);

    const check = async (value: RegExp) => {
      const opt = page.getByRole("checkbox", { name: value }).first();
      if (await opt.isVisible({ timeout: 400 }).catch(() => false)) {
        await opt.check({ timeout: 1500 }).catch(() => {});
      }
    };
    await check(/full-?time/i);
    await check(/^open to us visa sponsorship$/i);
    await check(/optional practical training|opt/i);

    const apply = page.locator('button[type="submit"][form="job-search-form-advanced-filters"]');
    if (await apply.isVisible({ timeout: 1000 }).catch(() => false)) {
      await apply.click({ timeout: 3000 }).catch(() => {});
    }
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  } catch (err) {
    console.log(`Handshake filters skipped: ${(err as Error).message}`);
    await page.keyboard.press("Escape").catch(() => {});
  }
}

/**
 * Searches for a term and extracts jobs directly from the results list (no
 * per-job click/navigation). Role comes from the row's "Save <role>" button
 * aria-label (reliable); the canonical URL is built from the job id in the href.
 */
export async function searchAndCollect(
  page: Page,
  term: string,
  limit: number,
  scratchKeys: Set<string> = new Set()
): Promise<SourcedJob[]> {
  const jobs: SourcedJob[] = [];
  let scratchSkipped = 0;
  await waitForJobSearchReady(page);
  const searchBox = jobSearchInput(page);
  await searchBox.fill(term);
  await searchBox.press("Enter");
  await page
    .locator('a[href*="/jobs/"]')
    .first()
    .waitFor({ state: "visible", timeout: 12000 })
    .catch(() => {});
  await page.waitForTimeout(800);

  // Results-list cards link to /job-search/{id}; the right-hand detail panel's
  // "Similar Jobs" link to /jobs/{id}. We only want the list, identified by a
  // card-level "Save <role>" button (the detail/similar buttons say "Save this
  // job: <role>"), and build the canonical /jobs/{id} URL from the list id.
  const rows = await page.$$eval('a[href*="/job-search/"]', (links) => {
    const out: Array<{ jobUrl: string; role: string; text: string }> = [];
    const seen = new Set<string>();
    for (const a of links as HTMLAnchorElement[]) {
      const m = (a.getAttribute("href") || "").match(/\/job-search\/(\d+)/);
      if (!m) continue;
      const id = m[1];
      if (seen.has(id)) continue;
      const card = (a.closest("li") || a.closest("article") || a.parentElement) as HTMLElement | null;
      const saveBtn = card?.querySelector(
        'button[aria-label^="Save "]:not([aria-label*="this job"])'
      );
      if (!saveBtn) continue; // not a results-list card (detail/similar/other)
      seen.add(id);
      const role = (saveBtn.getAttribute("aria-label") || "").replace(/^Save\s+/i, "").trim();
      const text = (card?.innerText || a.textContent || "").trim();
      out.push({ jobUrl: `https://app.joinhandshake.com/jobs/${id}`, role, text });
    }
    return out;
  });

  for (const row of rows) {
    if (jobs.length >= limit) break;
    const lines = row.text.split("\n").map((l) => l.trim()).filter(Boolean);
    const role = row.role || lines[1] || lines[0] || "Unknown";
    const company =
      lines.find(
        (l) => l !== role && !/\$|\/yr|\/hr|full-?time|part-?time|remote|hybrid|onsite|^new$|posted/i.test(l)
      ) ?? "Unknown";
    const location = lines.find((l) => /remote|hybrid|onsite|,\s*[A-Z]{2}\b/i.test(l)) ?? "";
    const candidate: SourcedJob = {
      company,
      role,
      jobUrl: row.jobUrl,
      source: "Handshake",
      location,
    };
    if (isScratchDuplicate(candidate, scratchKeys)) {
      scratchSkipped++;
      continue;
    }
    // Regex only ALERTS — it never eliminates. Capture and surface flags for agent judgement
    // (see skill references/job-judgement.md); curation happens before logging to Notion.
    const flags = screeningSignals(role, row.text);

    jobs.push(candidate);
    console.log(`Captured: ${company} — ${role}${flags.length ? `  ⚠ [review] ${flags.join(", ")}` : ""}`);
  }
  if (scratchSkipped) console.log(`Handshake "${term}": skipped ${scratchSkipped} already in scratch`);
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
