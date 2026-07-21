import { mkdir } from "node:fs/promises";
import path from "node:path";
import { REPO_ROOT } from "./browser/index.js";

/** Runtime pipeline artifacts — contents gitignored under `data/`. */
export const DATA_DIR = path.join(REPO_ROOT, "data");

/** Ensure parent directory exists before writing a nested data artifact. */
export async function ensureParentDir(filePath: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
}

export const SCRATCH_FILE = path.join(DATA_DIR, "sourced-jobs.md");

export const NOTION_SNAPSHOT_FILE = path.join(DATA_DIR, "source", "notion-tracker-snapshot.json");
export const NOTION_PAYLOADS_FILE = path.join(DATA_DIR, "source", "notion-payloads.json");

export const JOBS_NEEDING_DESCRIPTIONS_FILE = path.join(
  DATA_DIR,
  "scrape",
  "jobs-needing-descriptions.json"
);
export const SCRAPE_QUEUE_FILE = path.join(DATA_DIR, "scrape", "notion-scrape-queue.json");
export const SCRAPE_RESULTS_FILE = path.join(DATA_DIR, "scrape", "scrape-results.json");

export const JOBS_READY_TO_APPLY_FILE = path.join(DATA_DIR, "fill", "jobs-ready-to-apply.json");
export const FILL_QUEUE_FILE = path.join(DATA_DIR, "fill", "notion-fill-queue.json");
export const FILL_SESSION_FILE = path.join(DATA_DIR, "fill", "fill-session.json");
export const URL_HEALTH_RESULTS_FILE = path.join(DATA_DIR, "fill", "url-health-results.json");
export const FILL_RESULTS_FILE = path.join(DATA_DIR, "fill", "fill-results.json");
/** Written by the agent after AskQuestion to unblock a headed handoff wait. */
export const HANDOFF_CONTINUE_FILE = path.join(DATA_DIR, "fill", "handoff-continue");

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

/** Fill skill assets (PII — gitignored live copies). */
export const FILL_SKILL_DIR = path.join(REPO_ROOT, ".cursor/skills/application-filler");
export const FILL_ASSETS_DIR = path.join(FILL_SKILL_DIR, "assets");
export const PERSONAL_INFORMATION_FILE = path.join(FILL_ASSETS_DIR, "personal-information.md");
export const PROJECTS_FILE = path.join(FILL_ASSETS_DIR, "projects.md");
export const ANSWERS_FILE = path.join(FILL_ASSETS_DIR, "answers.md");
export const SKILLS_PROFILE_FILE = path.join(FILL_ASSETS_DIR, "skills-profile.md");
export const COVER_LETTER_MD_FILE = path.join(FILL_ASSETS_DIR, "cover-letter.md");
export const RESUME_FILE = path.join(FILL_ASSETS_DIR, "documents", "resume.pdf");
export const COVER_LETTER_TEMPLATE_FILE = path.join(
  FILL_ASSETS_DIR,
  "documents",
  "cover-letter-template.pdf"
);
/** Tailored cover-letter PDFs written at fill time (temporary — cleaned with data/). */
export const COVER_LETTERS_DIR = path.join(DATA_DIR, "fill", "cover-letters");

/** @deprecated Use FILL_ASSETS_DIR */
export const FILL_REFERENCES_DIR = FILL_ASSETS_DIR;
