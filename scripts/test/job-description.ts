/**
 * Unit checks for job description scraping helpers (no Playwright).
 */
import assert from "node:assert/strict";
import {
  classifyPageFailure,
  isDeletableFailure,
  normalizeScrapeUrl,
} from "../lib/job-description.js";
import {
  isEmptyPageMarkdown,
  parseTrackerRows,
  JOB_MATCH_PROPERTY,
} from "../lib/notion.js";

function testIsEmptyPageMarkdown(): void {
  assert.equal(isEmptyPageMarkdown(""), true);
  assert.equal(isEmptyPageMarkdown("   \n  "), true);
  assert.equal(isEmptyPageMarkdown("## \n\n"), true);
  assert.equal(isEmptyPageMarkdown("Short"), true);
  assert.equal(
    isEmptyPageMarkdown("## Job Description\n\nThis is a long enough posting body for testing."),
    false
  );
}

function testParseTrackerRows(): void {
  const snapshot = {
    results: [
      {
        id: "page-abc",
        properties: {
          Company: { rich_text: [{ plain_text: "Acme" }] },
          Role: { rich_text: [{ plain_text: "Engineer" }] },
          "Job URL": { url: "https://jobs.example.com/1" },
          [JOB_MATCH_PROPERTY]: { select: null },
        },
      },
      {
        id: "page-def",
        Company: "Beta",
        Role: "Designer",
        "Job URL": "https://jobs.example.com/2",
        "Job Match": "High",
      },
    ],
  };
  const rows = parseTrackerRows(snapshot);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.pageId, "page-abc");
  assert.equal(rows[0]?.company, "Acme");
  assert.equal(rows[0]?.jobUrl, "https://jobs.example.com/1");
  assert.equal(rows[0]?.jobMatch, "");
  assert.equal(rows[1]?.pageId, "page-def");
  assert.equal(rows[1]?.jobMatch, "High");
}

function testIsDeletableFailure(): void {
  assert.equal(isDeletableFailure("404"), true);
  assert.equal(isDeletableFailure("dns_failure"), true);
  assert.equal(isDeletableFailure("posting_closed"), true);
  assert.equal(isDeletableFailure("missing_url"), true);
  assert.equal(isDeletableFailure("empty_content"), true);
  assert.equal(isDeletableFailure("timeout"), true);
  assert.equal(isDeletableFailure("navigation_error"), true);
  assert.equal(isDeletableFailure("non_english"), true);
  // Transient/auth failures must NOT delete the tracker row.
  assert.equal(isDeletableFailure("login_required"), false);
  assert.equal(isDeletableFailure("captcha"), false);
}

function testNormalizeScrapeUrl(): void {
  assert.equal(
    normalizeScrapeUrl(
      "https://jobs.ashbyhq.com/acme/uuid/application"
    ),
    "https://jobs.ashbyhq.com/acme/uuid"
  );
  assert.equal(
    normalizeScrapeUrl(
      "https://jobs.lever.co/terawattinfrastructure/b01dbea0-012f-4cb4-92ab-eed8cd2a9f38/apply"
    ),
    "https://jobs.lever.co/terawattinfrastructure/b01dbea0-012f-4cb4-92ab-eed8cd2a9f38"
  );
}

function testClassifyPageFailure(): void {
  const fakePage = { url: () => "https://example.com/job" } as Parameters<
    typeof classifyPageFailure
  >[0];
  const closed = classifyPageFailure(
    fakePage,
    null,
    "This position has been filled. Thank you for your interest."
  );
  assert.equal(closed, "posting_closed");

  const login = classifyPageFailure(
    fakePage,
    null,
    "Sign in to continue to view this job posting."
  );
  assert.equal(login, "login_required");

  const empty = classifyPageFailure(fakePage, null, "x".repeat(50));
  assert.equal(empty, "empty_content");

  const form = classifyPageFailure(
    fakePage,
    null,
    "Submit your application. ATTACH RESUME/CV. Couldn't auto-read resume. Optional demographic survey."
  );
  assert.equal(form, "empty_content");
}

function testClassifyPageFailureWorkdaySignInNav(): void {
  const workdayPage = {
    url: () =>
      "https://resolvetech.wd1.myworkdayjobs.com/en-US/RTS/job/ML-Engineer_R1191",
  } as Parameters<typeof classifyPageFailure>[0];
  const body =
    "Skip to main content\nRTS Careers\nSign In\nHomepage\nSearch for Jobs\n" +
    "Senior ML Engineer\nResponsibilities:\n• Develop machine learning models and algorithms to address business needs.\n" +
    "• Collaborate with data scientists and software engineers.\n".repeat(3);
  const result = classifyPageFailure(workdayPage, null, body);
  assert.equal(result, null);
}

testIsEmptyPageMarkdown();
testParseTrackerRows();
testIsDeletableFailure();
testNormalizeScrapeUrl();
testClassifyPageFailure();
testClassifyPageFailureWorkdaySignInNav();
console.log("job-description tests: ok");
