/**
 * Wobo sourcing entry point — dashboard swipe cards until caught up or JOB_LIMIT.
 * Appends to sourced-jobs.md via appendJobs (strict cross-file dedup).
 */
import { launchBrowser, createContext, saveAuthState, closeBrowser } from "../lib/browser.js";
import {
  advanceCard,
  dismissAutopilot,
  isCaughtUp,
  openDashboard,
  readCurrentCard,
  waitForFeedReady,
} from "../lib/wobo.js";
import { appendJobs, dedupeWithinSource, getJobLimit, type SourcedJob } from "../lib/scratch.js";

async function main(): Promise<void> {
  const limit = getJobLimit("wobo");
  const headed = process.env.HEADED === "1";
  const browser = await launchBrowser({ headed, aggregator: "wobo" });
  const page = await (await createContext(browser, "wobo", headed)).newPage();
  const jobs: SourcedJob[] = [];

  try {
    await openDashboard(page);
    await waitForFeedReady(page);

    const seen = new Set<string>();
    let stalls = 0;
    while (jobs.length < limit) {
      if (await isCaughtUp(page)) {
        console.log("Wobo: caught up — no more matches");
        break;
      }
      await dismissAutopilot(page);
      const { jobUrl, job } = await readCurrentCard(page);

      if (jobUrl && !seen.has(jobUrl)) {
        seen.add(jobUrl);
        if (job) {
          jobs.push(job);
          console.log(`Captured (${jobs.length}/${limit}): ${job.company} — ${job.role}`);
        } else {
          console.log(`Skipped (eliminated): ${jobUrl}`);
        }
        const advanced = await advanceCard(page, job ? "save" : "decline", jobUrl);
        if (!advanced) {
          stalls++;
          if (stalls >= 2) {
            console.log("Wobo: card not advancing — stopping");
            break;
          }
        } else {
          stalls = 0;
        }
      } else {
        // Same card still showing (duplicate href or slow render) — nudge Save to advance.
        const advanced = await advanceCard(page, "save", jobUrl ?? "");
        if (!advanced) {
          stalls++;
          if (stalls >= 2) {
            console.log("Wobo: card not advancing — stopping");
            break;
          }
        } else {
          stalls = 0;
        }
      }
    }
  } finally {
    const deduped = dedupeWithinSource(jobs);
    await appendJobs(deduped).catch((e) => console.error("Wobo append failed:", e));
    await saveAuthState(page, "wobo").catch(() => {});
    await closeBrowser(browser);
    console.log(`Wobo complete: ${deduped.length} jobs`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
