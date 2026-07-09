/**
 * Shared URL health classification for scraper and fill skills.
 */
import type { Page, Response } from "playwright";
import { cleanJobUrl } from "./job.js";
import type { BrokenReason } from "./scrape-artifacts.js";

export type { BrokenReason };

const MIN_BODY_CHARS = 200;

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

const NON_DELETABLE_REASONS = new Set<BrokenReason>(["login_required", "captcha"]);

export interface UrlHealthOutcome {
  status: "ok" | "broken";
  error?: BrokenReason;
  deletable: boolean;
}

/** Broken outcomes are removed from the tracker unless transient. */
export function isDeletableFailure(reason: BrokenReason): boolean {
  return !NON_DELETABLE_REASONS.has(reason);
}

function broken(error: BrokenReason): UrlHealthOutcome {
  return { status: "broken", error, deletable: isDeletableFailure(error) };
}

function isWorkdayNavLoginFalsePositive(page: Page, bodyText: string): boolean {
  try {
    if (!new URL(page.url()).hostname.toLowerCase().includes("myworkdayjobs.com")) {
      return false;
    }
  } catch {
    return false;
  }
  return (
    bodyText.length >= MIN_BODY_CHARS &&
    /responsibilities|requirements|qualifications|about the role|what you|key responsibilities/i.test(
      bodyText
    )
  );
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
  if (
    !isWorkdayNavLoginFalsePositive(page, bodyText) &&
    LOGIN_PATTERNS.some((re) => re.test(bodyText.slice(0, 1500)))
  ) {
    return "login_required";
  }

  if (bodyText.trim().length < MIN_BODY_CHARS) return "empty_content";
  return null;
}

export function getUrlHealthTimeoutMs(): number {
  const raw = process.env.URL_HEALTH_TIMEOUT_MS ?? process.env.SCRAPE_TIMEOUT_MS;
  if (!raw) return 30_000;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 30_000;
}

export function getUrlHealthDelayMs(): number {
  const raw = process.env.URL_HEALTH_DELAY_MS ?? process.env.SCRAPE_DELAY_MS;
  if (!raw) return 1000;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 1000;
}

export function getUrlHealthLimit(): number {
  const raw = process.env.URL_HEALTH_LIMIT ?? process.env.SCRAPE_LIMIT;
  if (!raw) return Infinity;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : Infinity;
}

function normalizeHealthUrl(url: string): string {
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

/** Navigate to a URL and classify whether the posting is reachable (no extraction). */
export async function checkUrlHealth(page: Page, rawUrl: string): Promise<UrlHealthOutcome> {
  const url = normalizeHealthUrl(cleanJobUrl(rawUrl));
  if (!url) return broken("missing_url");

  const timeout = getUrlHealthTimeoutMs();
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

  return { status: "ok", deletable: false };
}
