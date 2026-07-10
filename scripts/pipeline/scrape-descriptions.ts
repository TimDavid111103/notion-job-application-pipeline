/**
 * Reads data/notion-scrape-queue.json, scrapes each Job URL, writes data/scrape-results.json.
 */
import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import {
  aggregatorForUrl,
  closeBrowser,
  createContext,
  launchBrowser,
  type Aggregator,
} from "../lib/browser.js";
import type { Page } from "playwright";
import {
  getScrapeDelayMs,
  getScrapeLimit,
  scrapeJobDescription,
  sleep,
} from "../lib/job-description.js";
import { JOBS_NEEDING_DESCRIPTIONS_FILE, SCRAPE_QUEUE_FILE, SCRAPE_RESULTS_FILE } from "../lib/paths.js";
import {
  buildScrapeResultsFile,
  parseJobsNeedingDescriptionsFile,
  parseScrapeQueueFile,
  serializeScrapeArtifact,
  type ScrapeResultItem,
} from "../lib/scrape-artifacts.js";

async function main(): Promise<void> {
  try {
    await access(JOBS_NEEDING_DESCRIPTIONS_FILE, fsConstants.R_OK);
    const snapshot = JSON.parse(await readFile(JOBS_NEEDING_DESCRIPTIONS_FILE, "utf8")) as unknown;
    const parsed = parseJobsNeedingDescriptionsFile(snapshot);
    console.log(
      `Snapshot: ${parsed.row_count} unmatched row(s) in ${JOBS_NEEDING_DESCRIPTIONS_FILE}`
    );
  } catch {
    console.warn(
      `Warning: ${JOBS_NEEDING_DESCRIPTIONS_FILE} missing or invalid — run npm run write:jobs-needing-descriptions (skill step 3)`
    );
  }

  const raw = JSON.parse(await readFile(SCRAPE_QUEUE_FILE, "utf8")) as unknown;
  const queueFile = parseScrapeQueueFile(raw);
  const limit = getScrapeLimit();
  const toProcess = queueFile.items.slice(0, Number.isFinite(limit) ? limit : queueFile.items.length);

  if (toProcess.length === 0) {
    await writeFile(
      SCRAPE_RESULTS_FILE,
      serializeScrapeArtifact(buildScrapeResultsFile([])),
      "utf8"
    );
    console.log("Scrape queue is empty — wrote empty results file.");
    return;
  }

  const browser = await launchBrowser();
  const results: ScrapeResultItem[] = [];
  const delay = getScrapeDelayMs();

  // One page per auth profile, created on demand. Public ATS hosts (Greenhouse,
  // Lever, Ashby, Workday, …) use the default no-auth page; Handshake URLs reuse
  // the `.auth/handshake.json` session shared with the aggregator-sourcer skill.
  const pageCache = new Map<Aggregator | "public", Page>();
  const getPage = async (aggregator: Aggregator | undefined): Promise<Page> => {
    const key = aggregator ?? "public";
    const cached = pageCache.get(key);
    if (cached) return cached;
    const context = await createContext(browser, aggregator);
    const page = await context.newPage();
    pageCache.set(key, page);
    if (aggregator) console.log(`Loaded ${aggregator} session for authenticated scrapes.`);
    return page;
  };

  try {
    for (let i = 0; i < toProcess.length; i++) {
      const row = toProcess[i]!;
      console.log(`[${i + 1}/${toProcess.length}] ${row.company}: ${row.role}`);
      const page = await getPage(aggregatorForUrl(row.jobUrl));
      const outcome = await scrapeJobDescription(page, row.jobUrl);
      results.push({
        page_id: row.page_id,
        company: row.company,
        role: row.role,
        jobUrl: row.jobUrl,
        status: outcome.status,
        markdown: outcome.markdown ?? null,
        error: outcome.error ?? null,
        deletable: outcome.deletable,
      });
      if (i < toProcess.length - 1 && delay > 0) await sleep(delay);
    }
  } finally {
    await closeBrowser(browser);
  }

  const resultsFile = buildScrapeResultsFile(results);
  await writeFile(SCRAPE_RESULTS_FILE, serializeScrapeArtifact(resultsFile), "utf8");

  const { summary } = resultsFile;
  console.log(
    `Scraped ${summary.queued} URL(s): ${summary.ok} ok, ${summary.broken} broken (${summary.deletable} deletable) → ${SCRAPE_RESULTS_FILE}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
