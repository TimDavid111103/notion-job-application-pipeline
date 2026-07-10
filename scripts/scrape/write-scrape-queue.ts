/**
 * Write notion-scrape-queue.json from queue items (requires jobs-needing-descriptions snapshot).
 *
 * Usage:
 *   npm run write:scrape-queue -- [queue-items.json]
 */
import { access, readFileSync } from "node:fs";
import { constants as fsConstants } from "node:fs";
import { writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import {
  buildScrapeQueueFile,
  parseJobsNeedingDescriptionsFile,
  parseScrapeQueueFile,
  serializeScrapeArtifact,
  type ScrapeQueueItem,
} from "../lib/artifacts/scrape-artifacts.js";
import { extractItems, readJsonInput } from "../lib/cli-json.js";
import { JOBS_NEEDING_DESCRIPTIONS_FILE, SCRAPE_QUEUE_FILE, ensureParentDir } from "../lib/paths.js";

const accessAsync = promisify(access);

async function main(): Promise<void> {
  try {
    await accessAsync(JOBS_NEEDING_DESCRIPTIONS_FILE, fsConstants.R_OK);
  } catch {
    throw new Error(
      `Missing ${JOBS_NEEDING_DESCRIPTIONS_FILE} — run write:jobs-needing-descriptions first`
    );
  }

  const snapshot = JSON.parse(readFileSync(JOBS_NEEDING_DESCRIPTIONS_FILE, "utf8")) as unknown;
  parseJobsNeedingDescriptionsFile(snapshot);

  const inputPath = process.argv[2];
  const items = extractItems<ScrapeQueueItem>(readJsonInput(inputPath));
  const file = buildScrapeQueueFile(items);
  parseScrapeQueueFile(file);
  await ensureParentDir(SCRAPE_QUEUE_FILE);
  await writeFile(SCRAPE_QUEUE_FILE, serializeScrapeArtifact(file), "utf8");
  console.log(`Wrote ${items.length} item(s) → ${SCRAPE_QUEUE_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
