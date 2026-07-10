/**
 * Jack & Jill inbox — prompt fill and review-modal sourcing.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Locator, Page } from "playwright";
import { REPO_ROOT } from "../browser.js";
import type { SourcedJob } from "../job.js";
import { isScratchDuplicate } from "../scratch.js";
import { screeningSignals } from "../screening.js";
import { JACK_INBOX } from "./auth.js";

const PROMPTS_FILE = path.join(
  REPO_ROOT,
  ".cursor/skills/aggregator-sourcer/references/jack-inbox-prompts.md"
);

async function loadPrompts(): Promise<string[]> {
  const content = await readFile(PROMPTS_FILE, "utf8");
  return content.split("\n").filter((line) => line.length > 80 && !line.startsWith("#") && !line.startsWith("---"));
}

export async function getInboxCount(page: Page): Promise<number> {
  const label = await page
    .locator('[aria-label*="jobs to review"], [aria-label*="job to review"]')
    .first()
    .getAttribute("aria-label")
    .catch(() => null);
  if (label) {
    const m = label.match(/(\d+)/);
    if (m) return parseInt(m[1], 10);
  }
  return page.getByRole("button", { name: /review job/i }).count().catch(() => 0);
}

async function isJackBusy(page: Page): Promise<boolean> {
  const input = page.locator("textarea").last();
  const disabled = await input.isDisabled().catch(() => false);
  const editable = await input.isEditable().catch(() => true);
  const stop = await page
    .getByRole("button", { name: /stop|cancel|generating/i })
    .first()
    .isVisible()
    .catch(() => false);
  return disabled || !editable || stop;
}

async function waitForComposerIdle(page: Page, timeoutMs = 180_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await isJackBusy(page))) return true;
    await page.waitForTimeout(2000);
  }
  return false;
}

async function sendPrompt(page: Page, text: string): Promise<boolean> {
  const input = page.locator("textarea").last().or(page.getByRole("textbox").last());
  try {
    await input.click({ timeout: 5000 });
    await input.fill(text);
    await input.press("Enter");
    return true;
  } catch {
    return false;
  }
}

async function waitForInboxGrowth(
  page: Page,
  before: number,
  maxMs: number,
  stableMs = 8_000
): Promise<number> {
  const deadline = Date.now() + maxMs;
  let count = before;
  let lastChange = Date.now();
  while (Date.now() < deadline) {
    await page.waitForTimeout(3000);
    const c = await getInboxCount(page);
    if (c > count) {
      count = c;
      lastChange = Date.now();
    }
    if (count > before && Date.now() - lastChange >= stableMs && !(await isJackBusy(page))) {
      break;
    }
  }
  return count;
}

export async function fillInbox(
  page: Page,
  target: number,
  opts: { maxMs?: number; perPromptMs?: number } = {}
): Promise<number> {
  const maxMs = opts.maxMs ?? 10 * 60 * 1000;
  const perPromptMs = opts.perPromptMs ?? 150_000;
  const start = Date.now();

  let count = await getInboxCount(page);
  console.log(`Inbox starts at ${count}; target ${target}`);
  if (count >= target) return count;

  const prompts = await loadPrompts();
  for (let idx = 0; count < target && Date.now() - start < maxMs; idx++) {
    if (!(await waitForComposerIdle(page))) {
      console.warn("Composer never became idle — stopping fill");
      break;
    }
    const prompt = prompts[idx % prompts.length];
    const before = count;
    if (!(await sendPrompt(page, prompt))) {
      console.warn("Could not send prompt — retrying");
      continue;
    }
    console.log(`Sent prompt ${idx + 1} (inbox ${before}/${target}); waiting for Jack to finish...`);
    count = await waitForInboxGrowth(page, before, perPromptMs);
    console.log(`Inbox now ${count}/${target}`);
  }
  console.log(`Fill complete: inbox at ${count} (target ${target})`);
  return count;
}

interface DialogInfo {
  label: string;
  role: string;
  company: string;
  location: string;
  jobUrl: string;
  body: string;
}

async function readDialog(dialog: Locator): Promise<DialogInfo> {
  return dialog.evaluate((d) => {
    const txt = (el: Element | null | undefined) => (el?.textContent || "").trim();
    const label = d.getAttribute("aria-label") || "";
    const role = txt(d.querySelector("p.font-medium"));
    const spans = Array.from(d.querySelectorAll(".text-muted-foreground span"))
      .map((s) => txt(s))
      .filter((s) => s && s !== "•");
    const company = spans[0] || "";
    const location =
      spans.find(
        (s) => !/\$/.test(s) && (/remote|hybrid|on-?site/i.test(s) || /,\s*[A-Z]{2}\b/.test(s))
      ) || "";
    const link = Array.from(d.querySelectorAll("a")).find((a) => /view job post/i.test(a.textContent || ""));
    const jobUrl = link?.getAttribute("href") || "";
    const body = (d.textContent || "").slice(0, 4000);
    return { label, role, company, location, jobUrl, body };
  });
}

async function advanceReview(page: Page, dialog: Locator, keep: boolean, prevLabel: string): Promise<boolean> {
  const clicked = await dialog
    .getByRole("button", { name: keep ? /^track$/i : /not for me/i })
    .first()
    .click({ timeout: 4000 })
    .then(() => true)
    .catch(() => false);
  if (!clicked) return false;

  if (!keep) {
    await page
      .getByRole("button", { name: /skip this role/i })
      .first()
      .click({ timeout: 4000 })
      .catch(() => {});
  }

  try {
    await page.waitForFunction(
      (prev) => {
        const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
        if (dialogs.length === 0) return true;
        return dialogs.some((d) => {
          const label = d.getAttribute("aria-label") || "";
          return label && label !== prev && !/skip|skipping/i.test(label);
        });
      },
      prevLabel,
      { timeout: 8000 }
    );
    return true;
  } catch {
    return false;
  }
}

export async function reviewInbox(
  page: Page,
  maxJobs: number,
  scratchKeys: Set<string> = new Set()
): Promise<SourcedJob[]> {
  const jobs: SourcedJob[] = [];
  let scratchSkipped = 0;
  if (!/dashboard\/inbox/i.test(page.url())) {
    await page.goto(JACK_INBOX, { waitUntil: "domcontentloaded" }).catch(() => {});
  }

  const seen = new Set<string>();
  let reviewed = 0;
  for (let batch = 0; batch < 60 && jobs.length < maxJobs; batch++) {
    const openBtn = page.getByRole("button", { name: /review job/i }).first();
    const has = await openBtn
      .waitFor({ state: "visible", timeout: batch === 0 ? 15000 : 4000 })
      .then(() => true)
      .catch(() => false);
    if (!has) break;
    await openBtn.click().catch(() => {});
    const dialog = page.getByRole("dialog").first();
    await dialog.waitFor({ state: "visible", timeout: 8000 }).catch(() => {});

    let processed = 0;
    for (let i = 0; i < maxJobs + 10; i++) {
      if (!(await dialog.isVisible().catch(() => false))) break;
      const info = await readDialog(dialog);
      const sig = info.jobUrl || info.label;
      if (sig && seen.has(sig)) break;
      if (sig) seen.add(sig);

      const flags = screeningSignals(info.role, info.body);
      const keep = !!info.jobUrl && info.jobUrl !== "#";
      const candidate: SourcedJob = {
        company: info.company || "Unknown",
        role: info.role || "Unknown",
        jobUrl: info.jobUrl,
        source: "Jack & Jill",
        location: info.location,
      };
      const track = keep && !isScratchDuplicate(candidate, scratchKeys);
      if (keep && !track) {
        scratchSkipped++;
        console.log(`Skipped (already in scratch): ${info.company} — ${info.role}`);
      } else if (track) {
        jobs.push(candidate);
        console.log(`Tracked: ${info.company} — ${info.role}${flags.length ? `  ⚠ [review] ${flags.join(", ")}` : ""}`);
      } else {
        console.log(`Rejected (no apply URL): ${info.company || "?"} — ${info.role || "?"}`);
      }
      processed++;
      reviewed++;
      if (!(await advanceReview(page, dialog, keep, info.label))) break;
    }

    if (await dialog.isVisible().catch(() => false)) await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(500);
    if (processed === 0) break;
  }

  if (reviewed === 0) console.log("Jack & Jill: no jobs to review");
  else {
    console.log(`Review complete: ${jobs.length} tracked of ${reviewed} reviewed`);
    if (scratchSkipped) console.log(`  (${scratchSkipped} skipped — already in scratch)`);
  }
  return jobs;
}
