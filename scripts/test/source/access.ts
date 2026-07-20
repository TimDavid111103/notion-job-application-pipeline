/**
 * Session smoke test — verifies `.auth/*.json` sessions still reach each aggregator.
 * Uses the same headed default as sourcing (`isSourceHeaded`). Exit 1 if any check fails.
 */
import { existsSync } from "node:fs";
import {
  launchBrowser,
  createContext,
  authPath,
  isSourceHeaded,
  openPage,
  closeBrowser,
} from "../../lib/browser/index.js";
import { verifyAccess as verifyHandshake } from "../../lib/aggregators/handshake.js";
import { verifyAccess as verifyJackjill } from "../../lib/aggregators/jackjill.js";
import { verifyAccess as verifyWobo } from "../../lib/aggregators/wobo.js";

type Aggregator = "wobo" | "handshake" | "jackjill";

const CHECKS: Array<{ name: Aggregator; verify: typeof verifyWobo }> = [
  { name: "wobo", verify: verifyWobo },
  { name: "handshake", verify: verifyHandshake },
  { name: "jackjill", verify: verifyJackjill },
];

async function main(): Promise<void> {
  const headed = isSourceHeaded();
  console.log(`=== Aggregator access check (${headed ? "headed" : "headless"}) ===\n`);
  let failed = false;

  for (const { name, verify } of CHECKS) {
    const authFile = authPath(name);
    if (!existsSync(authFile)) {
      console.log(`${name}: FAIL — no auth file (run npm run auth:${name})`);
      failed = true;
      continue;
    }

    const browser = await launchBrowser({ headed });
    const page = await openPage(await createContext(browser, name, headed));
    const { ok, ms } = await verify(page);
    await closeBrowser(browser);
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
