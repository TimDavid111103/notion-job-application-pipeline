/**
 * Wrap MCP query_database results in jobs-ready-to-apply.json envelope.
 */
import { writeFile } from "node:fs/promises";
import {
  buildJobsReadyToApplyFile,
  parseJobsReadyToApplyFile,
  serializeFillArtifact,
} from "../lib/artifacts/fill-artifacts.js";
import { extractResults, readJsonInput } from "../lib/cli-json.js";
import { JOBS_READY_TO_APPLY_FILE, ensureParentDir } from "../lib/paths.js";

async function main(): Promise<void> {
  const inputPath = process.argv[2];
  const results = extractResults(readJsonInput(inputPath));
  const file = buildJobsReadyToApplyFile(results);
  parseJobsReadyToApplyFile(file);
  await ensureParentDir(JOBS_READY_TO_APPLY_FILE);
  await writeFile(JOBS_READY_TO_APPLY_FILE, serializeFillArtifact(file), "utf8");
  console.log(`Wrote ${results.length} row(s) → ${JOBS_READY_TO_APPLY_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
