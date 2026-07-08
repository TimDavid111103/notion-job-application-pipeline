/**
 * Unit checks for scrape artifact schemas and markdown formatting.
 */
import assert from "node:assert/strict";
import {
  buildJobsNeedingDescriptionsFile,
  buildScrapeQueueFile,
  buildScrapeResultsFile,
  parseJobsNeedingDescriptionsFile,
  parseScrapeQueueFile,
  parseScrapeResultsFile,
  ScrapeArtifactError,
} from "../lib/scrape-artifacts.js";
import {
  formatJobDescriptionMarkdown,
  formatJobDescriptionPlain,
  promoteColonSectionHeadings,
  promoteSectionHeadings,
  repairLabelBoundaries,
  stripDuplicateTitleHeading,
  stripFooterContent,
} from "../lib/scrape-markdown.js";

function testRepairLabelBoundaries(): void {
  const mashed =
    "Software Engineer - RL Environments LocationSan FranciscoEmployment TypeFull timeDepartmentEngineering";
  const repaired = repairLabelBoundaries(mashed);
  assert.match(repaired, /\*\*Location:\*\* San Francisco/);
  assert.match(repaired, /\*\*Employment Type:\*\* Full time/);
  assert.match(repaired, /\*\*Department:\*\* Engineering/);
}

function testPromoteSectionHeadings(): void {
  const text = "Intro copy\n\nWhat You'll DoDesign pipelinesBuild rubrics";
  const out = promoteSectionHeadings(text);
  assert.match(out, /### What You'll Do/);
}

function testStripFooterContent(): void {
  const text = "Role details here.Apply for this JobPowered by AshbyPrivacy Policy";
  assert.equal(stripFooterContent(text), "Role details here.");

  const inlinePrivacy =
    "Equal Opportunity Together AI is an Equal Opportunity Employer. Please see our Privacy Policy for more information.";
  assert.equal(stripFooterContent(inlinePrivacy), inlinePrivacy);

  const footerCluster =
    "Role details here.Powered by Greenhouse Privacy Policy Security Vulnerability Disclosure";
  assert.equal(stripFooterContent(footerCluster), "Role details here.");

  const greenhouseFooter =
    "Please see our Privacy Policy at https://www.together.ai/privacy\nCreate a Job Alert\nInterested in building your career at Together AI?";
  assert.equal(
    stripFooterContent(greenhouseFooter),
    "Please see our Privacy Policy at https://www.together.ai/privacy"
  );
}

function testPromoteColonSectionHeadings(): void {
  const text = "Intro.\n\nWhat you would do:Lead a team of engineers";
  const out = promoteColonSectionHeadings(text);
  assert.match(out, /### What you would do/);
  assert.match(out, /Lead a team of engineers/);
}

function testStripDuplicateTitleHeading(): void {
  const text = "## Software Engineer\n\nWE HAVE CREATED";
  assert.equal(stripDuplicateTitleHeading(text), "WE HAVE CREATED");
}

function testFormatJobDescriptionPlain(): void {
  const sample = "Role summary here. ".repeat(20) + "Apply for this JobPowered by Ashby";
  const md = formatJobDescriptionPlain(sample);
  assert.match(md, /^## Job Description\n\n/);
  assert.doesNotMatch(md, /Powered by Ashby/);
  assert.ok(md.length > 200);
}

function testFormatJobDescriptionMarkdownPlainProse(): void {
  const prose = "We are hiring an engineer to build systems. ".repeat(15);
  const md = formatJobDescriptionMarkdown(prose);
  assert.match(md, /^## Job Description\n\n/);
  assert.ok(md.length > 200);
  assert.match(md, /We are hiring an engineer/);
}

function testFormatJobDescriptionMarkdown(): void {
  const sample =
    "AI Operations Lead LocationNew York City OfficeEmployment TypeFull timeAbout the RoleEvery team uses AI.Apply for this JobPowered by Ashby";
  const md = formatJobDescriptionMarkdown(sample);
  assert.match(md, /^## Job Description\n\n/);
  assert.match(md, /\*\*Location:\*\* New York City Office/);
  assert.match(md, /### About the Role/);
  assert.doesNotMatch(md, /Powered by Ashby/);
}

function testScrapeQueueSchema(): void {
  const file = buildScrapeQueueFile([
    {
      page_id: "page-1",
      company: "Acme",
      role: "Engineer",
      jobUrl: "https://jobs.example.com/1",
    },
  ]);
  const parsed = parseScrapeQueueFile(file);
  assert.equal(parsed.items.length, 1);
  assert.throws(() => parseScrapeQueueFile([{ page_id: "x" }]), ScrapeArtifactError);
}

function testScrapeResultsSchema(): void {
  const file = buildScrapeResultsFile([
    {
      page_id: "page-1",
      company: "Acme",
      role: "Engineer",
      jobUrl: "https://jobs.example.com/1",
      status: "ok",
      markdown: "## Job Description\n\nLong enough posting body for validation purposes.",
      error: null,
      deletable: false,
    },
    {
      page_id: "page-2",
      company: "Beta",
      role: "Designer",
      jobUrl: "https://jobs.example.com/2",
      status: "broken",
      markdown: null,
      error: "404",
      deletable: true,
    },
  ]);
  const parsed = parseScrapeResultsFile(file);
  assert.equal(parsed.summary.queued, 2);
  assert.equal(parsed.summary.ok, 1);
  assert.equal(parsed.summary.broken, 1);
  assert.throws(
    () =>
      parseScrapeResultsFile({
        ...file,
        items: [{ ...file.items[0], status: "ok", markdown: null, error: null, deletable: false }],
      }),
    ScrapeArtifactError
  );
}

function testJobsNeedingDescriptionsSchema(): void {
  const file = buildJobsNeedingDescriptionsFile([{ id: "page-1", Company: "Acme" }]);
  const parsed = parseJobsNeedingDescriptionsFile(file);
  assert.equal(parsed.row_count, 1);
  assert.throws(() => parseJobsNeedingDescriptionsFile({ results: [] }), ScrapeArtifactError);
}

testRepairLabelBoundaries();
testPromoteSectionHeadings();
testStripFooterContent();
testStripDuplicateTitleHeading();
testPromoteColonSectionHeadings();
testFormatJobDescriptionPlain();
testFormatJobDescriptionMarkdownPlainProse();
testFormatJobDescriptionMarkdown();
testScrapeQueueSchema();
testScrapeResultsSchema();
testJobsNeedingDescriptionsSchema();
console.log("scrape-artifacts + scrape-markdown tests: ok");
