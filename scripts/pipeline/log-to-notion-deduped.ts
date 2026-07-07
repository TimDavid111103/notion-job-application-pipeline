/**
 * Reads today's rows from data/sourced-jobs.md + a Notion tracker snapshot, dedupes
 * (failsafe vs tracker), writes data/notion-payloads.json for MCP step 7.
 *
 * Older scratch rows are used only during sourcing (loadScratchKeys / appendJobs).
 * Only rows with dateSourced === today (UTC) are eligible for Notion logging.
 *
 * Snapshot: save the raw JSON from user-notion MCP `query_database` (database_id only —
 * omit the filter param) to data/notion-tracker-snapshot.json, or pass NOTION_SNAPSHOT=path.
 */
import { readFile, writeFile } from "node:fs/promises";
import { NOTION_PAYLOADS_FILE, NOTION_SNAPSHOT_FILE } from "../lib/paths.js";
import { dedupeAgainstNotion, parseNotionQueryResults, prepareNotionPayloads } from "../lib/notion.js";
import { SCRATCH_FILE, filterJobsByDateSourced, jobKey, parseScratchFile, todayIso } from "../lib/scratch.js";

const SNAPSHOT = process.env.NOTION_SNAPSHOT ?? NOTION_SNAPSHOT_FILE;
const LOG_DATE = process.env.NOTION_LOG_DATE ?? todayIso();

async function main(): Promise<void> {
  const [scratchContent, snapshotContent] = await Promise.all([
    readFile(SCRATCH_FILE, "utf8"),
    readFile(SNAPSHOT, "utf8"),
  ]);
  const allScratch = parseScratchFile(scratchContent);
  const jobs = filterJobsByDateSourced(allScratch, LOG_DATE);
  const scratchUnique: typeof jobs = [];
  const seenScratch = new Set<string>();
  for (const job of jobs) {
    const key = jobKey(job);
    if (seenScratch.has(key)) continue;
    seenScratch.add(key);
    scratchUnique.push(job);
  }
  const scratchDupes = jobs.length - scratchUnique.length;
  const existing = parseNotionQueryResults(JSON.parse(snapshotContent));
  const newJobs = dedupeAgainstNotion(scratchUnique, existing);
  const dropped = scratchUnique.length - newJobs.length;
  const payloads = prepareNotionPayloads(newJobs);
  await writeFile(NOTION_PAYLOADS_FILE, JSON.stringify(payloads, null, 2), "utf8");
  console.log(
    `Deduped ${jobs.length} scratch row(s) for ${LOG_DATE} (${scratchDupes} scratch duplicate(s) collapsed) ` +
      `against ${existing.length} tracker entr(y/ies): ` +
      `${dropped} Notion duplicate(s) skipped, ${payloads.length} payload(s) → ${NOTION_PAYLOADS_FILE} ` +
      `(${allScratch.length - jobs.length} older scratch row(s) ignored)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
