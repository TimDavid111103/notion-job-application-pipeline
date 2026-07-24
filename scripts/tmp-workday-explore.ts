/**
 * TEMP exploration script — not part of the skill. Delete after Workday flow works.
 * Usage: node --import tsx scripts/tmp-workday-explore.ts <jobUrl>
 */
import { mkdir } from "node:fs/promises";
import type { Page } from "playwright";
import { launchBrowser, createContext, openPage } from "./lib/browser/index.js";
import { dismissCookieBanner } from "./lib/fill/application-fill.js";

const OUT_DIR = "data/fill/tmp-workday";
const RESUME_PATH =
  "/Users/timdavid/Desktop/Desktop/Repositories/notion-job-application-pipeline/.cursor/skills/application-filler/assets/documents/resume.pdf";
const EMAIL = "tim.david1111@gmail.com";
const PASSWORD = "dYmmev-vybmu7-dybqox";

async function shot(page: Page, name: string): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  await page.screenshot({ path: `${OUT_DIR}/${name}.png`, fullPage: true }).catch((e) => {
    console.log(`screenshot failed: ${e}`);
  });
  console.log(`[shot] ${name} — url=${page.url()}`);
}

async function dumpAutomationIds(page: Page, label: string): Promise<void> {
  const info = await page.evaluate(() => {
    const els = [...document.querySelectorAll("[data-automation-id]")];
    return els.slice(0, 200).map((el) => {
      const tag = el.tagName.toLowerCase();
      const id = el.getAttribute("data-automation-id");
      const type = (el as HTMLInputElement).type ?? "";
      const text = (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
      return `${tag}${type ? `[type=${type}]` : ""} data-automation-id="${id}" text="${text}"`;
    });
  });
  console.log(`\n--- automation-ids @ ${label} (${info.length}) ---`);
  for (const line of info) console.log(line);
}

async function currentStepName(page: Page): Promise<string> {
  return page
    .locator('[data-automation-id="progressBarActiveStep"]')
    .first()
    .textContent()
    .then((t) => (t ?? "").replace(/^current step \d+ of \d+/i, "").trim())
    .catch(() => "");
}

async function dumpFieldHtml(page: Page, automationId: string): Promise<void> {
  const html = await page
    .locator(`[data-automation-id="${automationId}"]`)
    .first()
    .evaluate((el) => el.outerHTML)
    .catch((e) => `<error: ${e}>`);
  console.log(`\n--- outerHTML @ ${automationId} ---\n${(html ?? "").slice(0, 2500)}`);
}

async function validationErrors(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('[data-automation-id="inputAlert"], [role="alert"]')]
      .map((e) => (e.textContent ?? "").replace(/\s+/g, " ").trim())
      .filter(Boolean)
  );
}

/**
 * Workday "prompt" widget: a button that opens a focusable listbox.
 * Click to open, then TYPE the value + Enter — this drives native browser
 * typeahead-select-on-listbox behavior. No need to locate/click option nodes
 * (they're virtualized and often not the ones actually focused).
 */
async function fillWorkdayPrompt(page: Page, fieldAuto: string, typeText: string): Promise<boolean> {
  const btn = page.locator(`[data-automation-id="${fieldAuto}"] button`).first();
  if (!(await btn.isVisible().catch(() => false))) return false;
  await btn.click();
  await page.waitForTimeout(300);
  await page.keyboard.type(typeText, { delay: 60 });
  await page.waitForTimeout(600);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  const valueNow = (await btn.textContent().catch(() => "")) ?? "";
  const ok = !!valueNow.trim() && !/select one/i.test(valueNow);
  if (!ok) {
    console.log(`  fillWorkdayPrompt(${fieldAuto}, "${typeText}") -> button text now "${valueNow}"`);
    await page.keyboard.press("Escape").catch(() => {});
  }
  return ok;
}

async function goToApplyFlow(page: Page, jobUrl: string): Promise<void> {
  console.log(`Navigating to ${jobUrl}`);
  await page.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(2000);
  await dismissCookieBanner(page);
  await shot(page, "01-job-page");

  const continueApp = page.locator('[data-automation-id="continueButton"]').first();
  if (await continueApp.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log("Found in-progress application — clicking Continue Application...");
    await continueApp.click();
    await page.waitForTimeout(2000);
    await shot(page, "02-continue-application");
    return;
  }

  const apply = page
    .locator('[data-automation-id="adventureButton"]')
    .or(page.getByRole("button", { name: /^apply$/i }))
    .first();
  if (await apply.isVisible({ timeout: 10_000 }).catch(() => false)) {
    console.log("Clicking Apply...");
    await apply.click();
    await page.waitForTimeout(2000);
  } else {
    console.log("Apply button not found!");
  }
  await shot(page, "02-after-apply");

  const applyManual = page
    .locator('[data-automation-id="applyManually"]')
    .or(page.getByRole("button", { name: /apply manually/i }))
    .first();
  if (await applyManual.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log("Clicking Apply Manually...");
    await applyManual.click();
    await page
      .locator('[data-automation-id="signInContent"]')
      .waitFor({ state: "visible", timeout: 20_000 })
      .catch(() => {});
    await page.waitForTimeout(1000);
  } else {
    console.log("Apply Manually button not found!");
  }
  await shot(page, "03-after-apply-manually");

  const emailField = page.locator('input[data-automation-id="email"]');
  const passwordField = page.locator('input[data-automation-id="password"]');
  const verifyField = page.locator('input[data-automation-id="verifyPassword"]');
  const createBtn = page
    .locator('[data-automation-id="click_filter"][aria-label="Create Account"]')
    .or(page.locator('[data-automation-id="createAccountSubmitButton"]'));
  const signInBtn = page
    .locator('[data-automation-id="click_filter"][aria-label="Sign In"]')
    .or(page.locator('button[data-automation-id="signInSubmitButton"]'));

  // Up to 2 attempts: a "Create Account" submit against an email that already has an
  // account on this tenant bounces to a plain Sign In form — retry as Sign In then.
  for (let attempt = 0; attempt < 2; attempt++) {
    if (!(await emailField.isVisible({ timeout: 5000 }).catch(() => false))) {
      if (attempt === 0) console.log("Create Account / Sign In form not visible — assuming already authenticated");
      break;
    }
    const hasVerify = await verifyField.isVisible().catch(() => false);
    if (hasVerify) {
      console.log(`[attempt ${attempt}] Filling Create Account form...`);
      await emailField.fill(EMAIL);
      await passwordField.fill(PASSWORD);
      await verifyField.fill(PASSWORD);
      await createBtn.first().click({ timeout: 10_000 }).catch(async (e) => {
        console.log(`overlay click failed (${e.message.split("\n")[0]}), trying force click`);
        await page.locator('[data-automation-id="createAccountSubmitButton"]').click({ force: true });
      });
    } else {
      console.log(`[attempt ${attempt}] Filling Sign In form...`);
      await emailField.fill(EMAIL);
      await passwordField.fill(PASSWORD);
      await signInBtn.first().click({ timeout: 10_000 }).catch(async (e) => {
        console.log(`overlay click failed (${e.message.split("\n")[0]}), trying Enter key`);
        await passwordField.press("Enter");
      });
    }
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await shot(page, `04-after-account-step-attempt${attempt}`);
    // Bounced back to the same kind of form (e.g. duplicate-email)? loop again (max 2).
    // .waitFor() actively polls (unlike isVisible(), which is a one-shot immediate check),
    // so it survives being called mid-navigation right after a full-page redirect.
    const stillOnEmailForm = await emailField
      .waitFor({ state: "visible", timeout: 6000 })
      .then(() => true)
      .catch(() => false);
    if (!stillOnEmailForm) break;
    console.log("Still on an email/password form after submit — retrying...");
  }
}

async function fillMyInformation(page: Page): Promise<void> {
  console.log("\n=== My Information ===");
  await page.locator('input[name="legalName--firstName"]').fill("Tim-Luther");
  await page.locator('input[name="legalName--lastName"]').fill("David");
  const addressLine1 = page.locator('input[name="addressLine1"]');
  if (await addressLine1.isVisible().catch(() => false)) {
    await addressLine1.fill("1700 Lincoln St");
    console.log("Address Line 1 filled");
  }
  await page.locator('input[name="city"]').fill("Denver");
  await page.locator('input[name="postalCode"]').fill("80202");
  await page.locator('input[name="regionSubdivision1"]').fill("Denver County").catch(() => {});
  await page.locator('input[name="phoneNumber"]').fill("6164065105");
  await page
    .getByRole("radio", { name: /^no$/i })
    .first()
    .check({ force: true })
    .catch(() => {});
  console.log(`State filled: ${await fillWorkdayPrompt(page, "formField-countryRegion", "Colorado")}`);
  console.log(`Source filled: ${await fillWorkdayPrompt(page, "formField-source", "LinkedIn")}`);
  const phoneTypeField = page.locator('[data-automation-id="formField-phoneType"]');
  if (await phoneTypeField.isVisible().catch(() => false)) {
    console.log(`Phone Device Type filled: ${await fillWorkdayPrompt(page, "formField-phoneType", "Mobile")}`);
  }
  await shot(page, "05-my-info-filled");

  await page.locator('[data-automation-id="pageFooterNextButton"]').click();
  await page.waitForTimeout(2500);
  await shot(page, "06-after-my-info-continue");
  const errors = await validationErrors(page);
  console.log(`Validation errors after My Information (${errors.length}):`, errors);
}

async function fillMyExperience(page: Page): Promise<void> {
  console.log("\n=== My Experience ===");
  const resumeInput = page.locator('input[data-automation-id="file-upload-input-ref"]').first();
  if (await resumeInput.count()) {
    await resumeInput.setInputFiles(RESUME_PATH);
    console.log("Resume uploaded");
    await page.waitForTimeout(2000);
  } else {
    console.log("No resume upload field found on My Experience");
  }
  const linkedinField = page.locator('[data-automation-id="formField-linkedInAccount"] input').first();
  if (await linkedinField.isVisible().catch(() => false)) {
    await linkedinField.fill("https://www.linkedin.com/in/tldavid/");
    console.log("LinkedIn URL filled");
  }
  await shot(page, "07-my-experience-filled");

  await page.locator('[data-automation-id="pageFooterNextButton"]').click();
  await page.waitForTimeout(2500);
  await shot(page, "08-after-my-experience-continue");
  const errors = await validationErrors(page);
  console.log(`Validation errors after My Experience (${errors.length}):`, errors);
}

async function inspectApplicationQuestions(page: Page): Promise<void> {
  console.log("\n=== Inspecting Application Questions field HTML ===");
  const ids = await page.evaluate(() =>
    [...document.querySelectorAll('[data-automation-id^="formField-"]')].map((el) =>
      el.getAttribute("data-automation-id")
    )
  );
  console.log("formField ids:", ids);
  // First (eligible to work) — likely a Yes/No prompt or radio; and the free-text compensation one.
  if (ids[0]) await dumpFieldHtml(page, ids[0]);
  if (ids[1]) await dumpFieldHtml(page, ids[1]);
  const compIdx = ids.findIndex((id) => id && /d52a7e50002/.test(id));
  if (compIdx >= 0 && ids[compIdx]) await dumpFieldHtml(page, ids[compIdx]!);

  // "Are you willing to travel for business?" — inspect actual listbox options.
  const travelIdx = ids.findIndex((id) => id && /cb8e36d0006/.test(id));
  if (travelIdx >= 0 && ids[travelIdx]) {
    const travelId = ids[travelIdx]!;
    await dumpFieldHtml(page, travelId);
    const btn = page.locator(`[data-automation-id="${travelId}"] button`).first();
    await btn.click();
    await page.waitForTimeout(600);
    const listboxHtml = await page.evaluate(() => {
      const lb = document.querySelector('[role="listbox"]');
      return lb ? lb.outerHTML.slice(0, 3000) : "(no listbox found)";
    });
    console.log(`\n--- listbox options for ${travelId} ---\n${listboxHtml}`);
    await page.keyboard.press("Escape").catch(() => {});
  }
}

async function main(): Promise<void> {
  const jobUrl = process.argv[2];
  if (!jobUrl) {
    console.error("Usage: node --import tsx scripts/tmp-workday-explore.ts <jobUrl>");
    process.exit(1);
  }

  const browser = await launchBrowser({ headed: true, stealFocus: true });
  const context = await createContext(browser);
  const page = await openPage(context);

  await goToApplyFlow(page, jobUrl);

  let step = await currentStepName(page);
  console.log(`\nCurrent step: "${step}"`);
  await dumpAutomationIds(page, `step-${step || "unknown"}`);

  if (/my information/i.test(step)) {
    await fillMyInformation(page);
    step = await currentStepName(page);
    console.log(`\nCurrent step: "${step}"`);
  }

  if (/my experience/i.test(step)) {
    await fillMyExperience(page);
    step = await currentStepName(page);
    console.log(`\nCurrent step: "${step}"`);
  }

  if (/application questions/i.test(step)) {
    await inspectApplicationQuestions(page);
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
