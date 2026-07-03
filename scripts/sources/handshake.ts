/**
 * Handshake sourcing entry point — applies filters, searches each term in
 * SEARCH_TERMS, scrapes results list up to JOB_LIMIT total.
 */
import { launchBrowser, createContext, saveAuthState, closeBrowser } from "../lib/browser.js";
import {
  applyFilters,
  ensureLoggedIn,
  searchAndCollect,
  SEARCH_TERMS,
} from "../lib/handshake.js";
import { appendJobs, dedupeWithinSource, getJobLimit, type SourcedJob } from "../lib/scratch.js";

async function main(): Promise<void> {
  const limit = getJobLimit("handshake");
  const headed = process.env.HEADED === "1";
  const browser = await launchBrowser({ headed, aggregator: "handshake" });
  const page = await (await createContext(browser, "handshake", headed)).newPage();
  const allJobs: SourcedJob[] = [];

  try {
    await ensureLoggedIn(page);
    await applyFilters(page);

    for (const term of SEARCH_TERMS) {
      if (allJobs.length >= limit) break;
      const batch = await searchAndCollect(page, term, limit - allJobs.length);
      allJobs.push(...batch);
      console.log(`Handshake "${term}": ${batch.length} jobs`);
    }
  } finally {
    const deduped = dedupeWithinSource(allJobs);
    await appendJobs(deduped).catch((e) => console.error("Handshake append failed:", e));
    await saveAuthState(page, "handshake").catch(() => {});
    await closeBrowser(browser);
    console.log(`Handshake complete: ${deduped.length} jobs`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
