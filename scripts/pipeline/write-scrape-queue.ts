/**
 * Write notion-scrape-queue.json from queue items (requires jobs-needing-descriptions snapshot).
 *
 * Usage:
 *   npx tsx scripts/pipeline/write-scrape-queue.ts [queue-items.json]
 *
 * stdin/items JSON: bare array of { page_id, company, role, jobUrl } or { items: [...] }.
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
} from "../lib/scrape-artifacts.js";
import { JOBS_NEEDING_DESCRIPTIONS_FILE, SCRAPE_QUEUE_FILE } from "../lib/paths.js";

const accessAsync = promisify(access);

function readInput(path?: string): unknown {
  const raw = path ? readFileSync(path, "utf8") : readFileSync(0, "utf8");
  return JSON.parse(raw) as unknown;
}

function extractItems(data: unknown): ScrapeQueueItem[] {
  if (Array.isArray(data)) return data as ScrapeQueueItem[];
  if (data && typeof data === "object" && Array.isArray((data as { items?: unknown[] }).items)) {
    return (data as { items: ScrapeQueueItem[] }).items;
  }
  throw new Error("Expected { items: [...] } or a bare items array");
}

async function main(): Promise<void> {
  try {
    await accessAsync(JOBS_NEEDING_DESCRIPTIONS_FILE, fsConstants.R_OK);
  } catch {
    throw new Error(
      `Missing ${JOBS_NEEDING_DESCRIPTIONS_FILE} — run write-jobs-needing-descriptions.ts first (skill step 3)`
    );
  }

  const snapshot = JSON.parse(readFileSync(JOBS_NEEDING_DESCRIPTIONS_FILE, "utf8")) as unknown;
  parseJobsNeedingDescriptionsFile(snapshot);

  const inputPath = process.argv[2];
  const items = extractItems(readInput(inputPath));
  const file = buildScrapeQueueFile(items);
  parseScrapeQueueFile(file);
  await writeFile(SCRAPE_QUEUE_FILE, serializeScrapeArtifact(file), "utf8");
  console.log(`Wrote ${items.length} item(s) → ${SCRAPE_QUEUE_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
