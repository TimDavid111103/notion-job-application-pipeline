/**
 * Unit checks for shared URL health helpers (no Playwright).
 */
import assert from "node:assert/strict";
import {
  classifyBodyFailure,
  classifyPageFailure,
  getUrlHealthMode,
  isDeletableFailure,
  isHttpSpaShellReachable,
} from "../lib/url-health.js";

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
  assert.equal(
    classifyBodyFailure("https://example.com", 404, "missing"),
    "404"
  );
}

function testDefaultMode(): void {
  delete process.env.URL_HEALTH_MODE;
  assert.equal(getUrlHealthMode(), "http");
  process.env.URL_HEALTH_MODE = "browser";
  assert.equal(getUrlHealthMode(), "browser");
  delete process.env.URL_HEALTH_MODE;
}

function testSpaShell(): void {
  const html =
    '<html><head><title>Agent Ops @ Runbook</title></head><body><div id="root"></div>You need to enable JavaScript to run this app.</body></html>';
  assert.equal(isHttpSpaShellReachable(200, html, "Agent Ops @ Runbook You need to enable JavaScript"), true);
  assert.equal(isHttpSpaShellReachable(404, html, "missing"), false);
}

function main(): void {
  testIsDeletableFailure();
  testClassifyPageFailure();
  testDefaultMode();
  testSpaShell();
  console.log("url-health tests passed");
}

main();
