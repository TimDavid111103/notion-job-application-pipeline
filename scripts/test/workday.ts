/**
 * Unit checks for Workday CXS API helpers (no network).
 */
import assert from "node:assert/strict";
import {
  buildWorkdayCxsApiUrl,
  htmlToPlainText,
  isWorkdayJobUrl,
  parseWorkdayJobUrl,
} from "../lib/workday.js";

function testIsWorkdayJobUrl(): void {
  assert.equal(
    isWorkdayJobUrl("https://resolvetech.wd1.myworkdayjobs.com/en-US/RTS/job/ML-Engineer_R1191"),
    true
  );
  assert.equal(isWorkdayJobUrl("https://jobs.lever.co/acme/role"), false);
}

function testParseWorkdayJobUrlWithLocale(): void {
  const parsed = parseWorkdayJobUrl(
    "https://resolvetech.wd1.myworkdayjobs.com/en-US/RTS/job/ML-Engineer_R1191"
  );
  assert.ok(parsed);
  assert.equal(parsed.tenant, "resolvetech");
  assert.equal(parsed.site, "RTS");
  assert.equal(parsed.jobPath, "job/ML-Engineer_R1191");
  assert.equal(
    buildWorkdayCxsApiUrl(parsed),
    "https://resolvetech.wd1.myworkdayjobs.com/wday/cxs/resolvetech/RTS/job/ML-Engineer_R1191"
  );
}

function testParseWorkdayJobUrlWithoutLocale(): void {
  const parsed = parseWorkdayJobUrl(
    "https://accenture.wd103.myworkdayjobs.com/AccentureCareers/job/London/AI-Native-Engineer--Agentic---Applied-_R00339258"
  );
  assert.ok(parsed);
  assert.equal(parsed.tenant, "accenture");
  assert.equal(parsed.site, "AccentureCareers");
  assert.equal(parsed.jobPath, "job/London/AI-Native-Engineer--Agentic---Applied-_R00339258");
  assert.equal(
    buildWorkdayCxsApiUrl(parsed),
    "https://accenture.wd103.myworkdayjobs.com/wday/cxs/accenture/AccentureCareers/job/London/AI-Native-Engineer--Agentic---Applied-_R00339258"
  );
}

function testParseWorkdayJobUrlOtherTenants(): void {
  const amgen = parseWorkdayJobUrl(
    "https://amgen.wd1.myworkdayjobs.com/en-US/Careers/job/Principal-Software-Engineer_R-240843"
  );
  assert.ok(amgen);
  assert.equal(amgen.site, "Careers");
  assert.equal(amgen.jobPath, "job/Principal-Software-Engineer_R-240843");

  const csl = parseWorkdayJobUrl(
    "https://csl.wd1.myworkdayjobs.com/en-US/CSL_External/job/Associate-Director--AI---Advanced-Analytics_R-279491"
  );
  assert.ok(csl);
  assert.equal(csl.site, "CSL_External");
}

function testHtmlToPlainText(): void {
  const html =
    "<p><b>Responsibilities:</b><br/>• Develop models<br/>• Collaborate with teams</p><p>CSL&#39;s team</p>";
  const text = htmlToPlainText(html);
  assert.match(text, /Responsibilities:/);
  assert.match(text, /Develop models/);
  assert.match(text, /CSL's team/);
  assert.doesNotMatch(text, /<[^>]+>/);
}

testIsWorkdayJobUrl();
testParseWorkdayJobUrlWithLocale();
testParseWorkdayJobUrlWithoutLocale();
testParseWorkdayJobUrlOtherTenants();
testHtmlToPlainText();
console.log("workday tests: ok");
