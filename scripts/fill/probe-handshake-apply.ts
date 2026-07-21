/**
 * Headed probe: open a Handshake job, click Apply, dump form state.
 * Usage: HEADED=1 BROWSER_CDP_REUSE=0 node --import tsx scripts/fill/probe-handshake-apply.ts [jobUrl]
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { closeBrowser, createContext, launchBrowser, openPage } from "../lib/browser/index.js";

const JOB =
  process.argv[2]?.trim() || "https://app.joinhandshake.com/jobs/11173247";
const outDir = path.join(process.cwd(), "data", "fill");

async function main(): Promise<void> {
  const browser = await launchBrowser({
    headed: true,
    aggregator: "handshake",
    stealFocus: true,
    ignoreDefaultSignals: true,
  });
  const context = await createContext(browser, "handshake", true);
  const page = await openPage(context);

  console.log("Navigating to", JOB);
  await page.goto(JOB, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(3000);

  const pre = await page.evaluate(() => {
    const btns = [...document.querySelectorAll("a, button, [role=button]")]
      .map((el) => {
        const t = (el.textContent || "").replace(/\s+/g, " ").trim();
        if (!t || t.length > 80) return null;
        return {
          tag: el.tagName,
          text: t,
          href: el.getAttribute("href"),
          aria: el.getAttribute("aria-label"),
          testId:
            el.getAttribute("data-hook") ||
            el.getAttribute("data-testid") ||
            el.getAttribute("data-test"),
          cls: String((el as HTMLElement).className).slice(0, 80),
        };
      })
      .filter(Boolean);
    const applyish = btns.filter((b) =>
      /apply|application|quick apply|one-click/i.test(
        `${(b as { text: string }).text} ${(b as { aria: string | null }).aria || ""}`
      )
    );
    return {
      url: location.href,
      title: document.title,
      loggedInHint: !/log\s*in|sign\s*in/i.test(document.body?.innerText?.slice(0, 2000) || ""),
      applyish,
      allShortButtons: btns
        .filter((b) => /apply|save|external|website|message/i.test((b as { text: string }).text))
        .slice(0, 40),
    };
  });
  console.log("PRE-APPLY", JSON.stringify(pre, null, 2));
  await page.screenshot({ path: path.join(outDir, "handshake-pre-apply.png"), fullPage: true }).catch(() => {});

  let clicked = false;
  const candidates = [
    page.getByRole("button", { name: /^apply$/i }),
    page.getByRole("link", { name: /^apply$/i }),
    page.getByRole("button", { name: /apply now|quick apply|one.?click apply/i }),
    page.getByRole("link", { name: /apply now|quick apply/i }),
    page.locator("button, a").filter({ hasText: /^Apply$/i }),
  ];
  for (const loc of candidates) {
    if ((await loc.count().catch(() => 0)) === 0) continue;
    const el = loc.first();
    if (!(await el.isVisible().catch(() => false))) continue;
    const text = ((await el.textContent()) || "").trim();
    console.log("Clicking:", text);
    await el.click({ timeout: 10_000 }).catch(async () => {
      await el.click({ force: true });
    });
    clicked = true;
    break;
  }
  if (!clicked) {
    const any = page.locator("button, a, [role=button]").filter({ hasText: /apply/i });
    const count = await any.count();
    console.log("Fallback apply-ish count", count);
    for (let i = 0; i < Math.min(count, 8); i++) {
      const el = any.nth(i);
      if (!(await el.isVisible().catch(() => false))) continue;
      console.log("Trying click", i, ((await el.textContent()) || "").replace(/\s+/g, " ").trim());
      await el.click().catch(() => {});
      clicked = true;
      break;
    }
  }

  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(outDir, "handshake-post-apply.png"), fullPage: true }).catch(() => {});

  const post = await page.evaluate(() => {
    const inputs = [...document.querySelectorAll("input, textarea, select")].map((el) => {
      const i = el as HTMLInputElement;
      const label =
        (i.labels && i.labels[0] && i.labels[0].textContent) ||
        i.getAttribute("aria-label") ||
        i.getAttribute("placeholder") ||
        i.name ||
        i.id;
      return {
        tag: i.tagName,
        type: i.type || i.tagName,
        name: i.name,
        id: i.id,
        label: (label || "").replace(/\s+/g, " ").trim().slice(0, 120),
        required: i.required,
        value: (i.value || "").slice(0, 60),
      };
    });
    const dialogs = [...document.querySelectorAll("[role=dialog], [class*='modal'], [class*='Modal']")].map((d) =>
      (d.textContent || "").replace(/\s+/g, " ").trim().slice(0, 500)
    );
    const headings = [...document.querySelectorAll("h1,h2,h3,[role=heading]")].map((h) =>
      (h.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120)
    );
    return {
      url: location.href,
      title: document.title,
      headings: headings.slice(0, 20),
      dialogs: dialogs.slice(0, 5),
      inputs: inputs.slice(0, 80),
      bodySnippet: (document.body?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 2000),
    };
  });

  await writeFile(
    path.join(outDir, "handshake-apply-probe.json"),
    JSON.stringify({ job: JOB, clicked, pre, post }, null, 2)
  );
  console.log("POST-APPLY", JSON.stringify(post, null, 2));
  console.log("Wrote data/fill/handshake-apply-probe.json — browser open 180s for inspection");
  await page.waitForTimeout(180_000);
  await closeBrowser(browser);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
