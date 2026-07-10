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

export const JOBS_READY_TO_APPLY_FILE = path.join(DATA_DIR, "jobs-ready-to-apply.json");
export const FILL_QUEUE_FILE = path.join(DATA_DIR, "notion-fill-queue.json");
export const FILL_SESSION_FILE = path.join(DATA_DIR, "fill-session.json");
export const URL_HEALTH_RESULTS_FILE = path.join(DATA_DIR, "url-health-results.json");
export const FILL_RESULTS_FILE = path.join(DATA_DIR, "fill-results.json");

/** Skill run logs — `*.md` gitignored; newest-first when sorted by name. */
export const RUN_LOGS_DIR = path.join(REPO_ROOT, ".cursor/skills/aggregator-sourcer/logs");
export const SCRAPER_RUN_LOGS_DIR = path.join(
  REPO_ROOT,
  ".cursor/skills/description-scraper/logs"
);
export const FILL_RUN_LOGS_DIR = path.join(
  REPO_ROOT,
  ".cursor/skills/application-filler/logs"
);

/** Fill skill reference files (PII — gitignored live copies). */
export const FILL_SKILL_DIR = path.join(REPO_ROOT, ".cursor/skills/application-filler");
export const FILL_REFERENCES_DIR = path.join(FILL_SKILL_DIR, "references");
export const PERSONAL_INFORMATION_FILE = path.join(FILL_REFERENCES_DIR, "personal-information.md");
export const PROJECTS_FILE = path.join(FILL_REFERENCES_DIR, "projects.md");
export const ANSWERS_FILE = path.join(FILL_REFERENCES_DIR, "answers.md");
export const RESUME_FILE = path.join(FILL_REFERENCES_DIR, "documents", "resume.pdf");
