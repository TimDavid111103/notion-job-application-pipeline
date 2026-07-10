import { launchBrowser, createContext, saveAuthState, closeBrowser } from "../lib/browser/index.js";
import { ensureLoggedIn, reviewInbox, emptySavedColumn } from "../lib/aggregators/jackjill.js";
import { appendJobs, loadScratchKeys } from "../lib/job/scratch.js";
import type { SourcedJob } from "../lib/job/index.js";

/**
 * Daily Jack & Jill clean-out: empties BOTH the inbox and the "Saved" kanban
 * column so nothing carries over day-to-day. Good jobs are appended to the
 * scratch file (deduped); everything is cleared (inbox: track/not-for-me;
 * Saved: archive). Set MAX to cap Saved cards processed (default: all).
 * Set SKIP_INBOX=1 to only empty the Saved column.
 */
async function main(): Promise<void> {
  const headed = process.env.HEADED === "1";
  const max = process.env.MAX ? parseInt(process.env.MAX, 10) : Infinity;
  const skipInbox = process.env.SKIP_INBOX === "1";
  const scratchKeys = await loadScratchKeys();
  const browser = await launchBrowser({ headed, aggregator: "jackjill" });
  const page = await (await createContext(browser, "jackjill", headed)).newPage();
  const kept: SourcedJob[] = [];

  try {
    await ensureLoggedIn(page);

    if (!skipInbox) {
      console.log("\n=== Emptying inbox ===");
      const inboxKept = await reviewInbox(page, 200, scratchKeys);
      kept.push(...inboxKept);
    }

    console.log("\n=== Emptying Saved column ===");
    const result = await emptySavedColumn(page, max, scratchKeys);
    kept.push(...result.kept);
    console.log(`\nSummary: Saved reviewed ${result.reviewed}, archived ${result.archived}; total kept ${kept.length}`);
  } finally {
    await appendJobs(kept).catch((e) => console.error("append failed:", e));
    await saveAuthState(page, "jackjill").catch(() => {});
    await closeBrowser(browser);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
