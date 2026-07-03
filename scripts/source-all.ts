import { initScratchFile } from "./lib/scratch.js";
import { spawn } from "node:child_process";

function run(cmd: string, args: string[]): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: "inherit", shell: true });
    child.on("close", (code) => resolve(code ?? 1));
  });
}

async function main(): Promise<void> {
  await initScratchFile();
  const scripts = ["wobo", "handshake", "jackjill"];

  if (process.env.PARALLEL === "1") {
    await Promise.all(
      scripts.map((s) => run("npx", ["tsx", `scripts/sources/${s}.ts`]))
    );
  } else {
    for (const s of scripts) {
      console.log(`\n--- Running ${s} ---`);
      await run("npx", ["tsx", `scripts/sources/${s}.ts`]);
    }
  }
  console.log("\nAll aggregators complete. Check sourced-jobs.md");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
