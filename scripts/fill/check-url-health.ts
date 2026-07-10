/**
 * Headless URL health preflight on fill queue items.
 * Default mode is HTTP fetch (no Playwright) — fast and sandbox-safe.
 * Set URL_HEALTH_MODE=browser for Playwright navigation (Handshake, etc.).
 */
import { readFile, writeFile } from "node:fs/promises";
import {
  aggregatorForUrl,
  closeBrowser,
  createContext,
  launchBrowser,
  type Aggregator,
} from "../lib/browser/index.js";
import type { Browser, Page } from "playwright";
import { sleep } from "../lib/scrape/job-description.js";
import { FILL_QUEUE_FILE, URL_HEALTH_RESULTS_FILE, ensureParentDir } from "../lib/paths.js";
import {
  buildUrlHealthResultsFile,
  parseFillQueueFile,
  serializeFillArtifact,
  type UrlHealthResultItem,
} from "../lib/artifacts/fill-artifacts.js";
import {
  checkUrlHealth,
  checkUrlHealthHttp,
  getUrlHealthDelayMs,
  getUrlHealthLimit,
  getUrlHealthMode,
} from "../lib/url-health.js";

async function main(): Promise<void> {
  const queueArg = process.argv.find((a) => a.startsWith("--file="));
  const queueFile = queueArg?.slice("--file=".length) ?? FILL_QUEUE_FILE;

  const raw = JSON.parse(await readFile(queueFile, "utf8")) as unknown;
  const queue = parseFillQueueFile(raw, queueFile);
  const limit = getUrlHealthLimit();
  const toProcess = queue.items.slice(0, Number.isFinite(limit) ? limit : queue.items.length);
  const mode = getUrlHealthMode();

  if (toProcess.length === 0) {
    await ensureParentDir(URL_HEALTH_RESULTS_FILE);
    await writeFile(
      URL_HEALTH_RESULTS_FILE,
      serializeFillArtifact(buildUrlHealthResultsFile([])),
      "utf8"
    );
    console.log("Fill queue is empty — wrote empty url-health-results.json.");
    return;
  }

  console.log(`URL health mode: ${mode} (${toProcess.length} URL(s))`);

  const results: UrlHealthResultItem[] = [];
  const delay = getUrlHealthDelayMs();

  if (mode === "http") {
    for (let i = 0; i < toProcess.length; i++) {
      const row = toProcess[i]!;
      console.log(`[${i + 1}/${toProcess.length}] ${row.company}: ${row.role}`);
      const outcome = await checkUrlHealthHttp(row.jobUrl);
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
  } else {
    let browser: Browser | undefined;
    try {
      browser = await launchBrowser();
    } catch (err) {
      if (mode === "auto") {
        console.warn(
          `Browser launch failed — falling back to HTTP mode.\n${err instanceof Error ? err.message : err}`
        );
        for (let i = 0; i < toProcess.length; i++) {
          const row = toProcess[i]!;
          console.log(`[${i + 1}/${toProcess.length}] ${row.company}: ${row.role}`);
          const outcome = await checkUrlHealthHttp(row.jobUrl);
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
      } else {
        throw err;
      }
    }

    if (browser) {
      const pageCache = new Map<Aggregator | "public", Page>();
      const getPage = async (aggregator: Aggregator | undefined): Promise<Page> => {
        const key = aggregator ?? "public";
        const cached = pageCache.get(key);
        if (cached) return cached;
        const context = await createContext(browser!, aggregator);
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
    }
  }

  const file = buildUrlHealthResultsFile(results);
  await ensureParentDir(URL_HEALTH_RESULTS_FILE);
  await writeFile(URL_HEALTH_RESULTS_FILE, serializeFillArtifact(file), "utf8");
  console.log(
    `Checked ${file.summary.queued} URL(s): ${file.summary.ok} ok, ${file.summary.broken} broken (${file.summary.deletable} deletable) → ${URL_HEALTH_RESULTS_FILE}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
