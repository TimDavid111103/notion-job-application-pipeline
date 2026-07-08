import path from "node:path";
import { runLogFilename } from "../lib/run-log.js";
import { SCRAPER_RUN_LOGS_DIR } from "../lib/paths.js";

console.log(path.join(SCRAPER_RUN_LOGS_DIR, runLogFilename()));
