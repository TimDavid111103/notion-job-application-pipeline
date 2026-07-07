/**
 * Reads today's rows from data/sourced-jobs.md and writes data/notion-payloads.json for MCP logging.
 *
 * Does NOT dedupe against Notion. For normal skill runs use log-to-notion-deduped.ts
 * (`npm run log:notion:deduped`) with data/notion-tracker-snapshot.json from query_database.
 */
import { readFile, writeFile } from "node:fs/promises";
import { NOTION_PAYLOADS_FILE } from "../lib/paths.js";
import { prepareNotionPayloads } from "../lib/notion.js";
import { SCRATCH_FILE, filterJobsByDateSourced, parseScratchFile, todayIso } from "../lib/scratch.js";

const LOG_DATE = process.env.NOTION_LOG_DATE ?? todayIso();

async function main(): Promise<void> {
  const content = await readFile(SCRATCH_FILE, "utf8");
  const jobs = filterJobsByDateSourced(parseScratchFile(content), LOG_DATE);
  const payloads = prepareNotionPayloads(jobs);
  await writeFile(NOTION_PAYLOADS_FILE, JSON.stringify(payloads, null, 2), "utf8");
  console.log(`Wrote ${payloads.length} Notion payload(s) for ${LOG_DATE} to ${NOTION_PAYLOADS_FILE}`);
  console.log("Use user-notion MCP add_database_entry for each payload.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
