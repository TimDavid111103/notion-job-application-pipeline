import { readdir, unlink } from "node:fs/promises";
import path from "node:path";
import { DATA_DIR } from "./paths.js";

/** Basenames that must survive cleanup (permanent scratch + directory placeholder). */
export const PERMANENT_DATA_BASENAMES = new Set(["sourced-jobs.md", ".gitkeep"]);

/** Known single-run artifacts under `data/` — safe to delete before/after logging. */
export const TEMPORARY_DATA_BASENAMES = new Set([
  "notion-tracker-snapshot.json",
  "notion-payloads.json",
  "jobs-needing-descriptions.json",
  "notion-scrape-queue.json",
  "scrape-results.json",
  "jobs-ready-to-apply.json",
  "notion-fill-queue.json",
  "fill-session.json",
  "url-health-results.json",
  "fill-results.json",
]);

/** True for explicit temp artifacts and aggregator scratch-pad naming conventions. */
export function isTemporaryDataBasename(name: string): boolean {
  if (PERMANENT_DATA_BASENAMES.has(name)) return false;
  return (
    TEMPORARY_DATA_BASENAMES.has(name) ||
    name.endsWith(".scratch.md") ||
    name.endsWith("-staging.json") ||
    name.endsWith("-temp.md")
  );
}

/**
 * Remove temporary `data/` artifacts. Never deletes `data/sourced-jobs.md`.
 * Call before the logging phase (stale snapshot/payloads) and again after MCP insert.
 */
export async function cleanupTemporaryDataArtifacts(): Promise<string[]> {
  const removed: string[] = [];
  let entries: string[];
  try {
    entries = await readdir(DATA_DIR);
  } catch {
    return removed;
  }

  for (const name of entries) {
    if (!isTemporaryDataBasename(name)) continue;
    const fullPath = path.join(DATA_DIR, name);
    try {
      await unlink(fullPath);
      removed.push(name);
    } catch {
      /* already gone or not a file */
    }
  }
  return removed;
}
