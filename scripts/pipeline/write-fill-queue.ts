/**
 * Build notion-fill-queue.json from queue items JSON.
 *
 * Usage:
 *   npm run write:fill-queue -- /path/to/queue-items.json
 *
 * Input: `{ "items": [ { page_id, company, role, jobUrl, jobMatch, dateAdded, status } ] }`
 */
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import {
  buildFillQueueFile,
  parseFillQueueFile,
  serializeFillArtifact,
  type FillQueueItem,
} from "../lib/fill-artifacts.js";
import { FILL_QUEUE_FILE } from "../lib/paths.js";

function readInput(path?: string): unknown {
  const raw = path ? readFileSync(path, "utf8") : readFileSync(0, "utf8");
  return JSON.parse(raw) as unknown;
}

async function main(): Promise<void> {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("Usage: npm run write:fill-queue -- /path/to/queue-items.json");
    process.exit(1);
  }
  const data = readInput(inputPath) as { items?: FillQueueItem[] };
  const items = data.items ?? [];
  const file = buildFillQueueFile(items);
  parseFillQueueFile(file);
  await writeFile(FILL_QUEUE_FILE, serializeFillArtifact(file), "utf8");
  console.log(`Wrote ${items.length} item(s) → ${FILL_QUEUE_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
