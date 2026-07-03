import { launchBrowser, createContext, saveAuthState, type Aggregator } from "../lib/browser.js";
import {
  clickAdvance,
  dismissAutopilot,
  extractCardFromLink,
  extractVisibleCards,
  isCaughtUp,
  openDashboard,
  waitForFeedReady,
} from "../lib/wobo.js";
import { appendJobsSection, dedupeWithinSource, getJobLimit, type SourcedJob } from "../lib/scratch.js";

async function main(): Promise<void> {
  const limit = getJobLimit("wobo");
  const headed = process.env.HEADED === "1";
  const browser = await launchBrowser({ headed, aggregator: "wobo" });
  const page = await (await createContext(browser, "wobo", headed)).newPage();
  const jobs: SourcedJob[] = [];

  await openDashboard(page);
  await waitForFeedReady(page);
  jobs.push(...await extractVisibleCards(page, limit));
  console.log(`Batch scraped ${jobs.length} visible card(s)`);

  let captured = jobs.length;
  let attempts = 0;
  while (captured < limit && attempts < limit * 5 && !(await isCaughtUp(page))) {
    attempts++;
    await dismissAutopilot(page);
    const job = await extractCardFromLink(page, page.getByRole("link", { name: /view original/i }).first());
    if (job) {
      jobs.push(job);
      captured++;
      console.log(`Captured (${captured}/${limit}): ${job.company} — ${job.role}`);
      await clickAdvance(page, "save");
    } else {
      await clickAdvance(page, "decline");
    }
  }

  await saveAuthState(page, "wobo");
  const deduped = dedupeWithinSource(jobs);
  await appendJobsSection("Wobo", deduped);
  await browser.close();
  console.log(`Wobo complete: ${deduped.length} jobs`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
