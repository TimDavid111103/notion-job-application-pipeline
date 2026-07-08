import path from "node:path";
import { REPO_ROOT } from "./browser.js";

/** Runtime pipeline artifacts — contents gitignored under `data/`. */
export const DATA_DIR = path.join(REPO_ROOT, "data");

export const SCRATCH_FILE = path.join(DATA_DIR, "sourced-jobs.md");
export const NOTION_SNAPSHOT_FILE = path.join(DATA_DIR, "notion-tracker-snapshot.json");
export const NOTION_PAYLOADS_FILE = path.join(DATA_DIR, "notion-payloads.json");

export const JOBS_NEEDING_DESCRIPTIONS_FILE = path.join(DATA_DIR, "jobs-needing-descriptions.json");
export const SCRAPE_QUEUE_FILE = path.join(DATA_DIR, "notion-scrape-queue.json");
export const SCRAPE_RESULTS_FILE = path.join(DATA_DIR, "scrape-results.json");

/** Skill run logs — `*.md` gitignored; newest-first when sorted by name. */
export const RUN_LOGS_DIR = path.join(REPO_ROOT, ".cursor/skills/job-aggregators/logs");
export const SCRAPER_RUN_LOGS_DIR = path.join(
  REPO_ROOT,
  ".cursor/skills/job-description-scraper/logs"
);
