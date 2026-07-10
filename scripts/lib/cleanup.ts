import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import { DATA_DIR } from "./paths.js";

/** Basenames that must survive cleanup (permanent scratch + directory placeholder). */
export const PERMANENT_DATA_BASENAMES = new Set(["sourced-jobs.md", ".gitkeep"]);

/**
 * True for anything under `data/` that is safe to delete.
 * Keep only `sourced-jobs.md` and `.gitkeep` — every other file or directory is temporary.
 */
export function isTemporaryDataBasename(name: string): boolean {
  return !PERMANENT_DATA_BASENAMES.has(name);
}

/**
 * Remove every temporary `data/` artifact (files and directories).
 * Never deletes `data/sourced-jobs.md` or `data/.gitkeep`.
 * Call at the start of each aggregator run and again after MCP insert.
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
      await rm(fullPath, { recursive: true, force: true });
      removed.push(name);
    } catch {
      /* already gone or not removable */
    }
  }
  return removed;
}
