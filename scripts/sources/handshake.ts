import { launchBrowser, createContext, saveAuthState } from "../lib/browser.js";
import {
  applyFilters,
  ensureLoggedIn,
  searchAndCollect,
  SEARCH_TERMS,
} from "../lib/handshake.js";
import { appendJobsSection, dedupeWithinSource, getJobLimit } from "../lib/scratch.js";

async function main(): Promise<void> {
  const limit = getJobLimit("handshake");
  const headed = process.env.HEADED === "1";
  const browser = await launchBrowser({ headed, aggregator: "handshake" });
  const page = await (await createContext(browser, "handshake", headed)).newPage();
  const allJobs = [];

  await ensureLoggedIn(page);
  await applyFilters(page);

  for (const term of SEARCH_TERMS) {
    if (allJobs.length >= limit) break;
    const batch = await searchAndCollect(page, term, limit - allJobs.length);
    allJobs.push(...batch);
    console.log(`Handshake "${term}": ${batch.length} jobs`);
  }

  await saveAuthState(page, "handshake");
  const deduped = dedupeWithinSource(allJobs);
  await appendJobsSection("Handshake", deduped);
  await browser.close();
  console.log(`Handshake complete: ${deduped.length} jobs`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
