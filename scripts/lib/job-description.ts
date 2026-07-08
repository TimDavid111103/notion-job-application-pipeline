/**
 * Job description scraping from external posting URLs via Playwright.
 */
import type { Page, Response } from "playwright";
import { cleanJobUrl } from "./job.js";
import type { BrokenReason } from "./scrape-artifacts.js";
import {
  EXTRACT_MARKDOWN_FROM_DOM_SOURCE,
  formatJobDescriptionMarkdown,
  formatJobDescriptionPlain,
} from "./scrape-markdown.js";

export type { BrokenReason };

export interface ScrapeOutcome {
  status: "ok" | "broken";
  markdown?: string;
  error?: BrokenReason;
  deletable: boolean;
}

const MIN_DESCRIPTION_CHARS = 200;

const LOGIN_PATTERNS = [
  /sign\s*in/i,
  /log\s*in/i,
  /create\s+an?\s+account/i,
  /authentication\s+required/i,
];

const CAPTCHA_PATTERNS = [/captcha/i, /verify\s+you(?:'re| are)\s+human/i, /recaptcha/i];

const CLOSED_PATTERNS = [
  /no longer (?:available|accepting)/i,
  /position (?:has been )?filled/i,
  /job (?:posting )?closed/i,
  /this (?:role|position|job) (?:is )?no longer/i,
];

const APPLICATION_FORM_PATTERNS = [
  /submit your application/i,
  /attach resume/i,
  /couldn't auto-read resume/i,
  /optional demographic survey/i,
  /applicant-timezone/i,
  /file exceeds the maximum upload size/i,
];

/** Broken scrape outcomes are removed from the tracker. */
export function isDeletableFailure(_reason: BrokenReason): boolean {
  return true;
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

function broken(error: BrokenReason): ScrapeOutcome {
  return { status: "broken", error, deletable: isDeletableFailure(error) };
}

export function classifyPageFailure(
  page: Page,
  response: Response | null,
  bodyText: string
): BrokenReason | null {
  const status = response?.status() ?? 0;
  if (status === 404 || status === 410) return "404";

  const title = (page.url() + " " + bodyText.slice(0, 2000)).toLowerCase();
  if (CLOSED_PATTERNS.some((re) => re.test(bodyText.slice(0, 4000)))) return "posting_closed";
  if (APPLICATION_FORM_PATTERNS.filter((re) => re.test(bodyText.slice(0, 4000))).length >= 2) {
    return "empty_content";
  }
  if (CAPTCHA_PATTERNS.some((re) => re.test(title))) return "captcha";
  if (LOGIN_PATTERNS.some((re) => re.test(bodyText.slice(0, 1500)))) return "login_required";

  if (bodyText.trim().length < MIN_DESCRIPTION_CHARS) return "empty_content";
  return null;
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
      "joinhandshake.com": ["[data-hook='job-description']", "main", "article"],
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

  await page.waitForTimeout(1500);

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

  let markdown: string;
  try {
    markdown = formatJobDescriptionMarkdown(description);
  } catch {
    markdown = formatJobDescriptionPlain(description);
  }
  return { status: "ok", markdown, deletable: false };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
