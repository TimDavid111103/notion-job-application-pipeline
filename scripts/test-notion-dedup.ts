/**
 * Lightweight unit checks for Notion dedup helpers (no Playwright).
 */
import assert from "node:assert/strict";
import {
  dedupeAgainstNotion,
  normalizeJobUrl,
  parseNotionQueryResults,
} from "./lib/notion.js";
import { normalizeJobUrl as normalizeJobUrlFromJob } from "./lib/job.js";
import { parseScratchFile, sortNewestFirst } from "./lib/scratch.js";

function testNormalizeJobUrl(): void {
  assert.equal(
    normalizeJobUrl("https://app.joinhandshake.com/job-search/11147594?utm=x"),
    "https://app.joinhandshake.com/jobs/11147594"
  );
  assert.equal(
    normalizeJobUrl("https://Example.com/jobs/1/"),
    "https://example.com/jobs/1"
  );
  assert.equal(
    normalizeJobUrlFromJob("https://app.joinhandshake.com/job-search/11147594?utm=x"),
    normalizeJobUrl("https://app.joinhandshake.com/job-search/11147594?utm=x")
  );
}

function testDedupeAgainstNotion(): void {
  const existing = [
    { jobUrl: "https://app.joinhandshake.com/jobs/11147594", company: "MeritFirst", role: "AI Engineer" },
    { jobUrl: "https://other.com/x", company: "Griting", role: "Forward Deployed Engineer" },
  ];
  const jobs = [
    {
      company: "MeritFirst",
      role: "AI Engineer",
      jobUrl: "https://app.joinhandshake.com/job-search/11147594?utm_source=jack",
      source: "Handshake" as const,
      location: "Remote",
    },
    {
      company: "New Co",
      role: "Software Engineer",
      jobUrl: "https://jobs.example.com/123",
      source: "Wobo" as const,
      location: "Remote",
    },
    {
      company: "Griting",
      role: "Forward Deployed Engineer",
      jobUrl: "https://different-url.com/role",
      source: "Jack & Jill" as const,
      location: "",
    },
  ];
  const kept = dedupeAgainstNotion(jobs, existing);
  assert.equal(kept.length, 1);
  assert.equal(kept[0]?.company, "New Co");
}

function testParseNotionQueryResults(): void {
  const apiSnapshot = {
    results: [
      {
        properties: {
          Company: { rich_text: [{ plain_text: "Acme" }] },
          Role: { rich_text: [{ plain_text: "Engineer" }] },
          "Job URL": { url: "https://jobs.example.com/1" },
        },
      },
    ],
  };
  const parsedApi = parseNotionQueryResults(apiSnapshot);
  assert.equal(parsedApi.length, 1);
  assert.equal(parsedApi[0]?.company, "Acme");
  assert.equal(parsedApi[0]?.role, "Engineer");
  assert.equal(parsedApi[0]?.jobUrl, "https://jobs.example.com/1");

  const mcpSnapshot = {
    results: [
      {
        id: "abc",
        Company: "Acme",
        Role: "Engineer",
        "Job URL": "https://jobs.example.com/1",
      },
    ],
  };
  const parsedMcp = parseNotionQueryResults(mcpSnapshot);
  assert.equal(parsedMcp.length, 1);
  assert.equal(parsedMcp[0]?.company, "Acme");
  assert.equal(parsedMcp[0]?.role, "Engineer");
  assert.equal(parsedMcp[0]?.jobUrl, "https://jobs.example.com/1");
}

function testParseScratchFileEmptyLocation(): void {
  const row =
    "| 2026-07-03 | LSEG | Associate AI Product Developer | https://example.com/j/1 | Jack & Jill |  |";
  const jobs = parseScratchFile(row);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0]?.company, "LSEG");
  assert.equal(jobs[0]?.dateSourced, "2026-07-03");
  assert.equal(jobs[0]?.location, "");
}

function testParseScratchFileLegacyColumns(): void {
  const row =
    "| LSEG | Associate AI Product Developer | https://example.com/j/1 | Jack & Jill |  |";
  const jobs = parseScratchFile(row, "2026-07-01");
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0]?.dateSourced, "2026-07-01");
}

function testParseScratchFileUrlWithTripleDash(): void {
  const content = `| Date | Company | Role | Job URL | Source | Location |
|---|---|---|---|---|---|
| 2026-07-03 | AI Acquisition | AI Systems Engineer | https://jobs.workable.com/view/fwJgkLcRvPsXLXTqdSm4Cs/remote-ai-systems-engineer---forward-deployed-builder | Jack & Jill | Remote |
| 2026-07-03 | Accenture | AI Native Engineer | https://accenture.wd103.myworkdayjobs.com/AccentureCareers/job/London/AI-Native-Engineer--Agentic---Applied-_R00339258 | Jack & Jill |  |`;
  const jobs = parseScratchFile(content);
  assert.equal(jobs.length, 2);
  assert.match(jobs[0]?.jobUrl ?? "", /---/);
  assert.match(jobs[1]?.jobUrl ?? "", /---/);
}

function testSortNewestFirst(): void {
  const sorted = sortNewestFirst([
    { company: "A", role: "r", jobUrl: "https://a.com/1", source: "Wobo", location: "", dateSourced: "2026-07-01" },
    { company: "B", role: "r", jobUrl: "https://b.com/1", source: "Wobo", location: "", dateSourced: "2026-07-03" },
  ]);
  assert.equal(sorted[0]?.company, "B");
}

testNormalizeJobUrl();
testDedupeAgainstNotion();
testParseNotionQueryResults();
testParseScratchFileEmptyLocation();
testParseScratchFileLegacyColumns();
testParseScratchFileUrlWithTripleDash();
testSortNewestFirst();
console.log("notion dedup tests: ok");
