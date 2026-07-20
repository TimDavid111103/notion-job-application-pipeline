/**
 * Shared URL health classification for scraper and fill skills.
 */
import type { Page, Response } from "playwright";
import { cleanJobUrl } from "./job/index.js";
import type { BrokenReason } from "./artifacts/scrape-artifacts.js";

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

const NON_DELETABLE_REASONS = new Set<BrokenReason>(["login_required", "captcha", "spam_flag"]);

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

/**
 * Public ATS boards (Workday, Workable, …) often put "Sign in" / "Log in" in
 * nav chrome even when the full posting is visible. Treat that as a false
 * positive when the body already looks like a job description.
 */
function pageHasPublicJobContent(bodyText: string): boolean {
  return (
    bodyText.length >= MIN_BODY_CHARS &&
    /responsibilities|requirements|qualifications|about the role|what you|key responsibilities/i.test(
      bodyText
    )
  );
}

/** Classify from URL + HTTP status + body text (browser or fetch). */
export function classifyBodyFailure(
  pageUrl: string,
  status: number,
  bodyText: string
): BrokenReason | null {
  if (status === 404 || status === 410) return "404";

  const title = (pageUrl + " " + bodyText.slice(0, 2000)).toLowerCase();
  if (CLOSED_PATTERNS.some((re) => re.test(bodyText.slice(0, 4000)))) return "posting_closed";
  if (APPLICATION_FORM_PATTERNS.filter((re) => re.test(bodyText.slice(0, 4000))).length >= 2) {
    return "empty_content";
  }
  if (CAPTCHA_PATTERNS.some((re) => re.test(title))) return "captcha";
  if (
    !pageHasPublicJobContent(bodyText) &&
    LOGIN_PATTERNS.some((re) => re.test(bodyText.slice(0, 1500)))
  ) {
    return "login_required";
  }

  if (bodyText.trim().length < MIN_BODY_CHARS) return "empty_content";
  return null;
}

export function classifyPageFailure(
  page: Page,
  response: Response | null,
  bodyText: string
): BrokenReason | null {
  return classifyBodyFailure(page.url(), response?.status() ?? 0, bodyText);
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

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractHtmlTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return (m?.[1] ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Many ATS boards return HTTP 200 with a JS shell and almost no extractable text
 * until the browser runs (Ashby, Greenhouse, Workable, Workday, …). That is not a
 * dead posting. Prefer "reachable" over `empty_content` whenever the response looks
 * like an app shell rather than a confirmed missing page.
 */
export function isHttpSpaShellReachable(status: number, html: string, bodyText: string): boolean {
  if (status < 200 || status >= 400) return false;
  const title = extractHtmlTitle(html);
  const titleOk = title.length >= 8 && !/^error|not found|404/i.test(title);
  const spaHint =
    /enable javascript|you need to enable javascript|id=["']root["']|id=["']app["']|__NEXT_DATA__/i.test(
      html
    );
  // Opaque shell: large HTML, thin text, real title — common bot/no-JS ATS response.
  const opaqueShell = html.length >= 5_000 && bodyText.trim().length < MIN_BODY_CHARS && titleOk;
  if (opaqueShell) return true;
  if (!spaHint) return false;
  if (titleOk) return true;
  // SPA chrome with empty pre-JS body/title (e.g. Workday) — inconclusive, not deletable.
  if (html.length >= 5_000) return true;
  const withoutJsNudge = bodyText.replace(/you need to enable javascript.*/i, "").trim();
  return withoutJsNudge.length >= 20;
}

/**
 * Fast URL health via fetch — no Playwright.
 * Prefer for public ATS pages; Handshake/auth hosts may need browser mode.
 */
export async function checkUrlHealthHttp(rawUrl: string): Promise<UrlHealthOutcome> {
  const url = normalizeHealthUrl(cleanJobUrl(rawUrl));
  if (!url) return broken("missing_url");

  const timeout = getUrlHealthTimeoutMs();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml",
      },
    });
    const html = await response.text();
    const bodyText = stripHtmlToText(html);
    if (isHttpSpaShellReachable(response.status, html, bodyText)) {
      return { status: "ok", deletable: false };
    }
    const failure = classifyBodyFailure(response.url || url, response.status, bodyText);
    if (failure) return broken(failure);
    return { status: "ok", deletable: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const cause =
      err instanceof Error && err.cause instanceof Error ? err.cause.message : "";
    const combined = `${message} ${cause}`;
    if (/ENOTFOUND|ERR_NAME_NOT_RESOLVED|getaddrinfo/i.test(combined)) {
      return broken("dns_failure");
    }
    if (/abort|timeout/i.test(combined)) return broken("timeout");
    return broken("navigation_error");
  } finally {
    clearTimeout(timer);
  }
}

export type UrlHealthMode = "http" | "browser" | "auto";

/** Default `http` — browser only when URL_HEALTH_MODE=browser|auto and launch works. */
export function getUrlHealthMode(): UrlHealthMode {
  const raw = (process.env.URL_HEALTH_MODE ?? "http").toLowerCase();
  if (raw === "browser" || raw === "auto" || raw === "http") return raw;
  return "http";
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
