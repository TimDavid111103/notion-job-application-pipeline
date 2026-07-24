/**
 * Workday (`myworkdayjobs.com`) application flow.
 *
 * Workday is fundamentally different from other ATS hosts the generic engine in
 * `application-fill.ts` targets:
 *   - Every tenant (employer) is a separate account system — Apply → Apply Manually →
 *     Create Account / Sign In using one shared, reusable email+password (see
 *     `assets/workday-account.md`; every tenant is its own account, never a shared session).
 *   - The application itself is a multi-step wizard (My Information, My Experience,
 *     Application Questions, Voluntary Disclosures, Self Identify, Review) — each step
 *     must be discovered and filled independently, then advanced with "Save and Continue".
 *   - Most non-text controls are Workday's custom "prompt" widget (a button that opens a
 *     virtualized listbox) rather than a native `<select>` — filled via click → type → Enter
 *     (typeahead-select), not by clicking option nodes.
 *
 * Field label/value resolution reuses the same shared lookup engine as every other ATS
 * (`lookupField` / `matchYesNo` / `personal-information.md` / `answers.md`) so answers stay
 * consistent across hosts. Stops at the Review step — submission stays human-in-the-loop,
 * matching the rest of the skill.
 */
import { readFileSync } from "node:fs";
import type { Page } from "playwright";
import type { FillQueueItem, FillResultItem, UnfilledField } from "../artifacts/fill-artifacts.js";
import {
  type FillContext,
  type FillReferences,
  type FillSource,
  buildCoverLetterText,
  getResumePath,
  isCoverLetterField,
  isOpenEndedField,
  isSensitiveField,
  lookupField,
  matchYesNo,
  normalizeLabel,
  parsePersonalInformation,
} from "./fill-references.js";
import { resolveAiFill } from "./ai-fill.js";
import { dismissCookieBanner } from "./cookie-banner.js";
import { WORKDAY_ACCOUNT_FILE } from "../paths.js";

interface WorkdayAccount {
  email: string;
  password: string;
}

function loadWorkdayAccount(): WorkdayAccount {
  let map: Map<string, string>;
  try {
    map = parsePersonalInformation(readFileSync(WORKDAY_ACCOUNT_FILE, "utf8"));
  } catch {
    throw new Error(
      `Missing ${WORKDAY_ACCOUNT_FILE}. Copy workday-account.template.md to workday-account.md and fill in a reusable email/password.`
    );
  }
  const email = map.get("email");
  const password = map.get("password");
  if (!email || !password) {
    throw new Error(`${WORKDAY_ACCOUNT_FILE} is missing an Email or Password value.`);
  }
  return { email, password };
}

/**
 * Workday "prompt" widget: a button that opens a focusable listbox. Click to open, then
 * TYPE the value + Enter — this drives native browser typeahead-select-on-listbox behavior.
 * Virtualized option nodes are not reliably clickable, so this avoids locating them at all.
 */
async function fillWorkdayPrompt(page: Page, automationId: string, typeText: string): Promise<boolean> {
  const btn = page.locator(`[data-automation-id="${cssEscape(automationId)}"] button`).first();
  if (!(await btn.isVisible().catch(() => false))) return false;
  // Center in viewport first — Workday's fixed Back/Save-and-Continue footer bar can overlap
  // a button that's merely scrolled "into view" at the edge of the viewport.
  await btn.evaluate((el) => el.scrollIntoView({ block: "center" })).catch(() => {});
  await page.waitForTimeout(150);
  await btn.click();
  await page.waitForTimeout(300);
  // Confirm the listbox actually opened before typing — a click swallowed by an overlapping
  // fixed element (e.g. the footer bar) can silently no-op instead of throwing.
  const expanded = await btn.getAttribute("aria-expanded").catch(() => null);
  if (expanded !== "true") {
    await btn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);
  }
  await page.keyboard.type(typeText, { delay: 60 });
  await page.waitForTimeout(600);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  const valueNow = (await btn.textContent().catch(() => "")) ?? "";
  const ok = !!valueNow.trim() && !/select one/i.test(valueNow);
  if (!ok) await page.keyboard.press("Escape").catch(() => {});
  return ok;
}

function cssEscape(s: string): string {
  return s.replace(/"/g, '\\"');
}

async function fillWorkdayRadioGroup(page: Page, radioName: string, value: string): Promise<boolean> {
  const radios = page.locator(`input[type="radio"][name="${cssEscape(radioName)}"]`);
  const count = await radios.count();
  const normVal = normalizeLabel(value);
  for (let i = 0; i < count; i++) {
    const radio = radios.nth(i);
    const aria = ((await radio.getAttribute("aria-label")) ?? "").trim();
    const val = ((await radio.getAttribute("value")) ?? "").trim();
    const parentText = (
      (await radio
        .evaluate((el) => el.closest("label")?.textContent ?? el.parentElement?.textContent ?? "")
        .catch(() => "")) ?? ""
    )
      .replace(/\s+/g, " ")
      .trim();
    if ([aria, val, parentText].some((c) => c && normalizeLabel(c) === normVal)) {
      await radio.check({ force: true }).catch(async () => {
        await radio.click({ force: true });
      });
      return true;
    }
  }
  return false;
}

/**
 * Navigate Apply → Apply Manually → Create Account/Sign In → land on the application wizard.
 * Handles both inline (same-page) and full-redirect (dedicated /login page) Workday tenants,
 * and an in-progress application ("Continue Application" instead of "Apply").
 */
export async function navigateWorkdayApplyFlow(page: Page, jobUrl: string): Promise<void> {
  await page.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(2000);
  await dismissCookieBanner(page);

  const continueApp = page.locator('[data-automation-id="continueButton"]').first();
  if (await continueApp.isVisible({ timeout: 5000 }).catch(() => false)) {
    await continueApp.click();
    await page.waitForTimeout(2000);
    return;
  }

  const apply = page
    .locator('[data-automation-id="adventureButton"]')
    .or(page.getByRole("button", { name: /^apply$/i }))
    .first();
  if (await apply.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await apply.click();
    await page.waitForTimeout(2000);
  }

  const applyManual = page
    .locator('[data-automation-id="applyManually"]')
    .or(page.getByRole("button", { name: /apply manually/i }))
    .first();
  if (await applyManual.isVisible({ timeout: 5000 }).catch(() => false)) {
    await applyManual.click();
    await page
      .locator('[data-automation-id="signInContent"]')
      .waitFor({ state: "visible", timeout: 20_000 })
      .catch(() => {});
    await page.waitForTimeout(1000);
  }

  await handleWorkdayAccountForm(page);
}

/**
 * Fill Create Account or Sign In, whichever this tenant shows. A "Create Account" submit
 * against an email that already has an account on this tenant bounces to a plain Sign In
 * form — retry once as Sign In when that happens.
 */
async function handleWorkdayAccountForm(page: Page): Promise<void> {
  const { email, password } = loadWorkdayAccount();
  const emailField = page.locator('input[data-automation-id="email"]');
  const passwordField = page.locator('input[data-automation-id="password"]');
  const verifyField = page.locator('input[data-automation-id="verifyPassword"]');
  const createBtn = page
    .locator('[data-automation-id="click_filter"][aria-label="Create Account"]')
    .or(page.locator('[data-automation-id="createAccountSubmitButton"]'));
  const signInBtn = page
    .locator('[data-automation-id="click_filter"][aria-label="Sign In"]')
    .or(page.locator('button[data-automation-id="signInSubmitButton"]'));

  for (let attempt = 0; attempt < 2; attempt++) {
    if (!(await emailField.isVisible({ timeout: 5000 }).catch(() => false))) break;
    const hasVerify = await verifyField.isVisible().catch(() => false);
    if (hasVerify) {
      await emailField.fill(email);
      await passwordField.fill(password);
      await verifyField.fill(password);
      await createBtn
        .first()
        .click({ timeout: 10_000 })
        .catch(async () => {
          await page.locator('[data-automation-id="createAccountSubmitButton"]').click({ force: true });
        });
    } else {
      await emailField.fill(email);
      await passwordField.fill(password);
      await signInBtn
        .first()
        .click({ timeout: 10_000 })
        .catch(async () => {
          await passwordField.press("Enter");
        });
    }
    // A full-page redirect can land between two navigations — wait it out, then use an
    // actively-polling waitFor() (not isVisible(), a one-shot check) to detect the bounce.
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(2000);
    const stillOnEmailForm = await emailField
      .waitFor({ state: "visible", timeout: 6000 })
      .then(() => true)
      .catch(() => false);
    if (!stillOnEmailForm) break;
  }
}

export async function currentWorkdayStepName(page: Page): Promise<string> {
  return page
    .locator('[data-automation-id="progressBarActiveStep"]')
    .first()
    .textContent()
    .then((t) => (t ?? "").replace(/^current step \d+ of \d+/i, "").trim())
    .catch(() => "");
}

/**
 * The wizard shell (progress bar + footer) renders before the step's own form fields do,
 * and fields can hydrate in staggered batches (e.g. address section slightly after the
 * first prompt widget) — wait for the formField count to actually stop growing, not just
 * for the first one to appear.
 */
async function waitForWorkdayFieldsStable(page: Page, timeoutMs = 15_000): Promise<void> {
  const formFields = page.locator('[data-automation-id^="formField-"]');
  await formFields.first().waitFor({ state: "visible", timeout: timeoutMs }).catch(() => {});
  // Fields can arrive in a slow trickle (one field renders, sits still for a beat, then the
  // rest of the section appears) — network-idle is a stronger "data has arrived" signal than
  // any fixed DOM-polling window, so wait for it before even starting the stability count.
  await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
  let lastCount = -1;
  let stableStreak = 0;
  const deadline = Date.now() + 6_000;
  while (Date.now() < deadline) {
    const count = await formFields.count().catch(() => 0);
    if (count > 0 && count === lastCount) {
      stableStreak++;
      if (stableStreak >= 2) return;
    } else {
      stableStreak = 0;
    }
    lastCount = count;
    await page.waitForTimeout(600);
  }
}

async function workdayValidationErrors(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('[data-automation-id="inputAlert"], [role="alert"]')]
      .map((e) => (e.textContent ?? "").replace(/\s+/g, " ").trim())
      .filter(Boolean)
  );
}

interface WorkdayField {
  automationId: string;
  label: string;
  kind: "prompt" | "text" | "textarea" | "radio" | "checkbox";
  radioName?: string;
}

/**
 * Discover fields on the current wizard step. Workday questions live in
 * `[data-automation-id^="formField-"]` wrappers; the label is the `richText` inside a
 * `<legend>` (Application Questions / Voluntary Disclosures) or a plain `<label>`
 * (My Information / My Experience). Widget type is inferred from the controls present.
 */
async function discoverWorkdayFields(page: Page): Promise<WorkdayField[]> {
  return page.evaluate(() => {
    const clean = (s: string) =>
      s
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\*\s*$/, "")
        .replace(/select one\s*$/i, "")
        .trim();

    const fields: WorkdayField[] = [];
    const divs = [...document.querySelectorAll('[data-automation-id^="formField-"]')];
    for (const div of divs) {
      const automationId = div.getAttribute("data-automation-id");
      if (!automationId) continue;
      if (div.querySelector('input[type="file"]')) continue;

      let label = "";
      const richText = div.querySelector('legend [data-automation-id="richText"]');
      if (richText) label = clean(richText.textContent ?? "");
      if (!label) {
        const legend = div.querySelector("legend");
        if (legend) label = clean(legend.textContent ?? "");
      }
      if (!label) {
        const lbl = div.querySelector("label");
        if (lbl) label = clean(lbl.textContent ?? "");
      }
      if (!label) {
        const clone = div.cloneNode(true) as HTMLElement;
        clone.querySelectorAll("input, textarea, select, button, svg").forEach((n) => n.remove());
        label = clean(clone.textContent ?? "");
      }
      if (!label) continue;

      const promptButton = div.querySelector('button[aria-haspopup="listbox"]');
      const textarea = div.querySelector("textarea");
      const radios = [...div.querySelectorAll('input[type="radio"]')] as HTMLInputElement[];
      const checkboxes = [...div.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[];
      const textInput = div.querySelector('input[type="text"]:not([role="combobox"])') as HTMLInputElement | null;

      if (promptButton) {
        fields.push({ automationId, label, kind: "prompt" });
      } else if (radios.length > 0) {
        fields.push({ automationId, label, kind: "radio", radioName: radios[0]!.name });
      } else if (checkboxes.length > 0) {
        fields.push({ automationId, label, kind: "checkbox" });
      } else if (textarea) {
        fields.push({ automationId, label, kind: "textarea" });
      } else if (textInput) {
        fields.push({ automationId, label, kind: "text" });
      }
    }
    return fields;
  });
}

async function uploadWorkdayResume(
  page: Page,
  refs: FillReferences,
  filledFields: string[],
  unfilledFields: UnfilledField[]
): Promise<void> {
  const resumeInput = page.locator('input[data-automation-id="file-upload-input-ref"]').first();
  if (!(await resumeInput.count().catch(() => 0))) return;
  try {
    await resumeInput.setInputFiles(getResumePath(refs));
    filledFields.push("Resume");
    await page.waitForTimeout(2500);
  } catch {
    unfilledFields.push({ label: "Resume", suggestedAnswer: null, reason: "file_missing", source: null });
  }
}

async function fillWorkdayField(
  page: Page,
  field: WorkdayField,
  refs: FillReferences,
  ctx: FillContext,
  pageId: string,
  filledFields: string[],
  unfilledFields: UnfilledField[]
): Promise<void> {
  if (isSensitiveField(field.label)) {
    unfilledFields.push({ label: field.label, suggestedAnswer: null, reason: "sensitive_manual_only", source: null });
    return;
  }

  if (field.kind === "prompt" || field.kind === "radio") {
    const yn = matchYesNo(field.label, refs.personal, refs.skills);
    let value = yn ?? "";
    let source: FillSource = "personal-information.md";
    if (!value) {
      const lookup = lookupField(field.label, refs, ctx);
      if (lookup.reason === "sensitive_manual_only") {
        unfilledFields.push({
          label: field.label,
          suggestedAnswer: null,
          reason: "sensitive_manual_only",
          source: null,
        });
        return;
      }
      value = lookup.value;
      source = lookup.source;
    }
    if (!value) {
      unfilledFields.push({ label: field.label, suggestedAnswer: null, reason: "no_match", source: null });
      return;
    }
    let ok =
      field.kind === "prompt"
        ? await fillWorkdayPrompt(page, field.automationId, value)
        : await fillWorkdayRadioGroup(page, field.radioName!, value);
    if (!ok && field.kind === "prompt") {
      // Occasional flake when several prompts fire back-to-back — one retry after a beat.
      await page.waitForTimeout(500);
      ok = await fillWorkdayPrompt(page, field.automationId, value);
    }
    if (ok) filledFields.push(field.label);
    else unfilledFields.push({ label: field.label, suggestedAnswer: value, reason: "no_match", source });
    return;
  }

  if (field.kind === "checkbox") {
    // Consent-style checkboxes only — never opt into marketing/SMS, never guess on others.
    if (/sms|text message|marketing|newsletter/i.test(field.label)) return;
    if (!/privacy|consent|terms of (service|use)|i agree|acknowledge/i.test(field.label)) return;
    const box = page.locator(`[data-automation-id="${cssEscape(field.automationId)}"] input[type="checkbox"]`).first();
    const ok = await box
      .check({ force: true })
      .then(() => true)
      .catch(async () => {
        await box.click({ force: true }).catch(() => {});
        return box.isChecked().catch(() => false);
      });
    if (ok) filledFields.push(field.label);
    return;
  }

  // text / textarea
  let lookup = lookupField(field.label, refs, ctx);
  if (isCoverLetterField(field.label)) {
    lookup = { value: buildCoverLetterText(refs, ctx), source: "cover-letter.md", confidence: "medium" };
  } else if (isOpenEndedField(field.label, field.kind === "textarea" ? "textarea" : "text")) {
    const ai = await resolveAiFill(field.label, refs, ctx, pageId);
    if (ai) {
      lookup = { value: ai.value, source: ai.source, confidence: "high" };
    } else if (lookup.value && (lookup.source === "projects.md" || lookup.source === "answers.md")) {
      lookup = { value: "", source: lookup.source, confidence: "low", reason: "no_match" };
    }
  }

  if (lookup.reason === "sensitive_manual_only") {
    unfilledFields.push({ label: field.label, suggestedAnswer: null, reason: "sensitive_manual_only", source: null });
    return;
  }
  if (!lookup.value) {
    unfilledFields.push({ label: field.label, suggestedAnswer: null, reason: "no_match", source: lookup.source });
    return;
  }

  const selector =
    field.kind === "textarea"
      ? `[data-automation-id="${cssEscape(field.automationId)}"] textarea`
      : `[data-automation-id="${cssEscape(field.automationId)}"] input[type="text"]`;
  const locator = page.locator(selector).first();
  if (!(await locator.isVisible().catch(() => false))) {
    unfilledFields.push({ label: field.label, suggestedAnswer: lookup.value, reason: "no_match", source: lookup.source });
    return;
  }
  await locator.click({ clickCount: 3 }).catch(() => {});
  await locator.fill(lookup.value);
  filledFields.push(field.label);
}

async function advanceWorkdayStep(page: Page): Promise<string[]> {
  const nextBtn = page.locator('[data-automation-id="pageFooterNextButton"]').first();
  if (!(await nextBtn.isVisible().catch(() => false))) return [];
  await nextBtn.click();
  await page.waitForTimeout(2500);
  return workdayValidationErrors(page);
}

const MAX_WORKDAY_STEPS = 8;

export async function fillWorkdayApplicationForm(
  page: Page,
  item: FillQueueItem,
  refs: FillReferences
): Promise<FillResultItem> {
  const ctx: FillContext = {
    company: item.company,
    role: item.role,
    jobMatch: item.jobMatch,
    jobDescription: item.jobDescription,
  };
  const filledFields: string[] = [];
  const unfilledFields: UnfilledField[] = [];

  try {
    await navigateWorkdayApplyFlow(page, item.jobUrl);
  } catch (err) {
    return {
      page_id: item.page_id,
      company: item.company,
      role: item.role,
      jobUrl: item.jobUrl,
      status: "blocked",
      filledFields: [],
      unfilledFields: [
        {
          label: "navigation",
          suggestedAnswer: err instanceof Error ? err.message : String(err),
          reason: "blocked",
          source: null,
        },
      ],
      error: null,
      deletable: false,
    };
  }

  for (let i = 0; i < MAX_WORKDAY_STEPS; i++) {
    const step = await currentWorkdayStepName(page);
    if (!step) {
      unfilledFields.push({
        label: "navigation",
        suggestedAnswer: null,
        reason: "blocked",
        source: null,
      });
      break;
    }
    if (/^review$/i.test(step)) break; // Human-in-the-loop: never auto-submit.

    await waitForWorkdayFieldsStable(page);

    await uploadWorkdayResume(page, refs, filledFields, unfilledFields);

    const fields = await discoverWorkdayFields(page);
    if (process.env.WORKDAY_DEBUG_FIELDS === "1") {
      console.log(`\n[debug] discovered fields @ ${step}:`, JSON.stringify(fields, null, 2));
    }
    for (const field of fields) {
      await fillWorkdayField(page, field, refs, ctx, item.page_id, filledFields, unfilledFields);
    }

    const errors = await advanceWorkdayStep(page);
    const after = await currentWorkdayStepName(page);
    if (after === step) {
      for (const e of errors) {
        unfilledFields.push({ label: `[${step}] ${e}`, suggestedAnswer: null, reason: "no_match", source: null });
      }
      break;
    }
  }

  const status =
    unfilledFields.length === 0 ? "filled" : filledFields.length > 0 ? "partial" : "partial";

  return {
    page_id: item.page_id,
    company: item.company,
    role: item.role,
    jobUrl: item.jobUrl,
    status,
    filledFields,
    unfilledFields,
    error: null,
    deletable: false,
  };
}
