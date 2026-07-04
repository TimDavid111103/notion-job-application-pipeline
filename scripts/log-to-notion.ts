/**
 * Reads sourced-jobs.md and writes notion-payloads.json for MCP logging.
 *
 * Does NOT dedupe against Notion. For normal skill runs use log-to-notion-deduped.ts
 * (`npm run log:notion:deduped`) with notion-tracker-snapshot.json from query_database.
 */
import { readFile, writeFile } from "node:fs/promises";
import { SCRATCH_FILE, parseScratchFile } from "./lib/scratch.js";
import { prepareNotionPayloads } from "./lib/notion.js";

const OUTPUT = "notion-payloads.json";

async function main(): Promise<void> {
  const content = await readFile(SCRATCH_FILE, "utf8");
  const jobs = parseScratchFile(content);
  const payloads = prepareNotionPayloads(jobs);
  await writeFile(OUTPUT, JSON.stringify(payloads, null, 2), "utf8");
  console.log(`Wrote ${payloads.length} Notion payload(s) to ${OUTPUT}`);
  console.log("Use user-notion MCP add_database_entry for each payload.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
