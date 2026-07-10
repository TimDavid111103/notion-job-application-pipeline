/**
 * Headed Playwright application form filling.
 */
import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import type { Page } from "playwright";
import { normalizeScrapeUrl } from "../scrape/job-description.js";
import { cleanJobUrl } from "../job/index.js";
import type { FillResultItem, UnfilledField } from "../artifacts/fill-artifacts.js";
import type { FillQueueItem } from "../artifacts/fill-artifacts.js";
import {
  type FillContext,
  type FillReferences,
  buildCoverLetterText,
  getCoverLetterPath,
  getResumePath,
  isCoverLetterField,
  isOpenEndedField,
  isSensitiveField,
  lookupChoice,
  lookupField,
  normalizeLabel,
  toDateInputValue,
} from "./fill-references.js";
import { getAiCoverLetter, resolveAiFill } from "./ai-fill.js";
import { checkUrlHealth } from "../url-health.js";

const APPLY_BUTTON_PATTERNS = [
  /apply\s*(now)?/i,
  /submit\s*application/i,
  /start\s*application/i,
];

export async function navigateToApplicationForm(page: Page, rawUrl: string): Promise<void> {
  const url = normalizeScrapeUrl(cleanJobUrl(rawUrl));
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(2000);

  const host = new URL(page.url()).hostname.toLowerCase();

  if (host.includes("greenhouse.io")) {
    const applyBtn = page.getByRole("link", { name: /apply/i }).or(page.getByRole("button", { name: /apply/i }));
    if (await applyBtn.first().isVisible().catch(() => false)) {
      await applyBtn.first().click();
      await page.waitForTimeout(2000);
    }
    return;
  }

  if (host.includes("lever.co")) {
    const applyBtn = page.getByRole("link", { name: /apply/i });
    if (await applyBtn.first().isVisible().catch(() => false)) {
      await applyBtn.first().click();
      await page.waitForTimeout(2000);
    }
    return;
  }

  if (host.includes("ashbyhq.com")) {
    const applyBtn = page.locator("a[href*='application'], button").filter({ hasText: /apply/i });
    if (await applyBtn.first().isVisible().catch(() => false)) {
      await applyBtn.first().click();
      await page.waitForTimeout(2000);
    }
    return;
  }

  const buttons = await page.locator("a, button").all();
  for (const btn of buttons.slice(0, 30)) {
    const text = ((await btn.textContent()) ?? "").trim();
    if (APPLY_BUTTON_PATTERNS.some((re) => re.test(text))) {
      try {
        await btn.click();
        await page.waitForTimeout(2000);
        break;
      } catch {
        /* try next */
      }
    }
  }
}

interface DiscoveredField {
  label: string;
  type: "text" | "textarea" | "select" | "file" | "radio" | "checkbox" | "combobox" | "date";
  selector: string;
  /** Radio/checkbox option caption when this node is one option in a group. */
  optionLabel?: string;
  optionValue?: string;
  /** All option labels for select / radio group (group-level discovery). */
  options?: string[];
  groupKey?: string;
}

async function discoverFields(page: Page): Promise<DiscoveredField[]> {
  return page.evaluate(() => {
    const fields: DiscoveredField[] = [];
    const seen = new Set<string>();

    const clean = (s: string) => s.replace(/\s+/g, " ").trim();
    const OPTION_ONLY =
      /^(yes|no|male|female|none|beginner|intermediate|advanced|expert|less than.*|i don't wish to answer)$/i;

    const isQuestionLike = (t: string): boolean => {
      if (!t || t.length < 8 || t.length > 220) return false;
      if (OPTION_ONLY.test(t)) return false;
      // Reject concatenated multi-question blobs
      if ((t.match(/\?/g) ?? []).length > 1) return false;
      if (/A response is required/i.test(t) && t.length > 80) return false;
      return true;
    };

    const groupQuestion = (el: Element): string => {
      const labelledBy = el.getAttribute("aria-labelledby");
      if (labelledBy) {
        const parts = labelledBy
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent)
          .filter(Boolean)
          .map((t) => clean(t!));
        const joined = parts.join(" ");
        if (isQuestionLike(joined)) return joined;
      }

      // Prefer the nearest field wrapper's own title (not the whole questionnaire).
      const wrap = el.closest(
        "[data-field-path], .ashby-application-form-field-entry, .form-group, .field, fieldset, [class*='question']"
      );
      if (wrap) {
        const lab = wrap.querySelector(
          ":scope > label, :scope > legend, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > p, label, legend"
        );
        const t = clean(lab?.textContent ?? "");
        if (isQuestionLike(t)) return t;
      }

      // Previous siblings often hold the question for Breezy custom questions.
      let sib: Element | null = el.previousElementSibling;
      for (let i = 0; i < 4 && sib; i++) {
        const t = clean(sib.textContent ?? "");
        if (isQuestionLike(t)) return t;
        sib = sib.previousElementSibling;
      }

      // Walk ancestors; take the closest short question-like direct child text.
      let cur: Element | null = el.parentElement;
      for (let depth = 0; depth < 6 && cur; depth++) {
        if (cur.tagName === "FIELDSET") {
          const leg = cur.querySelector(":scope > legend");
          const t = clean(leg?.textContent ?? "");
          if (isQuestionLike(t)) return t;
        }
        for (const c of cur.children) {
          if (c === el || c.contains(el)) continue;
          if (!/^(LABEL|LEGEND|H1|H2|H3|H4|P|DIV|SPAN)$/i.test(c.tagName)) continue;
          const t = clean(c.textContent ?? "");
          if (isQuestionLike(t) && (/\?|\*$/.test(t) || t.length >= 12)) return t;
        }
        cur = cur.parentElement;
      }
      return "";
    };

    const labelFor = (el: Element): string => {
      const id = el.getAttribute("id");
      if (id) {
        const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
        const t = clean(label?.textContent ?? "");
        if (isQuestionLike(t) || (t && t.length <= 80)) return t;
      }
      const dataPath =
        el.closest("[data-field-path]")?.getAttribute("data-field-path") ??
        el.getAttribute("data-field-path");
      if (dataPath) {
        const lab = document.querySelector(`label[for="${CSS.escape(dataPath)}"]`);
        const t = clean(lab?.textContent ?? "");
        if (t) return t;
      }
      const aria = el.getAttribute("aria-label");
      if (aria && isQuestionLike(clean(aria))) return clean(aria);

      const group = groupQuestion(el);
      if (group) return group;

      const parentLabel = el.closest("label");
      if (parentLabel?.textContent) {
        const t = clean(parentLabel.textContent);
        if (t.length > 0 && t.length < 80) return t;
      }
      const placeholder = (el as HTMLInputElement).placeholder;
      if (placeholder && !/^start typing/i.test(placeholder)) return clean(placeholder);
      const name = el.getAttribute("name");
      if (name) return clean(name.replace(/[_-]/g, " "));
      return "";
    };

    const selectorFor = (el: Element): string => {
      const id = el.getAttribute("id");
      if (id) return `#${CSS.escape(id)}`;
      const name = el.getAttribute("name");
      if (name) return `[name="${name.replace(/"/g, '\\"')}"]`;
      const dataPath = el.closest("[data-field-path]")?.getAttribute("data-field-path");
      if (dataPath) {
        return `[data-field-path="${dataPath.replace(/"/g, '\\"')}"] input, [data-field-path="${dataPath.replace(/"/g, '\\"')}"] textarea, [data-field-path="${dataPath.replace(/"/g, '\\"')}"] select`;
      }
      const role = el.getAttribute("role");
      const ph = (el as HTMLInputElement).placeholder;
      if (role === "combobox" && ph) {
        return `input[role="combobox"][placeholder="${ph.replace(/"/g, '\\"')}"]`;
      }
      return "";
    };

    const normalizeKey = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

    const add = (el: Element, type: DiscoveredField["type"], extra?: Partial<DiscoveredField>) => {
      let label = extra?.label ?? labelFor(el);
      const nameAttr = el.getAttribute("name") ?? extra?.groupKey ?? "";
      if (/^race_ethnicity$/i.test(nameAttr)) label = "Race or Ethnicity";
      if (/^gender$/i.test(nameAttr)) label = "Gender";
      if (/^ccpaAgreement$/i.test(nameAttr)) label = "Privacy policy consent";
      if (/^salaryCurrency$/i.test(nameAttr)) label = "Salary currency";
      if (!label || OPTION_ONLY.test(label)) return;
      if ((label.match(/\?/g) ?? []).length > 1) return;
      const selector = extra?.selector ?? selectorFor(el);
      if (!selector) return;
      const key = `${type}|${normalizeKey(label)}|${extra?.groupKey ?? selector}`;
      if (seen.has(key)) return;
      seen.add(key);
      fields.push({
        label,
        type,
        selector,
        optionLabel: extra?.optionLabel,
        optionValue: extra?.optionValue,
        options: extra?.options,
        groupKey: extra?.groupKey,
      });
    };

    // Group radios by name
    const radiosByName = new Map<string, HTMLInputElement[]>();
    document.querySelectorAll('input[type="radio"]').forEach((el) => {
      const input = el as HTMLInputElement;
      const key = input.name || input.id || `anon-${radiosByName.size}`;
      const list = radiosByName.get(key) ?? [];
      list.push(input);
      radiosByName.set(key, list);
    });
    for (const [name, inputs] of radiosByName) {
      const first = inputs[0]!;
      const label = groupQuestion(first) || labelFor(first) || name.replace(/[_-]/g, " ");
      const options = inputs.map((i) => {
        const lab =
          i.getAttribute("aria-label") ||
          i.parentElement?.textContent ||
          i.value ||
          "";
        return clean(lab).slice(0, 120);
      });
      add(first, "radio", {
        label,
        selector: name ? `[name="${name.replace(/"/g, '\\"')}"]` : selectorFor(first),
        options,
        groupKey: name,
      });
    }

    // Checkboxes — group by name when shared (multi-select)
    const checksByName = new Map<string, HTMLInputElement[]>();
    document.querySelectorAll('input[type="checkbox"]').forEach((el) => {
      const input = el as HTMLInputElement;
      const key = input.name || `solo-${checksByName.size}-${input.id}`;
      const list = checksByName.get(key) ?? [];
      list.push(input);
      checksByName.set(key, list);
    });
    for (const [name, inputs] of checksByName) {
      if (inputs.length > 1) {
        const first = inputs[0]!;
        const label = groupQuestion(first) || labelFor(first) || name.replace(/[_-]/g, " ");
        const options = inputs.map((i) => clean(i.parentElement?.textContent ?? i.value ?? "").slice(0, 120));
        add(first, "checkbox", {
          label,
          selector: `[name="${name.replace(/"/g, '\\"')}"]`,
          options,
          groupKey: name,
        });
      } else {
        const input = inputs[0]!;
        const label = groupQuestion(input) || labelFor(input);
        add(input, "checkbox", {
          label,
          optionLabel: clean(input.parentElement?.textContent ?? "").slice(0, 160),
          optionValue: input.value,
          groupKey: name,
        });
      }
    }

    document
      .querySelectorAll(
        "input:not([type='hidden']):not([type='submit']):not([type='button']):not([type='radio']):not([type='checkbox'])"
      )
      .forEach((el) => {
        const input = el as HTMLInputElement;
        const type = input.type;
        if (type === "file") add(el, "file");
        else if (type === "date") add(el, "date");
        else if (input.getAttribute("role") === "combobox") add(el, "combobox");
        else add(el, "text");
      });
    document.querySelectorAll("textarea").forEach((el) => {
      if ((el as HTMLTextAreaElement).name?.includes("recaptcha")) return;
      add(el, "textarea");
    });
    document.querySelectorAll("select").forEach((el) => {
      const options = [...el.querySelectorAll("option")]
        .map((o) => clean(o.textContent ?? ""))
        .filter((t) => t && !/^select/i.test(t));
      add(el, "select", { options });
    });

    return fields;
  });
}

async function fillTextField(page: Page, field: DiscoveredField, value: string): Promise<boolean> {
  try {
    const locator = page.locator(field.selector).first();
    if (!(await locator.isVisible().catch(() => false))) return false;
    await locator.click({ clickCount: 3 }).catch(() => {});
    await locator.fill("");
    await locator.fill(value);
    return true;
  } catch {
    return false;
  }
}

async function fillComboboxField(page: Page, field: DiscoveredField, value: string): Promise<boolean> {
  try {
    const locator = page.locator(field.selector).first();
    if (!(await locator.isVisible().catch(() => false))) return false;
    await locator.click();
    await locator.fill("");
    await locator.fill(value);
    await page.waitForTimeout(700);
    const option = page.getByRole("option").filter({ hasText: new RegExp(value.split(",")[0]!.trim(), "i") }).first();
    if (await option.isVisible().catch(() => false)) {
      await option.click();
      return true;
    }
    // Try city-only
    const city = value.split(",")[0]!.trim();
    const cityOpt = page.getByRole("option").filter({ hasText: new RegExp(city, "i") }).first();
    if (await cityOpt.isVisible().catch(() => false)) {
      await cityOpt.click();
      return true;
    }
    await locator.press("Enter");
    return true;
  } catch {
    return false;
  }
}

function isHoneypotField(label: string): boolean {
  const norm = normalizeLabel(label);
  return /^hp\b/.test(norm) || /honeypot|catchpa|captcha_id|recaptcha/i.test(norm);
}

async function fillSelectField(page: Page, field: DiscoveredField, value: string): Promise<boolean> {
  try {
    const locator = page.locator(field.selector).first();
    if (!(await locator.isVisible().catch(() => false))) return false;
    const options = await locator.locator("option").allTextContents();
    const normVal = normalizeLabel(value);
    const match =
      options.find((o) => normalizeLabel(o) === normVal) ??
      options.find((o) => normalizeLabel(o).includes(normVal) || normVal.includes(normalizeLabel(o)));
    if (match) {
      await locator.selectOption({ label: match });
      return true;
    }
    if (/^yes$/i.test(value)) {
      const yes = options.find((o) => /^yes$/i.test(o.trim()));
      if (yes) {
        await locator.selectOption({ label: yes });
        return true;
      }
    }
    if (/^no$/i.test(value)) {
      const no = options.find((o) => /^no$/i.test(o.trim()));
      if (no) {
        await locator.selectOption({ label: no });
        return true;
      }
    }
    // Multi-select native
    if (field.options && value.includes("||")) {
      const parts = value.split("||").map((s) => s.trim());
      const labels = parts
        .map(
          (p) =>
            options.find((o) => normalizeLabel(o) === normalizeLabel(p)) ??
            options.find((o) => normalizeLabel(o).includes(normalizeLabel(p)))
        )
        .filter(Boolean) as string[];
      if (labels.length) {
        await locator.selectOption(labels.map((l) => ({ label: l })));
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

async function fillRadioGroup(page: Page, field: DiscoveredField, value: string): Promise<boolean> {
  try {
    const radios = page.locator(field.selector);
    const count = await radios.count();
    const normVal = normalizeLabel(value);
    if (!normVal) return false;

    const matches = (candidate: string): boolean => {
      const c = normalizeLabel(candidate);
      if (!c) return false;
      return c === normVal || c.includes(normVal) || normVal.includes(c);
    };

    // Prefer exact option-caption match before fuzzy includes.
    for (let i = 0; i < count; i++) {
      const radio = radios.nth(i);
      const radioValue = ((await radio.getAttribute("value")) ?? "").trim();
      const parentText = cleanText(
        (await radio.evaluate((el) => el.parentElement?.textContent ?? "")) ?? ""
      );
      const aria = ((await radio.getAttribute("aria-label")) ?? "").trim();
      if ([radioValue, parentText, aria].some((c) => normalizeLabel(c) === normVal)) {
        await radio.check({ force: true }).catch(async () => {
          await radio.click({ force: true });
        });
        return true;
      }
    }
    for (let i = 0; i < count; i++) {
      const radio = radios.nth(i);
      const radioValue = ((await radio.getAttribute("value")) ?? "").trim();
      const parentText = cleanText(
        (await radio.evaluate((el) => el.parentElement?.textContent ?? "")) ?? ""
      );
      const aria = ((await radio.getAttribute("aria-label")) ?? "").trim();
      if ([radioValue, parentText, aria].some(matches)) {
        await radio.check({ force: true }).catch(async () => {
          await radio.click({ force: true });
        });
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

function cleanText(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

async function fillCheckboxGroup(
  page: Page,
  field: DiscoveredField,
  values: string[]
): Promise<boolean> {
  try {
    const boxes = page.locator(field.selector);
    const count = await boxes.count();
    const wanted = values.map(normalizeLabel);
    let any = false;
    for (let i = 0; i < count; i++) {
      const box = boxes.nth(i);
      const parentText = cleanText((await box.evaluate((el) => el.parentElement?.textContent ?? "")) ?? "");
      const val = ((await box.getAttribute("value")) ?? "").trim();
      const norm = normalizeLabel(parentText || val);
      const hit = wanted.some((w) => norm === w || norm.includes(w) || w.includes(norm));
      if (hit) {
        await box.check({ force: true }).catch(async () => {
          await box.click({ force: true });
        });
        any = true;
      }
    }
    return any;
  } catch {
    return false;
  }
}

async function fillSingleCheckbox(page: Page, field: DiscoveredField, shouldCheck: boolean): Promise<boolean> {
  try {
    const box = page.locator(field.selector).first();
    if (!(await box.isVisible().catch(() => false))) return false;
    if (shouldCheck) {
      await box.check({ force: true }).catch(async () => {
        await box.click({ force: true });
      });
    }
    return true;
  } catch {
    return false;
  }
}

async function fillFileField(page: Page, field: DiscoveredField, filePath: string): Promise<boolean> {
  try {
    await access(filePath, fsConstants.R_OK);
    const locator = page.locator(field.selector).first();
    await locator.setInputFiles(filePath);
    return true;
  } catch {
    return false;
  }
}

function isResumeField(label: string): boolean {
  return /resume|cv|curriculum/i.test(normalizeLabel(label));
}

/** Visible copy that means the ATS is still parsing an uploaded resume. */
const RESUME_PROCESSING_RE =
  /analyz(?:e|ing)\s+resume|process(?:ing)?\s+resume|pars(?:e|ing)\s+resume|reading\s+resume|uploading\s+resume/i;

const RESUME_DONE_RE = /resume.*(success|complete|uploaded|attached)|success!|upload\s+complete/i;

/**
 * After resume upload, wait until processing/analyzing UI settles (or timeout).
 * Re-discover fields afterward — ATS autofill often mutates the form.
 */
async function waitForResumeProcessing(page: Page, timeoutMs = 45_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let sawProcessing = false;
  const started = Date.now();

  while (Date.now() < deadline) {
    const snapshot = await page.evaluate(() => {
      const text = (document.body?.innerText ?? "").replace(/\s+/g, " ");
      const busy =
        document.querySelector('[aria-busy="true"], .spinner, .loading, [class*="loading"], [class*="analyz"]') !==
        null;
      return { text, busy };
    });

    const processing = snapshot.busy || RESUME_PROCESSING_RE.test(snapshot.text);
    const done = RESUME_DONE_RE.test(snapshot.text);

    if (processing && !done) {
      sawProcessing = true;
      await page.waitForTimeout(500);
      continue;
    }

    if (sawProcessing || done) {
      await page.waitForTimeout(800);
      return;
    }

    await page.waitForTimeout(400);
    if (Date.now() - started > 3_000) return;
  }
}

async function uploadResumeFirst(
  page: Page,
  fields: DiscoveredField[],
  refs: FillReferences,
  filledFields: string[],
  unfilledFields: UnfilledField[]
): Promise<boolean> {
  const resumeFields = fields.filter((f) => f.type === "file" && isResumeField(f.label));
  if (resumeFields.length === 0) return false;

  const resumePath = getResumePath(refs);
  let uploaded = false;
  for (const field of resumeFields) {
    const ok = await fillFileField(page, field, resumePath);
    if (ok) {
      filledFields.push(field.label);
      uploaded = true;
    } else {
      unfilledFields.push({
        label: field.label,
        suggestedAnswer: null,
        reason: "file_missing",
        source: null,
      });
    }
  }

  if (uploaded) {
    await waitForResumeProcessing(page);
  }
  return uploaded;
}

/**
 * Remove ATS resume-parsed work experience entries.
 * Breezy renders rows under Work History with Delete controls; also clear leftover inputs.
 */
async function stripAtsWorkExperience(page: Page): Promise<number> {
  let deleted = 0;
  await page.waitForTimeout(2000);

  for (let i = 0; i < 30; i++) {
    // Prefer Delete inside Work History / experience blocks; never education.
    const candidates = page.locator("button, a, [ng-click], [role='button']").filter({
      hasText: /^\s*delete\s*$/i,
    });
    const count = await candidates.count();
    if (count === 0) break;

    let clicked = false;
    for (let j = 0; j < count; j++) {
      const btn = candidates.nth(j);
      const meta = await btn
        .evaluate((el) => {
          const root = el.closest(
            ".experience, [class*='work-history'], [class*='workHistory'], [class*='WorkHistory'], li, .ng-scope"
          );
          const inEducation = !!(
            el.closest("[class*='education'], [class*='Education']") ||
            root?.querySelector('input[placeholder="School"], input[placeholder*="School"]')
          );
          const hasCompany = !!root?.querySelector(
            'input[placeholder="Company"], input[placeholder="Title"], textarea[placeholder="Summary"]'
          );
          const sectionText = (root?.closest("section, .panel, form, div")?.textContent ?? "").slice(0, 200);
          const underWorkHistory = /work history/i.test(sectionText) || hasCompany;
          return { inEducation, underWorkHistory, hasCompany };
        })
        .catch(() => ({ inEducation: true, underWorkHistory: false, hasCompany: false }));

      if (meta.inEducation) continue;
      if (!meta.underWorkHistory && !meta.hasCompany) continue;

      await btn.scrollIntoViewIfNeeded().catch(() => {});
      await btn.click({ force: true });
      deleted++;
      clicked = true;
      await page.waitForTimeout(600);
      break;
    }
    if (!clicked) break;
  }

  // Fallback: clear any remaining Company/Title/Summary fields under Work History (not School).
  const cleared = await page.evaluate(() => {
    let n = 0;
    const workRoots = [
      ...document.querySelectorAll(".experience, [class*='work-history'], [class*='workHistory']"),
    ];
    // Also: inputs with Company placeholder that are not in an education block
    const companyInputs = [
      ...document.querySelectorAll('input[placeholder="Company"], input[placeholder="Title"]'),
    ] as HTMLInputElement[];
    for (const input of companyInputs) {
      if (input.closest("[class*='education'], [class*='Education']")) continue;
      if (input.closest(".experience") === null && !input.closest("[class*='work']")) {
        // Still clear orphan company rows from ATS
      }
      const root =
        input.closest(".experience, li, .ng-scope") ?? input.parentElement?.parentElement;
      if (!root) continue;
      if (root.querySelector('input[placeholder="School"]')) continue;
      for (const el of [
        ...root.querySelectorAll("input:not([type='hidden']):not([type='file']), textarea"),
      ] as HTMLInputElement[]) {
        if (el.placeholder === "School" || el.placeholder === "Field of Study") continue;
        if (el.type === "date") {
          el.value = "";
        } else if (el.value) {
          el.value = "";
          n++;
        }
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
    for (const root of workRoots) {
      if (root.querySelector('input[placeholder="School"]')) continue;
      for (const el of [
        ...root.querySelectorAll("input:not([type='hidden']):not([type='file']), textarea"),
      ] as HTMLInputElement[]) {
        if ((el as HTMLInputElement).value) {
          (el as HTMLInputElement).value = "";
          n++;
        }
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
    return n;
  });

  if (cleared > 0 && deleted === 0) {
    // Treat cleared fields as a successful strip for logging
    deleted = cleared;
  }
  return deleted;
}

/** Fill education start/end near School fields (Breezy date or mm/dd/yyyy inputs). */
async function fillEducationDates(page: Page, refs: FillReferences, filledFields: string[]): Promise<void> {
  const startRaw = refs.personal.get("school start date");
  const endRaw = refs.personal.get("school end date") ?? refs.personal.get("graduation date");
  if (!startRaw && !endRaw) return;

  const startIso = startRaw ? toDateInputValue(startRaw, "start") : "";
  const endIso = endRaw ? toDateInputValue(endRaw, "end") : "";
  const startMdY = startIso ? isoToMdY(startIso) : "";
  const endMdY = endIso ? isoToMdY(endIso) : "";

  const filled = await page.evaluate(
    ({ startIso, endIso, startMdY, endMdY }) => {
      const setInput = (input: HTMLInputElement, iso: string, mdy: string) => {
        const value = input.type === "date" ? iso : mdy || iso;
        if (!value) return false;
        const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
        proto?.set?.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        input.dispatchEvent(new Event("blur", { bubbles: true }));
        return true;
      };

      const findDateInputs = (root: Element): HTMLInputElement[] => {
        const labeled: HTMLInputElement[] = [];
        const labels = [...root.querySelectorAll("label, span, div, p")];
        for (const lab of labels) {
          const t = (lab.textContent ?? "").replace(/\s+/g, " ").trim().toLowerCase();
          if (t !== "start date" && t !== "end date") continue;
          const input =
            (lab.querySelector("input") as HTMLInputElement | null) ??
            (lab.nextElementSibling?.querySelector?.("input") as HTMLInputElement | null) ??
            (lab.parentElement?.querySelector("input[type='date'], input[placeholder*='mm']") as
              | HTMLInputElement
              | null);
          if (input) labeled.push(input);
        }
        if (labeled.length >= 2) return labeled.slice(0, 2);
        return [
          ...root.querySelectorAll(
            "input[type='date'], input[placeholder*='mm/dd'], input[placeholder*='yyyy']"
          ),
        ] as HTMLInputElement[];
      };

      let ok = false;
      const schoolInputs = [
        ...document.querySelectorAll(
          'input[placeholder="School"], input[placeholder*="School"], input[value*="University"], input[value*="College"]'
        ),
      ] as HTMLInputElement[];

      const roots = new Set<Element>();
      for (const school of schoolInputs) {
        const root =
          school.closest(".experience, [class*='education'], [class*='Education'], li, section") ??
          school.parentElement?.parentElement ??
          school.parentElement;
        if (root) roots.add(root);
      }
      for (const root of document.querySelectorAll(
        "[class*='education'], [class*='Education'], .education"
      )) {
        roots.add(root);
      }

      for (const root of roots) {
        const dates = findDateInputs(root);
        if (dates.length >= 1 && startIso) ok = setInput(dates[0]!, startIso, startMdY) || ok;
        if (dates.length >= 2 && endIso) ok = setInput(dates[1]!, endIso, endMdY) || ok;
      }
      return ok;
    },
    { startIso, endIso, startMdY, endMdY }
  );

  // Playwright fallback: label-associated fills
  if (!filled) {
    const school = page.locator('input[placeholder="School"]').first();
    if (await school.isVisible().catch(() => false)) {
      const root = school.locator("xpath=ancestor::*[contains(@class,'experience') or contains(@class,'education')][1]");
      const start = root.getByText(/^Start date$/i).locator("xpath=following::input[1]");
      const end = root.getByText(/^End date$/i).locator("xpath=following::input[1]");
      if (startIso && (await start.count())) {
        await start.first().fill(startIso).catch(async () => {
          await start.first().fill(startMdY);
        });
      }
      if (endIso && (await end.count())) {
        await end.first().fill(endIso).catch(async () => {
          await end.first().fill(endMdY);
        });
      }
      filledFields.push("Education dates");
      return;
    }
  }

  if (filled) filledFields.push("Education dates");
}

function isoToMdY(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[2]}/${m[3]}/${m[1]}`;
}

export async function fillApplicationForm(
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
    await navigateToApplicationForm(page, item.jobUrl);
  } catch {
    return {
      page_id: item.page_id,
      company: item.company,
      role: item.role,
      jobUrl: item.jobUrl,
      status: "blocked",
      filledFields: [],
      unfilledFields: [{ label: "navigation", suggestedAnswer: null, reason: "blocked", source: null }],
      error: null,
      deletable: false,
    };
  }

  let fields = await discoverFields(page);
  await uploadResumeFirst(page, fields, refs, filledFields, unfilledFields);
  // Re-discover after resume autofill may rewrite the form.
  fields = await discoverFields(page);

  const deleted = await stripAtsWorkExperience(page);
  if (deleted > 0) filledFields.push(`stripped-work-experience×${deleted}`);
  await fillEducationDates(page, refs, filledFields);
  fields = await discoverFields(page);

  for (const field of fields) {
    if (isSensitiveField(field.label)) {
      unfilledFields.push({
        label: field.label,
        suggestedAnswer: null,
        reason: "sensitive_manual_only",
        source: null,
      });
      continue;
    }

    if (isHoneypotField(field.label)) {
      continue;
    }

    if (field.type === "file" && isResumeField(field.label)) {
      continue;
    }

    // Cover letter file upload → template PDF
    if (field.type === "file" && isCoverLetterField(field.label)) {
      const path = getCoverLetterPath(refs);
      const ok = await fillFileField(page, field, path);
      if (ok) filledFields.push(field.label);
      else {
        unfilledFields.push({
          label: field.label,
          suggestedAnswer: path,
          reason: "file_missing",
          source: "cover-letter-template.pdf",
        });
      }
      continue;
    }

    if (field.type === "file") {
      continue;
    }

    // Choice fields (select / radio / checkbox groups)
    if (field.type === "select" || field.type === "radio" || (field.type === "checkbox" && field.options)) {
      const options =
        field.options ??
        (field.type === "select"
          ? await page.locator(field.selector).first().locator("option").allTextContents()
          : []);
      const choice = lookupChoice(field.label, options, refs, ctx);
      if (choice.reason === "sensitive_manual_only") {
        unfilledFields.push({
          label: field.label,
          suggestedAnswer: null,
          reason: "sensitive_manual_only",
          source: null,
        });
        continue;
      }
      if (!choice.value && !(choice.values && choice.values.length)) {
        unfilledFields.push({
          label: field.label,
          suggestedAnswer: null,
          reason: "no_match",
          source: choice.source,
        });
        continue;
      }

      let ok = false;
      if (field.type === "select") {
        const selectVal =
          choice.values && choice.values.length > 1 ? choice.values.join("||") : choice.value;
        ok = await fillSelectField(page, field, selectVal);
      } else if (field.type === "radio") {
        ok = await fillRadioGroup(page, field, choice.value);
      } else {
        ok = await fillCheckboxGroup(page, field, choice.values ?? [choice.value]);
      }

      if (ok) filledFields.push(field.label);
      else {
        unfilledFields.push({
          label: field.label,
          suggestedAnswer: choice.value,
          reason: "no_match",
          source: choice.source,
        });
      }
      continue;
    }

    // Single consent checkbox
    if (field.type === "checkbox") {
      const consent = /privacy|ccpa|terms of (service|use)|i agree to|agree to the processing/i.test(
        field.label
      );
      // Do not auto-opt into marketing/SMS.
      if (/sms|text message|marketing|newsletter/i.test(field.label)) {
        continue;
      }
      const choice = lookupChoice(field.label, [field.optionLabel ?? "Yes", "No"], refs, ctx);
      const shouldCheck = consent || (Boolean(choice.value) && !/^no$/i.test(choice.value));
      if (!shouldCheck) continue;
      const ok = await fillSingleCheckbox(page, field, true);
      if (ok) filledFields.push(field.label);
      else {
        unfilledFields.push({
          label: field.label,
          suggestedAnswer: "checked",
          reason: "no_match",
          source: null,
        });
      }
      continue;
    }

    // Text / textarea / combobox / date
    let lookup = lookupField(field.label, refs, ctx);

    // Cover letter: template.md (+ JD-tailored last paragraph), or agent-provided cover_letter
    if (isCoverLetterField(field.label) || normalizeLabel(field.label).replace(/\s+/g, "") === "ccoverletter") {
      const aiCover = getAiCoverLetter(item.page_id);
      lookup = {
        value: aiCover ?? buildCoverLetterText(refs, ctx),
        source: aiCover ? "ai-answers.json" : "cover-letter.md",
        confidence: "high",
      };
    } else if (!lookup.value && isOpenEndedField(field.label, field.type)) {
      // AI-fill path — never paste raw answers.md exemplars without JD-aware generation
      const ai = await resolveAiFill(field.label, refs, ctx, item.page_id);
      if (ai) {
        lookup = { value: ai.value, source: ai.source, confidence: "high" };
      }
    }

    if (lookup.reason === "sensitive_manual_only") {
      unfilledFields.push({
        label: field.label,
        suggestedAnswer: null,
        reason: "sensitive_manual_only",
        source: null,
      });
      continue;
    }

    if (!lookup.value) {
      unfilledFields.push({
        label: field.label,
        suggestedAnswer: null,
        reason: "no_match",
        source: lookup.source,
      });
      continue;
    }

    let ok = false;
    if (field.type === "combobox") ok = await fillComboboxField(page, field, lookup.value);
    else if (field.type === "date") {
      const boundary = /end|graduat|to\b/i.test(field.label) ? "end" : "start";
      ok = await fillTextField(page, field, toDateInputValue(lookup.value, boundary));
    } else ok = await fillTextField(page, field, lookup.value);

    if (ok) filledFields.push(field.label);
    else {
      unfilledFields.push({
        label: field.label,
        suggestedAnswer: lookup.value,
        reason: "no_match",
        source: lookup.source,
      });
    }
  }

  const status =
    unfilledFields.length === 0
      ? "filled"
      : filledFields.length > 0
        ? "partial"
        : "partial";

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

export async function fillApplicationWithHealthCheck(
  page: Page,
  item: FillQueueItem,
  refs: FillReferences
): Promise<FillResultItem> {
  const health = await checkUrlHealth(page, item.jobUrl);
  if (health.status === "broken") {
    return {
      page_id: item.page_id,
      company: item.company,
      role: item.role,
      jobUrl: item.jobUrl,
      status: "broken",
      filledFields: [],
      unfilledFields: [],
      error: health.error ?? null,
      deletable: health.deletable,
    };
  }
  return fillApplicationForm(page, item, refs);
}

export function printHandoffSummary(result: FillResultItem): void {
  console.log(`\n--- Handoff: ${result.company}: ${result.role} ---`);
  console.log(`Status: ${result.status}`);
  if (result.filledFields.length) {
    console.log(`Filled (${result.filledFields.length}): ${result.filledFields.join(", ")}`);
  }
  if (result.unfilledFields.length) {
    console.log("Needs attention:");
    for (const u of result.unfilledFields) {
      const hint = u.suggestedAnswer ? ` → suggested: ${u.suggestedAnswer.slice(0, 120)}…` : "";
      console.log(`  - [${u.reason}] ${u.label}${hint}`);
    }
  }
  console.log(
    "Review the browser, complete remaining fields, and submit manually. Agent will AskQuestion: Applied / Invalid / Feedback.\n"
  );
}

export function getFillLimit(): number {
  const raw = process.env.FILL_LIMIT;
  if (!raw) return Infinity;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : Infinity;
}
