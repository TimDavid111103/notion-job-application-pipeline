import { cleanupTemporaryDataArtifacts } from "../lib/cleanup.js";

const removed = await cleanupTemporaryDataArtifacts();
if (removed.length === 0) {
  console.log("data/ already clean (only sourced-jobs.md and .gitkeep).");
} else {
  console.log(
    `Removed ${removed.length} temporary data/ artifact(s): ${removed.join(", ")}`,
  );
  console.log("data/ now keeps only sourced-jobs.md and .gitkeep.");
}
