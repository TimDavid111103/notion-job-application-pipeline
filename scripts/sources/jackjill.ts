import { launchBrowser, createContext, saveAuthState } from "../lib/browser.js";
import { ensureLoggedIn, fillInbox, reviewInbox } from "../lib/jackjill.js";
import { appendJobsSection, dedupeWithinSource, getJobLimit } from "../lib/scratch.js";

const MIN_INBOX = 10;

async function main(): Promise<void> {
  const limit = getJobLimit("jackjill");
  const headed = process.env.HEADED === "1";
  const browser = await launchBrowser({ headed, aggregator: "jackjill" });
  const page = await (await createContext(browser, "jackjill", headed)).newPage();

  await ensureLoggedIn(page);
  await fillInbox(page, Math.max(MIN_INBOX, limit));
  const jobs = await reviewInbox(page, limit);

  await saveAuthState(page, "jackjill");
  const deduped = dedupeWithinSource(jobs);
  await appendJobsSection("Jack & Jill", deduped);
  await browser.close();
  console.log(`Jack & Jill complete: ${deduped.length} jobs`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
