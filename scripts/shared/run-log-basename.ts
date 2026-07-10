/**
 * Print run-log path or basename for a skill lane.
 *
 * Usage:
 *   npm run run-log:basename              # source — basename only
 *   npm run run-log:basename:scraper      # scrape — full path
 *   npm run run-log:basename:fill         # fill — full path
 *
 * Or: npx tsx scripts/shared/run-log-basename.ts --skill=source|scrape|fill
 */
import path from "node:path";
import { runLogFilename } from "../lib/run-log.js";
import { FILL_RUN_LOGS_DIR, SCRAPER_RUN_LOGS_DIR } from "../lib/paths.js";

type Skill = "source" | "scrape" | "fill";

function parseSkill(): Skill {
  const arg = process.argv.find((a) => a.startsWith("--skill="));
  if (arg) {
    const value = arg.slice("--skill=".length) as Skill;
    if (value === "source" || value === "scrape" || value === "fill") return value;
  }
  const env = process.env.RUN_LOG_SKILL as Skill | undefined;
  if (env === "source" || env === "scrape" || env === "fill") return env;
  return "source";
}

const skill = parseSkill();
const filename = runLogFilename();

if (skill === "source") {
  console.log(filename);
} else if (skill === "scrape") {
  console.log(path.join(SCRAPER_RUN_LOGS_DIR, filename));
} else {
  console.log(path.join(FILL_RUN_LOGS_DIR, filename));
}
