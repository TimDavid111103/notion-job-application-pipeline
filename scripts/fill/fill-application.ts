/**
 * Headed application fill loop — reads fill-session.json + notion-fill-queue.json.
 */
import { readFile, writeFile, unlink, access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import {
  aggregatorForUrl,
  closeBrowser,
  createContext,
  launchBrowser,
  type Aggregator,
} from "../lib/browser/index.js";
import type { Browser, Page } from "playwright";
import {
  fillApplicationForm,
  getFillLimit,
  printHandoffSummary,
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
  const browser = await launchBrowser({
    headed: true,
    ignoreDefaultSignals: keepOpen,
  });
  const results: FillResultItem[] = [];
  const pageCache = new Map<Aggregator | "public", Page>();

  const getPage = async (aggregator: Aggregator | undefined): Promise<Page> => {
    const key = aggregator ?? "public";
    const cached = pageCache.get(key);
    if (cached) return cached;
    const context = await createContext(browser, aggregator, true);
    const page = await context.newPage();
    pageCache.set(key, page);
    return page;
  };

  try {
    for (let i = 0; i < toProcess.length; i++) {
      const item = toProcess[i]!;
      console.log(`\n[${i + 1}/${toProcess.length}] Filling: ${item.company}: ${item.role}`);
      const page = await getPage(aggregatorForUrl(item.jobUrl));
      const result = await fillApplicationForm(page, item, refs);
      results.push(result);
      printHandoffSummary(result);

      // Persist after each job so the agent can read results while the browser stays open.
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
      // Still connected after final handoff wait — leave Chrome up; do not close.
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
