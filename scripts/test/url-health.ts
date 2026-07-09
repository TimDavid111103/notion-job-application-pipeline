/**
 * Unit checks for shared URL health helpers (no Playwright).
 */
import assert from "node:assert/strict";
import { classifyPageFailure, isDeletableFailure } from "../lib/url-health.js";

function testIsDeletableFailure(): void {
  assert.equal(isDeletableFailure("404"), true);
  assert.equal(isDeletableFailure("posting_closed"), true);
  assert.equal(isDeletableFailure("login_required"), false);
  assert.equal(isDeletableFailure("captcha"), false);
}

function testClassifyPageFailure(): void {
  const fakePage = { url: () => "https://example.com" } as Parameters<typeof classifyPageFailure>[0];
  assert.equal(classifyPageFailure(fakePage, { status: () => 404 } as never, "body"), "404");
  assert.equal(
    classifyPageFailure(fakePage, null, "This position has been filled. " + "x".repeat(300)),
    "posting_closed"
  );
}

function main(): void {
  testIsDeletableFailure();
  testClassifyPageFailure();
  console.log("url-health tests passed");
}

main();
