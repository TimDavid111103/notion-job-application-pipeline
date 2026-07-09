import path from "node:path";
import { runLogFilename } from "../lib/run-log.js";
import { FILL_RUN_LOGS_DIR } from "../lib/paths.js";

console.log(path.join(FILL_RUN_LOGS_DIR, runLogFilename()));
