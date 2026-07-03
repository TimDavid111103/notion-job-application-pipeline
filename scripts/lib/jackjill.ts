/**
 * Jack & Jill automation — inbox review queue + Jobs-tab Saved kanban.
 *
 * Two overlapping surfaces: inbox (Review job modals) and Saved column (auto-saved
 * web jobs). Prompts load from the skill references folder. Inbox fill uses
 * condition-based waits — never fixed sleeps — and never sends while Jack is busy.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Locator, Page } from "playwright";
import { REPO_ROOT, waitForManualLogin } from "./browser.js";
import { screeningSignals, type SourcedJob } from "./scratch.js";

export const JACK_INBOX = "https://app.jackandjill.ai/jack/dashboard/inbox";
export const JACK_KANBAN = "https://app.jackandjill.ai/jack/dashboard/jobs/kanban";
export const JACK_LOGGED_IN = /jackandjill\.ai\/jack\/dashboard\/inbox/i;
export const JACK_EMAIL = "tim.david1111@gmail.com";
const PROMPTS_FILE = path.join(
  REPO_ROOT,
  ".cursor/skills/job-aggregators/references/jack-prompts.md"
); // read at runtime by fillInbox — keep in sync with skill references

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

/** Reads the inbox count from the "N new jobs to review" aria-label. */
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

/**
 * True while Jack is actively generating — the composer is disabled/readonly or a
 * stop/cancel control is showing. We must NEVER send a prompt in this state
 * (it would overwrite the in-flight search).
 */
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

/** Waits until Jack is idle and the composer is ready to accept a new prompt. */
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

/**
 * After a prompt is sent, waits for the inbox count to actually grow and then
 * settle (no further increase for `stableMs`). This is condition-based — it keys
 * off Jack's real output, never a fixed per-prompt sleep — so slow searches are
 * given as long as they need (up to `maxMs`).
 */
async function waitForInboxGrowth(
  page: Page,
  before: number,
  maxMs: number,
  stableMs = 10_000
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
    // Stop once it has grown past `before` AND held steady, but only while Jack is idle
    if (count > before && Date.now() - lastChange >= stableMs && !(await isJackBusy(page))) {
      break;
    }
  }
  return count;
}

/**
 * Sends search prompts until the inbox has at least `target` reviewable jobs.
 * Never sends a prompt while Jack is still searching, and waits on the inbox
 * count actually rising (condition-based) rather than a fixed timer. Cycles the
 * prompt list (varying wording) and gives up after `maxMs` overall. Returns the
 * final inbox count.
 */
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
      .filter((s) => s && s !== "•"); // drop bullet separators
    const company = spans[0] || "";
    // Location = a remote/hybrid/onsite tag or "City, ST" — never a salary span.
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

/**
 * Actions the current review-modal job: Track (keep) or Not-for-me (reject).
 * "Not for me" pops a second "Skipping this one?" confirmation whose "Skip this
 * role" button must be clicked. Then waits for the next job or the modal to close.
 */
async function advanceReview(page: Page, dialog: Locator, keep: boolean, prevLabel: string): Promise<boolean> {
  const clicked = await dialog
    .getByRole("button", { name: keep ? /^track$/i : /not for me/i })
    .first()
    .click({ timeout: 4000 })
    .then(() => true)
    .catch(() => false);
  if (!clicked) return false;

  if (!keep) {
    // Confirm the skip dialog ("Skip this role").
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
        if (dialogs.length === 0) return true; // all modals closed = finished
        // Ignore any transient confirmation dialog; wait for the main review
        // dialog's job to change (its aria-label differs from the previous job).
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

/**
 * Opens the review modal once and walks through EVERY job in the inbox using
 * Track / Not-for-me (scoped to the dialog so it never collides with the inline
 * Track buttons in the chat feed). Continues until the inbox is exhausted (modal
 * closes or the list wraps). `maxJobs` is only a safety cap on iterations.
 * Company/role/URL are read from the modal DOM.
 */
export async function reviewInbox(page: Page, maxJobs: number): Promise<SourcedJob[]> {
  const jobs: SourcedJob[] = [];
  // Make sure we're on a fully-loaded inbox — the review UI hydrates async, so a
  // premature check falsely reports "no jobs".
  if (!/dashboard\/inbox/i.test(page.url())) {
    await page.goto(JACK_INBOX, { waitUntil: "domcontentloaded" }).catch(() => {});
  }

  const seen = new Set<string>();
  let reviewed = 0;
  // The inbox can hold several independent review batches, each with its own
  // "Review job" button that opens a one-or-more-job modal. Loop over batches.
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
      if (sig && seen.has(sig)) break; // wrapped around within this modal
      if (sig) seen.add(sig);

      // Regex only ALERTS — it never eliminates. Track anything with a real apply URL and
      // surface flags for the agent's judgement (see skill references/job-judgement.md).
      const flags = screeningSignals(info.role, info.body);
      const keep = !!info.jobUrl && info.jobUrl !== "#";
      if (keep) {
        jobs.push({
          company: info.company || "Unknown",
          role: info.role || "Unknown",
          jobUrl: info.jobUrl,
          source: "Jack & Jill",
          location: info.location,
        });
        console.log(`Tracked: ${info.company} — ${info.role}${flags.length ? `  ⚠ [review] ${flags.join(", ")}` : ""}`);
      } else {
        console.log(`Rejected (no apply URL): ${info.company || "?"} — ${info.role || "?"}`);
      }
      processed++;
      reviewed++;
      if (!(await advanceReview(page, dialog, keep, info.label))) break;
    }

    // Close any leftover modal before looking for the next batch.
    if (await dialog.isVisible().catch(() => false)) await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(500);
    if (processed === 0) break; // nothing actioned this batch → avoid a loop
  }

  if (reviewed === 0) console.log("Jack & Jill: no jobs to review");
  else console.log(`Review complete: ${jobs.length} tracked of ${reviewed} reviewed`);
  return jobs;
}

export async function verifyAccess(page: Page): Promise<{ ok: boolean; ms: number }> {
  const t0 = Date.now();
  await page.goto(JACK_INBOX, { waitUntil: "domcontentloaded" });
  const ok = JACK_LOGGED_IN.test(page.url());
  return { ok, ms: Date.now() - t0 };
}

// ---------------------------------------------------------------------------
// Jobs kanban board — emptying the "Saved" column.
//
// Jack auto-saves many web-sourced jobs directly into the Jobs tab's "Saved"
// kanban column (separate from the inbox review flow). End-of-day goal: review
// each Saved job, keep the good ones (append to the scratch file) and archive
// every one so the column returns to empty.
// ---------------------------------------------------------------------------

const RIGHT_PANE_MIN_X = 520; // detail panel + board live right of the chat

const SAVED_CARD_SEL = '[role="button"][aria-roledescription="sortable"]';

export async function openKanban(page: Page): Promise<void> {
  await page.goto(JACK_KANBAN, { waitUntil: "domcontentloaded" }).catch(() => {});
  // Wait for the board to render rather than a fixed sleep. If the column is
  // empty this times out quickly and we proceed (caller detects "no cards").
  await page.locator(SAVED_CARD_SEL).first().waitFor({ state: "visible", timeout: 9000 }).catch(() => {});
  await page.waitForTimeout(300);
}

/** Returns to the board via the SPA breadcrumb (faster than a full reload). */
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

/** Reads the "Saved N" column count from its header. Returns -1 if not found. */
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

/** Tags the first card in the Saved column so Playwright can click the real element. */
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

/**
 * Reads the open job's detail panel. Role + company come from the breadcrumb
 * ("Jobs{Role} at {Company}"); the apply URL comes from the right-pane
 * "View job post" link, which only renders after expanding the RIGHT "Show
 * details" button (there's a second one in the chat feed — we must avoid it).
 */
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
    // Apply URL: right-pane "View job post" link, else any external link.
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("a")).filter(R);
    const apply =
      links.find((a) => /view job post|apply/i.test(a.textContent || "")) ||
      links.find((a) => /^https?:/.test(a.getAttribute("href") || "") && !a.href.includes("jackandjill.ai"));
    const jobUrl = apply?.getAttribute("href") || "";
    // Location: best-effort from the header block spans.
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

/** Opens the status control on the open job and selects "Archive". */
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

/**
 * Walks the Saved column: opens each job, expands details, decides keep/reject,
 * collects keepers, and archives every processed job so it leaves circulation.
 * Processes up to `max` cards (default: the whole column). Returns keepers +
 * counts; the caller is responsible for appending keepers to the scratch file.
 */
export async function emptySavedColumn(page: Page, max = Infinity): Promise<EmptyResult> {
  await openKanban(page);
  const start = await savedCount(page);
  console.log(`Saved column starts at ${start}`);

  const kept: SourcedJob[] = [];
  let reviewed = 0;
  let archived = 0;

  while (reviewed < max) {
    const tag = await tagFirstSavedCard(page);
    if (!tag.found) {
      console.log("No more Saved cards.");
      break;
    }
    await page.locator('[data-empty-target="1"]').click({ timeout: 5000 }).catch(() => {});
    // Wait for the detail pane to render (its own "Show details" button appears).
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
    // Regex only ALERTS — it never eliminates. Keep anything with a real apply URL and surface
    // flags for the agent's judgement (see skill references/job-judgement.md). The card is archived
    // regardless; curation of the kept list happens before logging to Notion.
    const flags = screeningSignals(info.role, info.body);
    const keep = !!info.jobUrl;
    if (keep) {
      kept.push({
        company: info.company || "Unknown",
        role: info.role || "Unknown",
        jobUrl: info.jobUrl,
        source: "Jack & Jill",
        location: info.location,
      });
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
    // Clicking a card swaps the right pane from board → detail, so return to the
    // board (via SPA breadcrumb) before processing the next card.
    await backToBoard(page);
  }

  const end = await savedCount(page);
  console.log(`Saved column now ${end} (was ${start}); reviewed ${reviewed}, archived ${archived}, kept ${kept.length}`);
  return { reviewed, archived, kept };
}
