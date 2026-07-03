/**
 * Wobo feed automation — swipe-card dashboard at wobo.ai/dashboard.
 *
 * One card visible at a time. Save advances to the next; we detect advancement by
 * watching the "View original" href change. SwipeCard overlays require force clicks.
 */
import type { Page } from "playwright";
import { waitForManualLogin } from "./browser.js";
import { screeningSignals, type SourcedJob } from "./scratch.js";

export const WOBO_DASHBOARD = "https://www.wobo.ai/dashboard";
export const WOBO_LOGGED_IN = /wobo\.ai\/dashboard/i;
const CAUGHT_UP = /all caught up|no more matches/i;

export async function openDashboard(page: Page): Promise<void> {
  // /dashboard is the feed; bare /feed 404s on Wobo.
  await page.goto(WOBO_DASHBOARD, { waitUntil: "domcontentloaded" });
  const needsLogin = await page.getByRole("link", { name: /sign in/i }).isVisible({ timeout: 1500 }).catch(() => false);
  if (!needsLogin && WOBO_LOGGED_IN.test(page.url())) return;

  await page.goto("https://www.wobo.ai/", { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: /sign in/i }).click().catch(() =>
    page.getByRole("button", { name: /sign in/i }).click()
  );
  console.log("\n[Wobo] Session expired — run npm run auth:wobo or complete login in browser.");
  await waitForManualLogin(page, "wobo", WOBO_LOGGED_IN);
  await page.goto(WOBO_DASHBOARD, { waitUntil: "domcontentloaded" });
}

export async function waitForFeedReady(page: Page): Promise<void> {
  await page.getByRole("button", { name: /^save$/i }).first().waitFor({ state: "visible", timeout: 15000 });
}

export function isCaughtUp(page: Page): Promise<boolean> {
  return page.getByText(CAUGHT_UP).first().isVisible({ timeout: 500 }).catch(() => false);
}

export async function dismissAutopilot(page: Page): Promise<void> {
  const skip = page.getByRole("button", { name: /skip for now/i });
  if (await skip.isVisible({ timeout: 500 }).catch(() => false)) {
    await skip.click({ force: true }).catch(() => {});
  }
}

/**
 * Reads the currently-visible swipe card via DOM-scoped selectors.
 * Wobo shows ONE card at a time (duplicated for responsive layouts), so we read
 * the first instance of each field. `jobUrl` doubles as the card's identity for
 * advance detection.
 */
export async function readCurrentCard(
  page: Page
): Promise<{ jobUrl: string | null; job: SourcedJob | null }> {
  const data = await page.evaluate(() => {
    const txt = (el: Element | null | undefined) => (el?.textContent || "").trim();
    // Anchor everything to the card that contains the "View original" link, so we
    // never pick up sidebar headings (e.g. the "What should we build next?" widget).
    const vo = Array.from(document.querySelectorAll("a")).find((a) =>
      /view original/i.test(a.textContent || "")
    ) as HTMLAnchorElement | null;
    let card: HTMLElement | null = vo;
    for (let i = 0; i < 8 && card; i++) {
      if (card.className && /overflow-y-auto|rounded/.test(String(card.className))) break;
      card = card.parentElement;
    }
    const scope: ParentNode = card ?? document;

    const logo =
      (scope.querySelector('img[src*="company-logos"]') as HTMLImageElement | null) ??
      (scope.querySelector("img[alt]") as HTMLImageElement | null);
    const company = (logo?.getAttribute("alt") || "").trim();
    const h3 = scope.querySelector("h3");
    const role = txt(h3);
    const tagRow = h3?.nextElementSibling;
    const tags = tagRow ? Array.from(tagRow.querySelectorAll("span")).map((s) => txt(s)) : [];
    const location = tags.filter((t) => /remote|hybrid|on-?site/i.test(t)).join(" / ");
    const jobUrl = vo?.getAttribute("href") || "";
    const desc = Array.from(
      scope.querySelectorAll('p.line-clamp-6, [data-sentry-component="ExpandableText"] p')
    )
      .map((p) => txt(p))
      .join("\n");
    return { company, role, location, jobUrl, desc };
  });

  if (!data.jobUrl || data.jobUrl === "#") return { jobUrl: null, job: null };
  // Regex only ALERTS — it never eliminates. Capture the job and surface flags so the
  // agent can apply judgement (see skill references/job-judgement.md) during curation.
  const flags = screeningSignals(data.role, data.desc);
  if (flags.length) console.log(`  ⚠ [review] ${data.role} — ${flags.join(", ")}`);
  const job: SourcedJob = {
    company: data.company || "Unknown",
    role: data.role || "Unknown",
    jobUrl: data.jobUrl,
    source: "Wobo",
    location: data.location,
  };
  return { jobUrl: data.jobUrl, job };
}

/**
 * Presses Save/Decline and waits for the card to actually change (View-original
 * href differs) or the caught-up state to appear. Returns false if it stalled —
 * the caller uses this to stop re-scraping the same card.
 */
export async function advanceCard(page: Page, action: "save" | "decline", prevUrl: string): Promise<boolean> {
  const name = action === "save" ? /^save$/i : /^decline$/i;
  const btn = page.getByRole("button", { name }).and(page.locator(":visible")).first();
  const clicked = await btn.click({ force: true, timeout: 5000 }).then(() => true).catch(() => false);
  if (!clicked) {
    await page.keyboard.press(action === "save" ? "s" : "a").catch(() => {});
  }
  try {
    await page.waitForFunction(
      (prev) => {
        const vo = Array.from(document.querySelectorAll("a")).find((a) =>
          /view original/i.test(a.textContent || "")
        );
        const cur = vo?.getAttribute("href") || "";
        const caughtUp = /all caught up|no more matches/i.test(document.body.innerText);
        return caughtUp || (!!cur && cur !== prev);
      },
      prevUrl,
      { timeout: 8000 }
    );
    return true;
  } catch {
    return false;
  }
}

/** Headless access check */
export async function verifyAccess(page: Page): Promise<{ ok: boolean; ms: number }> {
  const t0 = Date.now();
  await page.goto(WOBO_DASHBOARD, { waitUntil: "domcontentloaded" });
  await waitForFeedReady(page);
  const ok = WOBO_LOGGED_IN.test(page.url());
  return { ok, ms: Date.now() - t0 };
}
