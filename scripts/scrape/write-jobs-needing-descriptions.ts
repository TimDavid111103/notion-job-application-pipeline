/**
 * Wrap MCP query_database results in the jobs-needing-descriptions.json envelope.
 *
 * Usage:
 *   npm run write:jobs-needing-descriptions -- [raw-mcp.json]
 */
import { writeFile } from "node:fs/promises";
import {
  buildJobsNeedingDescriptionsFile,
  parseJobsNeedingDescriptionsFile,
  serializeScrapeArtifact,
} from "../lib/artifacts/scrape-artifacts.js";
import { extractResults, readJsonInput } from "../lib/cli-json.js";
import { JOBS_NEEDING_DESCRIPTIONS_FILE, ensureParentDir } from "../lib/paths.js";

async function main(): Promise<void> {
  const inputPath = process.argv[2];
  const results = extractResults(readJsonInput(inputPath));
  const file = buildJobsNeedingDescriptionsFile(results);
  parseJobsNeedingDescriptionsFile(file);
  await ensureParentDir(JOBS_NEEDING_DESCRIPTIONS_FILE);
  await writeFile(JOBS_NEEDING_DESCRIPTIONS_FILE, serializeScrapeArtifact(file), "utf8");
  console.log(`Wrote ${results.length} row(s) → ${JOBS_NEEDING_DESCRIPTIONS_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
