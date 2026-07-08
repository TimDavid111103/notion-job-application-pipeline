/**
 * Wrap MCP query_database results in the jobs-needing-descriptions.json envelope.
 *
 * Usage:
 *   npx tsx scripts/pipeline/write-jobs-needing-descriptions.ts [raw-mcp.json]
 *
 * stdin JSON may be `{ results: [...] }` or a bare results array.
 */
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import {
  buildJobsNeedingDescriptionsFile,
  parseJobsNeedingDescriptionsFile,
  serializeScrapeArtifact,
} from "../lib/scrape-artifacts.js";
import { JOBS_NEEDING_DESCRIPTIONS_FILE } from "../lib/paths.js";

function readInput(path?: string): unknown {
  const raw = path ? readFileSync(path, "utf8") : readFileSync(0, "utf8");
  return JSON.parse(raw) as unknown;
}

function extractResults(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && Array.isArray((data as { results?: unknown[] }).results)) {
    return (data as { results: unknown[] }).results;
  }
  throw new Error("Expected { results: [...] } or a bare results array");
}

async function main(): Promise<void> {
  const inputPath = process.argv[2];
  const results = extractResults(readInput(inputPath));
  const file = buildJobsNeedingDescriptionsFile(results);
  parseJobsNeedingDescriptionsFile(file);
  await writeFile(JOBS_NEEDING_DESCRIPTIONS_FILE, serializeScrapeArtifact(file), "utf8");
  console.log(`Wrote ${results.length} row(s) → ${JOBS_NEEDING_DESCRIPTIONS_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
