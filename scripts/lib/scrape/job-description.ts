/**
 * Job description scraping from external posting URLs via Playwright.
 */
import type { Page, Response } from "playwright";
import { cleanJobUrl } from "../job/index.js";
import { isEnglishDescription } from "./language.js";
import type { BrokenReason } from "../artifacts/scrape-artifacts.js";
import {
  classifyPageFailure,
  isDeletableFailure,
} from "../url-health.js";
import {
  EXTRACT_MARKDOWN_FROM_DOM_SOURCE,
  formatJobDescriptionMarkdown,
  formatJobDescriptionPlain,
} from "./scrape-markdown.js";
import {
  fetchWorkdayJobDescription,
  isWorkdayJobUrl,
  workdayPostingToPlainText,
} from "./workday.js";

export type { BrokenReason };
export { classifyPageFailure, isDeletableFailure };

export interface ScrapeOutcome {
  status: "ok" | "broken";
  markdown?: string;
  error?: BrokenReason;
  deletable: boolean;
}

const MIN_DESCRIPTION_CHARS = 200;

function broken(error: BrokenReason): ScrapeOutcome {
  return { status: "broken", error, deletable: isDeletableFailure(error) };
}

export function getScrapeTimeoutMs(): number {
  const raw = process.env.SCRAPE_TIMEOUT_MS;
  if (!raw) return 30_000;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 30_000;
}

export function getScrapeDelayMs(): number {
  const raw = process.env.SCRAPE_DELAY_MS;
  if (!raw) return 1000;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 1000;
}

export function getScrapeLimit(): number {
  const raw = process.env.SCRAPE_LIMIT;
  if (!raw) return Infinity;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : Infinity;
}

function finalizeDescription(description: string): ScrapeOutcome {
  if (!isEnglishDescription(description)) {
    return broken("non_english");
  }

  let markdown: string;
  try {
    markdown = formatJobDescriptionMarkdown(description);
  } catch {
    markdown = formatJobDescriptionPlain(description);
  }
  return { status: "ok", markdown, deletable: false };
}

async function scrapeWorkdayViaApi(url: string): Promise<ScrapeOutcome | null> {
  const posting = await fetchWorkdayJobDescription(url);
  if (!posting) return null;

  const description = workdayPostingToPlainText(posting);
  if (description.trim().length < MIN_DESCRIPTION_CHARS) return null;

  return finalizeDescription(description);
}

async function waitForWorkdayDescription(page: Page): Promise<void> {
  try {
    const host = new URL(page.url()).hostname.toLowerCase();
    if (!host.includes("myworkdayjobs.com")) return;
    await page.waitForSelector("[data-automation-id='jobPostingDescription']", {
      timeout: 10_000,
    });
    await page.waitForTimeout(500);
  } catch {
    /* best-effort — fall through to generic extraction */
  }
}

/**
 * Accessible-name patterns for "expand"/"read more" toggles that hide the rest
 * of a posting behind a click. Handshake truncates every description behind a
 * "More" button (aria-label "Show more (…)"), but Workday/iCIMS/others use the
 * same pattern — so this is applied to all hosts.
 */
const EXPAND_NAME_PATTERNS = [
  /\b(show|see|read|view)\s+more\b/i,
  /^more$/i,
  /(show|view|read)\s+full\s+(description|posting|job|details)/i,
];

/** Names that look like "more" but open menus/lists or collapse — never click. */
const EXPAND_NAME_EXCLUDE = /\b(actions|options|filters|info|jobs|less)\b|learn more/i;

/**
 * Clicks in-page "show more"/"More" expanders so the full posting is in the DOM
 * before extraction. Best-effort and generalized: guarded by name patterns, capped,
 * and never throws. Returns the number of toggles clicked.
 */
export async function expandTruncatedSections(page: Page): Promise<number> {
  try {
    const clicked = await page.evaluate(
      ({ patterns, exclude }) => {
        const rePatterns = patterns.map((p) => new RegExp(p.source, p.flags));
        const reExclude = new RegExp(exclude.source, exclude.flags);
        const nodes = Array.from(
          document.querySelectorAll("button, a[role='button'], [role='button'], summary")
        );
        let count = 0;
        for (const el of nodes) {
          const name = ((el.textContent ?? "") + " " + (el.getAttribute("aria-label") ?? ""))
            .replace(/\s+/g, " ")
            .trim();
          if (!name || reExclude.test(name)) continue;
          if (!rePatterns.some((re) => re.test(name))) continue;
          try {
            (el as HTMLElement).click();
            count++;
          } catch {
            /* element detached / not clickable */
          }
          if (count >= 8) break;
        }
        return count;
      },
      {
        patterns: EXPAND_NAME_PATTERNS.map((re) => ({ source: re.source, flags: re.flags })),
        exclude: { source: EXPAND_NAME_EXCLUDE.source, flags: EXPAND_NAME_EXCLUDE.flags },
      }
    );
    if (clicked > 0) await page.waitForTimeout(1000);
    return clicked;
  } catch {
    return 0;
  }
}

export async function extractDescriptionText(page: Page): Promise<string> {
  return page.evaluate(({ helperSource }) => {
    const extractMarkdown = new Function(helperSource)() as (root: Element) => string;

    const txt = (el: Element | null | undefined) =>
      (el?.textContent ?? "").replace(/\s+/g, " ").trim();

    const host = location.hostname.toLowerCase();
    const hostSelectors: Record<string, string[]> = {
      "greenhouse.io": [
        ".job-post",
        "#job-description",
        "[data-source='job-post']",
        "#content .job-post",
      ],
      "jobs.lever.co": [".content", ".posting-page", ".section-wrapper", ".posting"],
      "jobs.ashbyhq.com": ["[class*='JobDescription']", "[class*='jobDescription']", "main"],
      "myworkdayjobs.com": [
        "[data-automation-id='jobPostingDescription']",
        "[data-automation-id='jobPostingPage']",
      ],
      "joinhandshake.com": ["[data-hook='job-details-page']", "main", "article"],
    };

    const tryExtract = (el: Element | null): string => {
      if (!el) return "";
      const markdown = extractMarkdown(el);
      if (markdown.length >= 200) return markdown;
      const flat = txt(el);
      return flat.length >= 200 ? flat : "";
    };

    for (const [domain, selectors] of Object.entries(hostSelectors)) {
      if (!host.includes(domain)) continue;
      for (const sel of selectors) {
        const text = tryExtract(document.querySelector(sel));
        if (text.length >= 200) return text;
      }
    }

    const genericSelectors = [
      "[class*='job-description']",
      "[class*='JobDescription']",
      "[id*='job-description']",
      "[id*='jobDescription']",
      "[data-testid*='job-description']",
      "main article",
      "main",
      "article",
      "[role='main']",
    ];

    for (const sel of genericSelectors) {
      try {
        const text = tryExtract(document.querySelector(sel));
        if (text.length >= 200) return text;
      } catch {
        /* invalid selector */
      }
    }

    const blocks = Array.from(document.querySelectorAll("p, li, div"))
      .map((el) => txt(el))
      .filter((t) => t.length >= 80);
    blocks.sort((a, b) => b.length - a.length);
    return blocks[0] ?? txt(document.body);
  }, { helperSource: EXTRACT_MARKDOWN_FROM_DOM_SOURCE });
}

function normalizeScrapeUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes("ashbyhq.com") && u.pathname.endsWith("/application")) {
      u.pathname = u.pathname.replace(/\/application$/, "");
      return u.toString();
    }
    if (u.hostname.includes("lever.co") && u.pathname.endsWith("/apply")) {
      u.pathname = u.pathname.replace(/\/apply$/, "");
      return u.toString();
    }
  } catch {
    /* keep original */
  }
  return url;
}

export { normalizeScrapeUrl };

export async function scrapeJobDescription(page: Page, rawUrl: string): Promise<ScrapeOutcome> {
  const url = normalizeScrapeUrl(cleanJobUrl(rawUrl));
  if (!url) return broken("missing_url");

  if (isWorkdayJobUrl(url)) {
    const apiOutcome = await scrapeWorkdayViaApi(url);
    if (apiOutcome) return apiOutcome;
  }

  const timeout = getScrapeTimeoutMs();
  let response: Response | null = null;

  try {
    response = await page.goto(url, { waitUntil: "domcontentloaded", timeout });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/ERR_NAME_NOT_RESOLVED|ENOTFOUND|ERR_CONNECTION_REFUSED/i.test(message)) {
      return broken("dns_failure");
    }
    if (/Timeout/i.test(message)) return broken("timeout");
    return broken("navigation_error");
  }

  await waitForWorkdayDescription(page);
  await page.waitForTimeout(1500);

  // Expand any "More"/"read more" toggles so truncated descriptions are complete
  // before we read the body (Handshake hides the full posting behind this).
  await expandTruncatedSections(page);

  let bodyText = "";
  try {
    bodyText = await page.evaluate(() => document.body?.innerText ?? "");
  } catch {
    return broken("navigation_error");
  }

  const failure = classifyPageFailure(page, response, bodyText);
  if (failure) return broken(failure);

  const description = await extractDescriptionText(page);
  if (description.trim().length < MIN_DESCRIPTION_CHARS) {
    return broken("empty_content");
  }

  return finalizeDescription(description);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
