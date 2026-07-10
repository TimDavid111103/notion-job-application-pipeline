/**
 * Orchestrates all three aggregators — ensures scratch file, spawns per-aggregator
 * runners, prints a summary. Set PARALLEL=1 to run concurrently.
 *
 * Each child is detached so AGGREGATOR_TIMEOUT_MS can SIGKILL the whole process group
 * if a browser hangs (common with Wobo/Jack SPAs).
 */
import { spawn } from "node:child_process";
import { ensureScratchFile } from "../lib/job/scratch.js";

/** Default per-aggregator wall-clock cap (ms). Override with AGGREGATOR_TIMEOUT_MS. */
const DEFAULT_TIMEOUT_MS = parseInt(process.env.AGGREGATOR_TIMEOUT_MS ?? "300000", 10);

/** Jack inbox fill + review needs more time than Wobo/Handshake. */
const JACK_TIMEOUT_MS = (() => {
  const raw = process.env.JACK_TIMEOUT_MS ?? process.env.JACK_TIMEOUT ?? "600000";
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 600_000;
})();

const TIMEOUT_BY_SCRIPT: Record<string, number> = {
  wobo: DEFAULT_TIMEOUT_MS,
  handshake: DEFAULT_TIMEOUT_MS,
  jackjill: JACK_TIMEOUT_MS,
};

interface Result {
  name: string;
  code: number;
  ms: number;
  timedOut: boolean;
}

const TSX_BIN = "node_modules/.bin/tsx";

function run(name: string, script: string): Promise<Result> {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const timeoutMs = TIMEOUT_BY_SCRIPT[name] ?? DEFAULT_TIMEOUT_MS;
    // detached: child leads its own process group so we can kill the whole tree
    // (a plain kill on a shell wrapper leaves the node grandchild running).
    const child = spawn(TSX_BIN, [script], { stdio: "inherit", detached: true });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      console.warn(`\n[${name}] exceeded ${timeoutMs / 1000}s cap — killing.`);
      try {
        if (child.pid) process.kill(-child.pid, "SIGKILL");
      } catch {
        child.kill("SIGKILL");
      }
    }, timeoutMs);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ name, code: code ?? 1, ms: Date.now() - t0, timedOut });
    });
  });
}

async function main(): Promise<void> {
  const { existing, pruned } = await ensureScratchFile();
  if (existing > 0) {
    console.log(`Scratch file: ${existing} prior job(s)${pruned ? ` (${pruned} duplicate(s) pruned)` : ""}`);
  }
  // RUN_ID correlates console output with skill run logs (step 9).
  process.env.RUN_ID = process.env.RUN_ID ?? new Date().toISOString().replace(/[:.]/g, "-");
  console.log(`Run ID: ${process.env.RUN_ID}`);

  const scripts = ["wobo", "handshake", "jackjill"];
  const runOne = (s: string) => run(s, `scripts/source/${s}.ts`);

  let results: Result[];
  if (process.env.PARALLEL === "1") {
    results = await Promise.all(scripts.map(runOne));
  } else {
    results = [];
    for (const s of scripts) {
      console.log(`\n--- Running ${s} ---`);
      results.push(await runOne(s));
    }
  }

  console.log("\n=== Sourcing summary ===");
  for (const r of results) {
    const status = r.timedOut ? "TIMEOUT" : r.code === 0 ? "ok" : `FAILED (exit ${r.code})`;
    console.log(`  ${r.name.padEnd(10)} ${status.padEnd(18)} ${(r.ms / 1000).toFixed(1)}s`);
  }
  console.log("Check data/sourced-jobs.md for captured jobs.");
  process.exit(results.some((r) => r.code !== 0) ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
