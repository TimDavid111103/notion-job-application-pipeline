/**
 * Headed Playwright application form filling.
 */
import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import type { Page } from "playwright";
import { normalizeScrapeUrl } from "./job-description.js";
import { cleanJobUrl } from "./job.js";
import type { FillResultItem, UnfilledField } from "./fill-artifacts.js";
import type { FillQueueItem } from "./fill-artifacts.js";
import {
  type FillContext,
  type FillReferences,
  getResumePath,
  isSensitiveField,
  lookupField,
  normalizeLabel,
} from "./fill-references.js";
import { checkUrlHealth } from "./url-health.js";

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
  type: "text" | "textarea" | "select" | "file" | "radio" | "checkbox";
  selector: string;
}

async function discoverFields(page: Page): Promise<DiscoveredField[]> {
  return page.evaluate(() => {
    const fields: DiscoveredField[] = [];
    const seen = new Set<string>();

    const labelFor = (el: Element): string => {
      const id = el.getAttribute("id");
      if (id) {
        const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
        if (label?.textContent) return label.textContent.replace(/\s+/g, " ").trim();
      }
      const parentLabel = el.closest("label");
      if (parentLabel?.textContent) return parentLabel.textContent.replace(/\s+/g, " ").trim();
      const aria = el.getAttribute("aria-label");
      if (aria) return aria.trim();
      const placeholder = (el as HTMLInputElement).placeholder;
      if (placeholder) return placeholder.trim();
      const name = el.getAttribute("name");
      if (name) return name.replace(/[_-]/g, " ").trim();
      return "";
    };

    const add = (el: Element, type: DiscoveredField["type"]) => {
      const label = labelFor(el);
      if (!label || seen.has(label)) return;
      seen.add(label);
      const id = el.getAttribute("id");
      const name = el.getAttribute("name");
      const selector = id
        ? `#${CSS.escape(id)}`
        : name
          ? `[name="${name.replace(/"/g, '\\"')}"]`
          : "";
      if (!selector) return;
      fields.push({ label, type, selector });
    };

    document.querySelectorAll("input:not([type='hidden']):not([type='submit']):not([type='button'])").forEach((el) => {
      const type = (el as HTMLInputElement).type;
      if (type === "file") add(el, "file");
      else if (type === "checkbox") add(el, "checkbox");
      else if (type === "radio") add(el, "radio");
      else add(el, "text");
    });
    document.querySelectorAll("textarea").forEach((el) => add(el, "textarea"));
    document.querySelectorAll("select").forEach((el) => add(el, "select"));

    return fields;
  });
}

async function fillTextField(page: Page, field: DiscoveredField, value: string): Promise<boolean> {
  try {
    const locator = page.locator(field.selector).first();
    if (!(await locator.isVisible().catch(() => false))) return false;
    await locator.fill(value);
    return true;
  } catch {
    return false;
  }
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
    return false;
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

export async function fillApplicationForm(
  page: Page,
  item: FillQueueItem,
  refs: FillReferences
): Promise<FillResultItem> {
  const ctx: FillContext = {
    company: item.company,
    role: item.role,
    jobMatch: item.jobMatch,
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

  const fields = await discoverFields(page);

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

    if (field.type === "file" && isResumeField(field.label)) {
      const resumePath = getResumePath(refs);
      const ok = await fillFileField(page, field, resumePath);
      if (ok) filledFields.push(field.label);
      else {
        unfilledFields.push({
          label: field.label,
          suggestedAnswer: null,
          reason: "file_missing",
          source: null,
        });
      }
      continue;
    }

    if (field.type === "file" || field.type === "checkbox" || field.type === "radio") {
      continue;
    }

    const lookup = lookupField(field.label, refs, ctx);
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
        suggestedAnswer: lookup.source ? lookup.value : null,
        reason: "no_match",
        source: lookup.source,
      });
      continue;
    }

    const ok =
      field.type === "select"
        ? await fillSelectField(page, field, lookup.value)
        : await fillTextField(page, field, lookup.value);

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
  console.log("Review the browser, complete remaining fields, and submit manually.\n");
}

export function getFillLimit(): number {
  const raw = process.env.FILL_LIMIT;
  if (!raw) return Infinity;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : Infinity;
}
