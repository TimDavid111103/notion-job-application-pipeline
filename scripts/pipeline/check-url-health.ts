/**
 * Headless URL health preflight on fill queue items.
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
import { sleep } from "../lib/job-description.js";
import { FILL_QUEUE_FILE, URL_HEALTH_RESULTS_FILE } from "../lib/paths.js";
import {
  buildUrlHealthResultsFile,
  parseFillQueueFile,
  serializeFillArtifact,
  type UrlHealthResultItem,
} from "../lib/fill-artifacts.js";
import {
  checkUrlHealth,
  getUrlHealthDelayMs,
  getUrlHealthLimit,
} from "../lib/url-health.js";

async function main(): Promise<void> {
  const queueArg = process.argv.find((a) => a.startsWith("--file="));
  const queueFile = queueArg?.slice("--file=".length) ?? FILL_QUEUE_FILE;

  const raw = JSON.parse(await readFile(queueFile, "utf8")) as unknown;
  const queue = parseFillQueueFile(raw, queueFile);
  const limit = getUrlHealthLimit();
  const toProcess = queue.items.slice(0, Number.isFinite(limit) ? limit : queue.items.length);

  if (toProcess.length === 0) {
    await writeFile(
      URL_HEALTH_RESULTS_FILE,
      serializeFillArtifact(buildUrlHealthResultsFile([])),
      "utf8"
    );
    console.log("Fill queue is empty — wrote empty url-health-results.json.");
    return;
  }

  const browser = await launchBrowser();
  const results: UrlHealthResultItem[] = [];
  const delay = getUrlHealthDelayMs();
  const pageCache = new Map<Aggregator | "public", Page>();

  const getPage = async (aggregator: Aggregator | undefined): Promise<Page> => {
    const key = aggregator ?? "public";
    const cached = pageCache.get(key);
    if (cached) return cached;
    const context = await createContext(browser, aggregator);
    const page = await context.newPage();
    pageCache.set(key, page);
    return page;
  };

  try {
    for (let i = 0; i < toProcess.length; i++) {
      const row = toProcess[i]!;
      console.log(`[${i + 1}/${toProcess.length}] ${row.company}: ${row.role}`);
      const page = await getPage(aggregatorForUrl(row.jobUrl));
      const outcome = await checkUrlHealth(page, row.jobUrl);
      results.push({
        page_id: row.page_id,
        company: row.company,
        role: row.role,
        jobUrl: row.jobUrl,
        status: outcome.status,
        error: outcome.error ?? null,
        deletable: outcome.deletable,
      });
      if (i < toProcess.length - 1 && delay > 0) await sleep(delay);
    }
  } finally {
    await closeBrowser(browser);
  }

  const file = buildUrlHealthResultsFile(results);
  await writeFile(URL_HEALTH_RESULTS_FILE, serializeFillArtifact(file), "utf8");
  console.log(
    `Checked ${file.summary.queued} URL(s): ${file.summary.ok} ok, ${file.summary.broken} broken (${file.summary.deletable} deletable) → ${URL_HEALTH_RESULTS_FILE}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
