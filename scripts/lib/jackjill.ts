import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Page } from "playwright";
import { REPO_ROOT, waitForManualLogin } from "./browser.js";
import { shouldEliminate, type SourcedJob } from "./scratch.js";

export const JACK_INBOX = "https://app.jackandjill.ai/jack/dashboard/inbox";
export const JACK_LOGGED_IN = /jackandjill\.ai\/jack\/dashboard\/inbox/i;
export const JACK_EMAIL = "tim.david1111@gmail.com";
const PROMPTS_FILE = path.join(REPO_ROOT, "references/jack-prompts.md");

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

async function loadPrompts(): Promise<string[]> {
  const content = await readFile(PROMPTS_FILE, "utf8");
  return content.split("\n").filter((line) => line.length > 80 && !line.startsWith("#") && !line.startsWith("---"));
}

export async function getInboxCount(page: Page): Promise<number> {
  const text = await page.locator("text=Inbox").first().locator("..").innerText().catch(() => "");
  const match = text.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

export async function fillInbox(page: Page, minInbox: number): Promise<void> {
  let count = await getInboxCount(page);
  if (count >= minInbox) return;
  const prompts = await loadPrompts();

  for (let idx = 0; count < minInbox && idx < prompts.length; idx++) {
    const input = page.getByPlaceholder(/message|ask|search/i).or(page.locator("textarea").last());
    await input.fill(prompts[idx % prompts.length]);
    await input.press("Enter");
    console.log(`Sent prompt ${idx + 1}, waiting for Jack...`);
    await page.waitForTimeout(10000);
    count = await getInboxCount(page);
  }
}

export async function reviewInbox(page: Page, limit: number): Promise<SourcedJob[]> {
  const jobs: SourcedJob[] = [];

  for (let i = 0; i < limit; i++) {
    const reviewBtn = page.getByRole("button", { name: /review job/i }).first();
    if (!(await reviewBtn.isVisible({ timeout: 3000 }).catch(() => false))) break;

    await reviewBtn.click();
    await page.waitForTimeout(1500);

    const header = await page.locator("header, [role='dialog']").first().innerText().catch(() => "");
    const body = await page.locator("main, [role='dialog']").innerText().catch(() => "");
    const jobUrl = (await page.getByRole("link", { name: /view job post/i }).getAttribute("href").catch(() => null)) ?? "";

    const lines = header.split("\n").map((l) => l.trim()).filter(Boolean);
    const company = lines[0] ?? "Unknown";
    const role = lines[1] ?? "Unknown";
    const location = lines[2] ?? "";
    const keep = !shouldEliminate(role, body) && jobUrl && jobUrl !== "#";

    if (keep) {
      jobs.push({ company, role, jobUrl, source: "Jack & Jill", location });
      console.log(`Captured: ${company} — ${role}`);
      await page.getByRole("button", { name: /^track$/i }).click();
    } else {
      console.log(`Skipping: ${company} — ${role}`);
      await page.getByRole("button", { name: /not for me/i }).click();
    }
    await page.waitForTimeout(1000);
  }
  return jobs;
}

export async function verifyAccess(page: Page): Promise<{ ok: boolean; ms: number }> {
  const t0 = Date.now();
  await page.goto(JACK_INBOX, { waitUntil: "domcontentloaded" });
  const ok = JACK_LOGGED_IN.test(page.url());
  return { ok, ms: Date.now() - t0 };
}
