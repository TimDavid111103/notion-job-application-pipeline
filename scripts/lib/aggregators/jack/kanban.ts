/**
 * Jack & Jill Jobs-tab kanban — empty the Saved column daily.
 */
import type { Page } from "playwright";
import type { SourcedJob } from "../../job/index.js";
import { isScratchDuplicate } from "../../job/scratch.js";
import { screeningSignals } from "../../job/screening.js";
import { JACK_KANBAN } from "./auth.js";

const RIGHT_PANE_MIN_X = 520;
const SAVED_CARD_SEL = '[role="button"][aria-roledescription="sortable"]';

export async function openKanban(page: Page): Promise<void> {
  await page.goto(JACK_KANBAN, { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.locator(SAVED_CARD_SEL).first().waitFor({ state: "visible", timeout: 9000 }).catch(() => {});
  await page.waitForTimeout(300);
}

async function backToBoard(page: Page): Promise<void> {
  const crumb = page.locator('a[href="/jack/dashboard/jobs/kanban"]').first();
  if (await crumb.isVisible().catch(() => false)) {
    await crumb.click().catch(() => {});
    await page.locator(SAVED_CARD_SEL).first().waitFor({ state: "visible", timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(250);
    return;
  }
  await openKanban(page);
}

export async function savedCount(page: Page): Promise<number> {
  return page.evaluate((minX) => {
    const norm = (s: string) => (s || "").replace(/\s+/g, " ").trim();
    const el = Array.from(document.querySelectorAll<HTMLElement>("*")).find(
      (e) => /^Saved\s*\d+$/.test(norm(e.textContent || "")) && e.getBoundingClientRect().x > minX && e.children.length <= 4
    );
    if (!el) return -1;
    const m = norm(el.textContent || "").match(/(\d+)/);
    return m ? parseInt(m[1], 10) : -1;
  }, RIGHT_PANE_MIN_X);
}

async function tagFirstSavedCard(page: Page): Promise<{ found: boolean; text: string }> {
  return page.evaluate((minX) => {
    const norm = (s: string) => (s || "").replace(/\s+/g, " ").trim();
    document.querySelectorAll("[data-empty-target]").forEach((e) => e.removeAttribute("data-empty-target"));
    const header = Array.from(document.querySelectorAll<HTMLElement>("*")).find(
      (e) => /^Saved\s*\d+$/.test(norm(e.textContent || "")) && e.getBoundingClientRect().x > minX && e.children.length <= 4
    );
    if (!header) return { found: false, text: "" };
    let col: HTMLElement = header;
    for (let i = 0; i < 6; i++) {
      if (col.parentElement) col = col.parentElement;
      if (col.querySelectorAll('[role="button"][aria-roledescription="sortable"]').length > 0) break;
    }
    const card = col.querySelector<HTMLElement>('[role="button"][aria-roledescription="sortable"]');
    if (!card) return { found: false, text: "" };
    card.setAttribute("data-empty-target", "1");
    card.scrollIntoView({ block: "center" });
    return { found: true, text: norm(card.textContent || "").slice(0, 100) };
  }, RIGHT_PANE_MIN_X);
}

interface JobDetail {
  role: string;
  company: string;
  location: string;
  jobUrl: string;
  body: string;
}

async function readOpenJobDetail(page: Page): Promise<JobDetail> {
  await page.evaluate(() => {
    const right = Array.from(document.querySelectorAll<HTMLElement>("button"))
      .filter((b) => /show details/i.test(b.textContent || ""))
      .find((b) => b.getBoundingClientRect().x > 520);
    right?.setAttribute("data-sd", "1");
  });
  await page.locator('[data-sd="1"]').click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(900);

  return page.evaluate((minX) => {
    const norm = (s: string) => (s || "").replace(/\s+/g, " ").trim();
    const R = (el: Element) => el.getBoundingClientRect().x > minX;
    const crumb =
      Array.from(document.querySelectorAll("div,nav,h1,h2"))
        .filter(R)
        .map((e) => norm(e.textContent || ""))
        .find((t) => /^Jobs.+ at .+/.test(t) && t.length < 120) || "";
    const crumbBody = crumb.replace(/^Jobs/, "").trim();
    const at = crumbBody.lastIndexOf(" at ");
    const role = at > 0 ? crumbBody.slice(0, at).trim() : crumbBody;
    const company = at > 0 ? crumbBody.slice(at + 4).trim() : "";
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("a")).filter(R);
    const apply =
      links.find((a) => /view job post|apply/i.test(a.textContent || "")) ||
      links.find((a) => /^https?:/.test(a.getAttribute("href") || "") && !a.href.includes("jackandjill.ai"));
    const jobUrl = apply?.getAttribute("href") || "";
    const isMoney = (s: string) => /[$£€]|\/\s*(yr|year|hr|hour)|\(est\)/i.test(s);
    const location =
      Array.from(document.querySelectorAll("span,p"))
        .filter((e) => R(e) && e.getBoundingClientRect().y < 170)
        .map((e) => norm(e.textContent || ""))
        .find(
          (s) =>
            s !== company &&
            s !== role &&
            !isMoney(s) &&
            s.length < 40 &&
            !/\b(engineer|developer|scientist|manager|analyst|intern|new grad|associate)\b/i.test(s) &&
            (/\b(remote|hybrid|on-?site|in office)\b/i.test(s) || /,\s*[A-Z]{2}\b/.test(s))
        ) || "";
    const body = norm(
      Array.from(document.querySelectorAll("p,li,span"))
        .filter((e) => R(e) && e.children.length === 0)
        .map((e) => e.textContent || "")
        .join(" ")
    ).slice(0, 2500);
    return { role, company, location, jobUrl, body };
  }, RIGHT_PANE_MIN_X);
}

async function archiveOpenJob(page: Page): Promise<boolean> {
  const tagged = await page.evaluate((minX) => {
    const norm = (s: string) => (s || "").replace(/\s+/g, " ").trim();
    document.querySelectorAll("[data-status-btn]").forEach((e) => e.removeAttribute("data-status-btn"));
    const statuses = ["Saved", "Applied", "In Process", "Offer", "Archived"];
    const btn = Array.from(document.querySelectorAll<HTMLElement>("button"))
      .filter((b) => b.getBoundingClientRect().x > minX)
      .find((b) => b.querySelector("svg.lucide-star") || statuses.includes(norm(b.textContent || "")));
    if (!btn) return false;
    btn.setAttribute("data-status-btn", "1");
    return true;
  }, RIGHT_PANE_MIN_X);
  if (!tagged) return false;

  await page.locator("[data-status-btn]").click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(600);
  const archive = page
    .getByRole("menuitem", { name: /^archive$/i })
    .or(page.getByText("Archive", { exact: true }));
  return archive
    .first()
    .click({ timeout: 3000 })
    .then(() => true)
    .catch(() => false);
}

export interface EmptyResult {
  reviewed: number;
  archived: number;
  kept: SourcedJob[];
}

export async function emptySavedColumn(
  page: Page,
  max = Infinity,
  scratchKeys: Set<string> = new Set()
): Promise<EmptyResult> {
  await openKanban(page);
  const start = await savedCount(page);
  console.log(`Saved column starts at ${start}`);

  const kept: SourcedJob[] = [];
  let reviewed = 0;
  let archived = 0;
  let scratchSkipped = 0;

  while (reviewed < max) {
    const tag = await tagFirstSavedCard(page);
    if (!tag.found) {
      console.log("No more Saved cards.");
      break;
    }
    await page.locator('[data-empty-target="1"]').click({ timeout: 5000 }).catch(() => {});
    await page
      .waitForFunction(
        () =>
          Array.from(document.querySelectorAll("button")).some(
            (b) => /show details/i.test(b.textContent || "") && b.getBoundingClientRect().x > 520
          ),
        undefined,
        { timeout: 8000 }
      )
      .catch(() => {});

    const info = await readOpenJobDetail(page);
    const flags = screeningSignals(info.role, info.body);
    const hasUrl = !!info.jobUrl;
    const candidate: SourcedJob = {
      company: info.company || "Unknown",
      role: info.role || "Unknown",
      jobUrl: info.jobUrl,
      source: "Jack & Jill",
      location: info.location,
    };
    const keep = hasUrl && !isScratchDuplicate(candidate, scratchKeys);
    if (hasUrl && !keep) {
      scratchSkipped++;
      console.log(`  SKIP (scratch) ${info.company} — ${info.role}`);
    } else if (keep) {
      kept.push(candidate);
      console.log(`  KEEP   ${info.company} — ${info.role}${flags.length ? `  ⚠ [review] ${flags.join(", ")}` : ""}`);
    } else {
      console.log(`  REJECT ${info.company || "?"} — ${info.role || "?"} (no apply URL)`);
    }

    const ok = await archiveOpenJob(page);
    if (!ok) {
      console.warn("  ! archive failed — stopping to avoid a loop");
      break;
    }
    await page.waitForTimeout(500);
    reviewed++;
    archived++;
    await backToBoard(page);
  }

  const end = await savedCount(page);
  console.log(
    `Saved column now ${end} (was ${start}); reviewed ${reviewed}, archived ${archived}, kept ${kept.length}` +
      (scratchSkipped ? ` (${scratchSkipped} scratch dupes skipped)` : "")
  );
  return { reviewed, archived, kept };
}
