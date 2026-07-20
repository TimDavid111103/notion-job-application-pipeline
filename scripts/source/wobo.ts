/**
 * Wobo sourcing entry point — dashboard swipe cards until caught up or JOB_LIMIT
 * new jobs. Skips postings already in data/sourced-jobs.md (still advances the feed).
 */
import {
  launchBrowser,
  createContext,
  saveAuthState,
  closeBrowser,
  isSourceHeaded,
  openPage,
} from "../lib/browser/index.js";
import {
  advanceCard,
  dismissAutopilot,
  isCaughtUp,
  openDashboard,
  readCardFingerprint,
  readCurrentCard,
  waitForFeedReady,
  type CardFingerprint,
} from "../lib/aggregators/wobo.js";
import {
  appendJobs,
  dedupeWithinSource,
  isScratchDuplicate,
  loadScratchKeys,
} from "../lib/job/scratch.js";
import { jobKey } from "../lib/job/index.js";
import { getJobLimit } from "../lib/job/limits.js";
import type { SourcedJob } from "../lib/job/index.js";

async function main(): Promise<void> {
  const limit = getJobLimit("wobo");
  const headed = isSourceHeaded();
  const scratchKeys = await loadScratchKeys();
  const browser = await launchBrowser({ headed, aggregator: "wobo" });
  const page = await openPage(await createContext(browser, "wobo", headed));
  const jobs: SourcedJob[] = [];
  let scratchSkipped = 0;

  try {
    await openDashboard(page);
    await waitForFeedReady(page);

    const seen = new Set<string>();
    let stalls = 0;
    while (jobs.length < limit) {
      if (await isCaughtUp(page)) {
        console.log("Wobo: all caught up for today (normal stop)");
        break;
      }
      await dismissAutopilot(page);
      const fp = await readCardFingerprint(page);
      const { jobUrl, job } = await readCurrentCard(page);
      const card: CardFingerprint = jobUrl
        ? { jobUrl, role: fp.role, company: fp.company }
        : fp;

      if (!jobUrl || jobUrl === "#") {
        const advanced = await advanceCard(page, "decline", card);
        if (!advanced) {
          stalls++;
          if (stalls >= 3) {
            console.log("Wobo: card not advancing — stopping");
            break;
          }
        } else {
          stalls = 0;
        }
        continue;
      }

      const key = jobKey({ jobUrl, company: fp.company, role: fp.role });
      if (seen.has(key)) {
        const advanced = await advanceCard(page, "save", card);
        if (!advanced) {
          stalls++;
          if (stalls >= 3) {
            console.log("Wobo: card not advancing — stopping");
            break;
          }
        } else {
          stalls = 0;
        }
        continue;
      }
      seen.add(key);

      if (job && isScratchDuplicate(job, scratchKeys)) {
        scratchSkipped++;
        console.log(`Skipped (already in scratch): ${job.company} — ${job.role}`);
        const advanced = await advanceCard(page, "save", card);
        if (!advanced) {
          stalls++;
          if (stalls >= 3) {
            console.log("Wobo: card not advancing — stopping");
            break;
          }
        } else {
          stalls = 0;
        }
        continue;
      }

      if (job) {
        jobs.push(job);
        console.log(`Captured (${jobs.length}/${limit}): ${job.company} — ${job.role}`);
      }
      const advanced = await advanceCard(page, job ? "save" : "decline", card);
      if (!advanced) {
        stalls++;
        if (stalls >= 3) {
          console.log("Wobo: card not advancing — stopping");
          break;
        }
      } else {
        stalls = 0;
      }
    }
  } finally {
    const deduped = dedupeWithinSource(jobs);
    await appendJobs(deduped).catch((e) => console.error("Wobo append failed:", e));
    await saveAuthState(page, "wobo").catch(() => {});
    await closeBrowser(browser);
    console.log(
      `Wobo complete: ${deduped.length} new job(s)` +
        (scratchSkipped ? `, ${scratchSkipped} skipped (already in scratch)` : "")
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
