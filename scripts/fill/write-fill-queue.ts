/**
 * Build notion-fill-queue.json from queue items JSON.
 *
 * Usage:
 *   npm run write:fill-queue -- /path/to/queue-items.json
 */
import { writeFile } from "node:fs/promises";
import {
  buildFillQueueFile,
  parseFillQueueFile,
  serializeFillArtifact,
  type FillQueueItem,
} from "../lib/artifacts/fill-artifacts.js";
import { extractItems, readJsonInput } from "../lib/cli-json.js";
import { FILL_QUEUE_FILE, ensureParentDir } from "../lib/paths.js";

async function main(): Promise<void> {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("Usage: npm run write:fill-queue -- /path/to/queue-items.json");
    process.exit(1);
  }
  const items = extractItems<FillQueueItem>(readJsonInput(inputPath));
  const file = buildFillQueueFile(items);
  parseFillQueueFile(file);
  await ensureParentDir(FILL_QUEUE_FILE);
  await writeFile(FILL_QUEUE_FILE, serializeFillArtifact(file), "utf8");
  console.log(`Wrote ${items.length} item(s) → ${FILL_QUEUE_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
