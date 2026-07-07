import { cleanupTemporaryDataArtifacts } from "../lib/cleanup.js";

const removed = await cleanupTemporaryDataArtifacts();
if (removed.length === 0) {
  console.log("No temporary data artifacts to remove.");
} else {
  console.log(`Removed ${removed.length} temporary artifact(s): ${removed.join(", ")}`);
}
