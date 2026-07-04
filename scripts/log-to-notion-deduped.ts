/**
 * Reads sourced-jobs.md + a Notion tracker snapshot, dedupes, writes notion-payloads.json.
 *
 * Snapshot: save the raw JSON from user-notion MCP `query_database` (database_id only —
 * omit the filter param) to notion-tracker-snapshot.json, or pass NOTION_SNAPSHOT=path.
 */
import { readFile, writeFile } from "node:fs/promises";
import { SCRATCH_FILE, jobKey, parseScratchFile } from "./lib/scratch.js";
import { dedupeAgainstNotion, parseNotionQueryResults, prepareNotionPayloads } from "./lib/notion.js";

const OUTPUT = "notion-payloads.json";
const SNAPSHOT = process.env.NOTION_SNAPSHOT ?? "notion-tracker-snapshot.json";

async function main(): Promise<void> {
  const [scratchContent, snapshotContent] = await Promise.all([
    readFile(SCRATCH_FILE, "utf8"),
    readFile(SNAPSHOT, "utf8"),
  ]);
  const jobs = parseScratchFile(scratchContent);
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
  await writeFile(OUTPUT, JSON.stringify(payloads, null, 2), "utf8");
  console.log(
    `Deduped ${jobs.length} scratch row(s) (${scratchDupes} scratch duplicate(s) collapsed) ` +
      `against ${existing.length} tracker entr(y/ies): ` +
      `${dropped} Notion duplicate(s) dropped, ${payloads.length} payload(s) → ${OUTPUT}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
