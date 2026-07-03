/**
 * Jack & Jill inbox sourcing — fill inbox to JOB_LIMIT via search prompts, then
 * review every item (Track keepers / Not for me rejections). Does not empty Saved;
 * run jack-empty.ts separately for the kanban column.
 */
import { launchBrowser, createContext, saveAuthState, closeBrowser } from "../lib/browser.js";
import { ensureLoggedIn, fillInbox, reviewInbox } from "../lib/jackjill.js";
import { appendJobs, dedupeWithinSource, getJobLimit, type SourcedJob } from "../lib/scratch.js";

async function main(): Promise<void> {
  const limit = getJobLimit("jackjill");
  const headed = process.env.HEADED === "1";
  const browser = await launchBrowser({ headed, aggregator: "jackjill" });
  const page = await (await createContext(browser, "jackjill", headed)).newPage();
  let jobs: SourcedJob[] = [];

  try {
    await ensureLoggedIn(page);
    const filled = await fillInbox(page, limit);
    // Review the whole filled inbox, not just `limit` keepers — rejections still advance.
    jobs = await reviewInbox(page, Math.max(filled, limit));
  } finally {
    const deduped = dedupeWithinSource(jobs);
    await appendJobs(deduped).catch((e) => console.error("Jack & Jill append failed:", e));
    await saveAuthState(page, "jackjill").catch(() => {});
    await closeBrowser(browser);
    console.log(`Jack & Jill complete: ${deduped.length} jobs`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
