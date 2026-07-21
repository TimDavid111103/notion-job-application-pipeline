/**
 * Headed application fill loop — reads fill-session.json + notion-fill-queue.json.
 */
import { readFile, writeFile, unlink, access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import {
  aggregatorForUrl,
  closeBrowser,
  createContext,
  disconnectCdpBrowser,
  getCdpPort,
  launchBrowser,
  openPage,
  reconnectCdpBrowser,
  type Aggregator,
} from "../lib/browser/index.js";
import type { Browser, BrowserContext, Page } from "playwright";
import {
  detectSubmitOutcome,
  fillApplicationForm,
  getFillLimit,
  getSubmitButtonScreenPoint,
  printHandoffSummary,
  shouldAutoSubmit,
  submitApplicationForm,
  submitApplicationViaOsClick,
} from "../lib/fill/application-fill.js";
import { loadFillReferences } from "../lib/fill/fill-references.js";
import {
  FILL_QUEUE_FILE,
  FILL_RESULTS_FILE,
  FILL_SESSION_FILE,
  HANDOFF_CONTINUE_FILE,
  ensureParentDir,
} from "../lib/paths.js";
import {
  buildFillResultsFile,
  parseFillQueueFile,
  parseFillSessionFile,
  serializeFillArtifact,
  type FillResultItem,
} from "../lib/artifacts/fill-artifacts.js";

/** Opt-in only — opens the Playwright inspector overlay. Default off; use chat handoff instead. */
function shouldAutoPause(): boolean {
  return process.env.AUTO_PAUSE === "1";
}

/** Leave the headed browser open after pre-fill so the user can finish manually. Default on when headed. */
function shouldKeepBrowserOpen(): boolean {
  if (process.env.KEEP_BROWSER_OPEN === "0") return false;
  if (process.env.KEEP_BROWSER_OPEN === "1") return true;
  return process.env.HEADED === "1";
}

async function clearHandoffContinue(): Promise<void> {
  try {
    await unlink(HANDOFF_CONTINUE_FILE);
  } catch {
    /* missing is fine */
  }
}

/**
 * KEEP_BROWSER_OPEN only works while this Node process stays alive.
 * Wait until the user closes Chrome, presses Enter, or the agent writes handoff-continue.
 */
async function waitForHandoffKeepAlive(browser: Browser): Promise<void> {
  await clearHandoffContinue();
  console.log(
    [
      "Handoff wait — browser stays open until one of:",
      "  1) close the browser window",
      "  2) press Enter in this terminal",
      `  3) agent writes ${HANDOFF_CONTINUE_FILE}`,
    ].join("\n")
  );

  const disconnected = new Promise<void>((resolve) => {
    if (!browser.isConnected()) {
      resolve();
      return;
    }
    browser.once("disconnected", () => resolve());
  });

  const enterPressed = new Promise<void>((resolve) => {
    if (!process.stdin.isTTY) return;
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    const onData = (): void => {
      process.stdin.off("data", onData);
      resolve();
    };
    process.stdin.on("data", onData);
  });

  const continueFile = new Promise<void>((resolve) => {
    const poll = async (): Promise<void> => {
      for (;;) {
        try {
          await access(HANDOFF_CONTINUE_FILE, fsConstants.F_OK);
          resolve();
          return;
        } catch {
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    };
    void poll();
  });

  await Promise.race([disconnected, enterPressed, continueFile]);
  await clearHandoffContinue();
  console.log("Handoff wait ended.");
}

async function writeResults(results: FillResultItem[]): Promise<void> {
  const file = buildFillResultsFile(results);
  await ensureParentDir(FILL_RESULTS_FILE);
  await writeFile(FILL_RESULTS_FILE, serializeFillArtifact(file), "utf8");
  console.log(
    `Filled ${file.summary.processed} job(s): ${file.summary.filled} filled, ${file.summary.partial} partial → ${FILL_RESULTS_FILE}`
  );
}

async function probeAutoSubmit(
  browser: Browser,
  page: Page,
  pageCache: Map<Aggregator | "public", Page>,
  itemJobUrl: string
): Promise<{
  browser: Browser;
  submit: { clicked: boolean; spam: boolean; success: boolean; message: string | null };
}> {
  console.log("AUTO_SUBMIT=1 — disconnect CDP, Accessibility click Submit, reconnect...");
  let submit = {
    clicked: false,
    spam: false,
    success: false,
    message: null as string | null,
  };

  if (getCdpPort()) {
    const screenPoint = await getSubmitButtonScreenPoint(page);
    await disconnectCdpBrowser(browser);
    const os = await submitApplicationViaOsClick(screenPoint ?? undefined);
    console.log(`OS submit: ${os.message}`);
    await new Promise((r) => setTimeout(r, 2500));
    try {
      const reBrowser = await reconnectCdpBrowser();
      const ctx = reBrowser.contexts()[0];
      const pages = ctx?.pages() ?? [];
      let rePage = pages[pages.length - 1] ?? (await ctx!.newPage());
      let detected = await detectSubmitOutcome(rePage);
      submit = { clicked: os.clicked, ...detected, message: detected.message ?? os.message };

      // Accessibility often denied (-25211), or XY click misses / validation blocks submit.
      // Fall back to Playwright click when we still see the form (no success/spam).
      if (!submit.success && !submit.spam) {
        const stillOnForm = await rePage
          .getByRole("button", { name: /submit application/i })
          .first()
          .isVisible()
          .catch(() => false);
        if (stillOnForm) {
          console.log("Submit not confirmed — Playwright click fallback...");
          const pw = await submitApplicationForm(rePage);
          submit = {
            ...pw,
            clicked: os.clicked || pw.clicked,
            message: `pw_fallback:${pw.message ?? "ok"}; prior:${os.message}`,
          };
        }
      }

      try {
        const shot = path.join(path.dirname(FILL_RESULTS_FILE), "submit-screenshot.png");
        await rePage.screenshot({ path: shot, fullPage: true });
        console.log(`Wrote submit screenshot → ${shot}`);
      } catch {
        /* optional */
      }
      pageCache.clear();
      pageCache.set(aggregatorForUrl(itemJobUrl) ?? "public", rePage);
      // Keep shared-window semantics after CDP reconnect.
      return { browser: reBrowser, submit };
    } catch (err) {
      submit = {
        clicked: os.clicked,
        spam: false,
        success: false,
        message: `reconnect_failed:${err instanceof Error ? err.message : String(err)}; ${os.message}`,
      };
      return { browser, submit };
    }
  }

  submit = await submitApplicationForm(page);
  try {
    const shot = path.join(path.dirname(FILL_RESULTS_FILE), "submit-screenshot.png");
    await page.screenshot({ path: shot, fullPage: true });
    console.log(`Wrote submit screenshot → ${shot}`);
  } catch {
    /* optional */
  }
  return { browser, submit };
}

async function main(): Promise<void> {
  const sessionRaw = JSON.parse(await readFile(FILL_SESSION_FILE, "utf8")) as unknown;
  const session = parseFillSessionFile(sessionRaw);
  const queueRaw = JSON.parse(await readFile(FILL_QUEUE_FILE, "utf8")) as unknown;
  const queue = parseFillQueueFile(queueRaw);

  const selected = queue.items.filter((item) => session.page_ids.includes(item.page_id));
  const limit = getFillLimit();
  const toProcess = selected.slice(0, Number.isFinite(limit) ? limit : selected.length);

  if (toProcess.length === 0) {
    await writeResults([]);
    console.log("No jobs in fill session — wrote empty fill-results.json.");
    return;
  }

  const keepOpen = shouldKeepBrowserOpen();
  const refs = loadFillReferences();
  let browser = await launchBrowser({
    headed: true,
    ignoreDefaultSignals: keepOpen,
    stealFocus: true,
  });
  const results: FillResultItem[] = [];
  /** Latest page per aggregator — for auto-submit reconnect only; each job still gets its own tab. */
  const pageCache = new Map<Aggregator | "public", Page>();
  let sharedContext: BrowserContext | null = null;

  const getPage = async (aggregator: Aggregator | undefined): Promise<Page> => {
    const key = aggregator ?? "public";
    // Always reuse browser.contexts()[0] so jobs open as tabs in one window.
    sharedContext = await createContext(browser, aggregator, true);
    const page = await openPage(sharedContext);
    for (const p of sharedContext.pages()) {
      if (p !== page && (p.url() === "about:blank" || p.url() === "")) {
        await p.close().catch(() => {});
      }
    }
    pageCache.set(key, page);
    return page;
  };

  try {
    for (let i = 0; i < toProcess.length; i++) {
      const item = toProcess[i]!;
      console.log(`\n[${i + 1}/${toProcess.length}] Filling: ${item.company}: ${item.role}`);

      let page = await getPage(aggregatorForUrl(item.jobUrl));
      let result = await fillApplicationForm(page, item, refs);

      if (shouldAutoSubmit() && (result.status === "filled" || result.status === "partial")) {
        const probed = await probeAutoSubmit(browser, page, pageCache, item.jobUrl);
        browser = probed.browser;
        page = pageCache.get(aggregatorForUrl(item.jobUrl) ?? "public") ?? page;
        const submit = probed.submit;
        console.log(
          `Submit: clicked=${submit.clicked} spam=${submit.spam} success=${submit.success} msg=${submit.message ?? "(none)"}`
        );
        if (submit.spam) {
          result = {
            ...result,
            status: "blocked",
            error: "spam_flag",
            deletable: false,
            filledFields: [...result.filledFields, "auto-submit:spam_flag"],
          };
        } else if (submit.success) {
          result = {
            ...result,
            filledFields: [...result.filledFields, "auto-submit:success"],
          };
        } else if (submit.clicked) {
          result = {
            ...result,
            filledFields: [...result.filledFields, "auto-submit:clicked"],
          };
        } else {
          result = {
            ...result,
            filledFields: [...result.filledFields, `auto-submit:${submit.message ?? "failed"}`],
          };
        }
      }

      results.push(result);
      printHandoffSummary(result);
      await writeResults(results);

      if (shouldAutoPause()) {
        console.log(
          "AUTO_PAUSE=1 — Playwright inspector open. Press Resume to continue to the next job."
        );
        await page.pause();
      } else {
        console.log(
          "Pre-fill complete. Finish remaining fields in the browser; agent will AskQuestion: Applied / Invalid / Feedback."
        );
      }

      if (keepOpen) {
        await waitForHandoffKeepAlive(browser);
        if (!browser.isConnected()) {
          console.log("Browser closed during handoff — ending fill loop.");
          break;
        }
      }
    }
  } finally {
    if (keepOpen && browser.isConnected()) {
      console.log("Browser left open — close the window when you are fully done.");
    } else if (browser.isConnected()) {
      await closeBrowser(browser);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
