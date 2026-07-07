/**
 * Headless smoke test — verifies `.auth/*.json` sessions still reach each aggregator.
 * Run after auth or when a source script fails on login. Exit 1 if any check fails.
 */
import { existsSync } from "node:fs";
import { launchBrowser, createContext, authPath } from "../lib/browser.js";
import { verifyAccess as verifyHandshake } from "../lib/handshake.js";
import { verifyAccess as verifyJackjill } from "../lib/jackjill.js";
import { verifyAccess as verifyWobo } from "../lib/wobo.js";

type Aggregator = "wobo" | "handshake" | "jackjill";

const CHECKS: Array<{ name: Aggregator; verify: typeof verifyWobo }> = [
  { name: "wobo", verify: verifyWobo },
  { name: "handshake", verify: verifyHandshake },
  { name: "jackjill", verify: verifyJackjill },
];

async function main(): Promise<void> {
  console.log("=== Aggregator access check (headless) ===\n");
  let failed = false;

  for (const { name, verify } of CHECKS) {
    const authFile = authPath(name);
    if (!existsSync(authFile)) {
      console.log(`${name}: FAIL — no auth file (run npm run auth:${name})`);
      failed = true;
      continue;
    }

    const browser = await launchBrowser({ headed: false });
    const page = await (await createContext(browser, name)).newPage();
    const { ok, ms } = await verify(page);
    await browser.close();
    console.log(`${name}: ${ok ? "OK" : "FAIL"} (${ms}ms)`);
    if (!ok) failed = true;
  }

  if (failed) process.exit(1);
  console.log("\nAll aggregators accessible.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
