/**
 * Headed application fill loop — reads fill-session.json + notion-fill-queue.json.
 */
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
  fillApplicationForm,
  getFillLimit,
  printHandoffSummary,
} from "../lib/application-fill.js";
import { loadFillReferences } from "../lib/fill-references.js";
import {
  FILL_QUEUE_FILE,
  FILL_RESULTS_FILE,
  FILL_SESSION_FILE,
} from "../lib/paths.js";
import {
  buildFillResultsFile,
  parseFillQueueFile,
  parseFillSessionFile,
  serializeFillArtifact,
  type FillResultItem,
} from "../lib/fill-artifacts.js";

async function main(): Promise<void> {
  const sessionRaw = JSON.parse(await readFile(FILL_SESSION_FILE, "utf8")) as unknown;
  const session = parseFillSessionFile(sessionRaw);
  const queueRaw = JSON.parse(await readFile(FILL_QUEUE_FILE, "utf8")) as unknown;
  const queue = parseFillQueueFile(queueRaw);

  const selected = queue.items.filter((item) => session.page_ids.includes(item.page_id));
  const limit = getFillLimit();
  const toProcess = selected.slice(0, Number.isFinite(limit) ? limit : selected.length);

  if (toProcess.length === 0) {
    await writeFile(
      FILL_RESULTS_FILE,
      serializeFillArtifact(buildFillResultsFile([])),
      "utf8"
    );
    console.log("No jobs in fill session — wrote empty fill-results.json.");
    return;
  }

  const refs = loadFillReferences();
  const browser = await launchBrowser({ headed: true });
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

      if (process.env.AUTO_PAUSE !== "0") {
        console.log("Browser paused — complete remaining fields and press Resume in Playwright inspector, or close tab to continue.");
        await page.pause();
      }
    }
  } finally {
    await closeBrowser(browser);
  }

  const file = buildFillResultsFile(results);
  await writeFile(FILL_RESULTS_FILE, serializeFillArtifact(file), "utf8");
  console.log(
    `Filled ${file.summary.processed} job(s): ${file.summary.filled} filled, ${file.summary.partial} partial → ${FILL_RESULTS_FILE}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
