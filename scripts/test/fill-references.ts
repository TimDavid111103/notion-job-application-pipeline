/**
 * Unit checks for fill reference parsing (no Playwright).
 */
import assert from "node:assert/strict";
import {
  interpolate,
  isSensitiveField,
  lookupField,
  normalizeLabel,
  parseAnswers,
  parsePersonalInformation,
  parseProjects,
  type FillReferences,
} from "../lib/fill-references.js";
import {
  buildEligibleJobsFilter,
  filterEligibleTrackerRows,
  isTerminalStatus,
  parseTrackerRows,
  statusUpdatePayload,
  STATUS_PROPERTY,
  IN_PROGRESS_STATUS,
} from "../lib/notion.js";
import { isDeletableFailure, classifyPageFailure } from "../lib/url-health.js";
import {
  buildFillQueueFile,
  buildJobsReadyToApplyFile,
  parseFillQueueFile,
  parseJobsReadyToApplyFile,
} from "../lib/fill-artifacts.js";

const SAMPLE_PERSONAL = `# Personal Information

## Contact
| Field | Value |
|---|---|
| Legal first name | Tim Luther |
| Legal last name | David |
| Email | tim.david1111@gmail.com |
| Phone | +1 (616) 406-5105 |

## Work authorization
| Field | Value |
|---|---|
| Authorized to work in the US | Yes |
| Require visa sponsorship now or in future | Yes |
`;

const SAMPLE_PROJECTS = `## Notion Job Pipeline

| Field | Value |
|---|---|
| Role | Solo developer |
| Tech stack | TypeScript, Playwright |

### Summary
Automated job application pipeline.

### Highlights
- Built three Cursor skills
`;

const SAMPLE_ANSWERS = `## Why this company / role

**Q:** Why do you want to work at {company}?
**A:** I am excited about {company}'s mission and the {role} role.
`;

function testParsePersonalInformation(): void {
  const map = parsePersonalInformation(SAMPLE_PERSONAL);
  assert.equal(map.get("legal first name"), "Tim Luther");
  assert.equal(map.get("email"), "tim.david1111@gmail.com");
}

function testParseProjects(): void {
  const projects = parseProjects(SAMPLE_PROJECTS);
  assert.equal(projects.length, 1);
  assert.equal(projects[0]?.name, "Notion Job Pipeline");
  assert.ok(projects[0]?.summary.includes("Automated"));
}

function testParseAnswers(): void {
  const answers = parseAnswers(SAMPLE_ANSWERS);
  assert.equal(answers.length, 1);
  assert.ok(answers[0]?.question.includes("{company}"));
}

function testSensitiveField(): void {
  assert.equal(isSensitiveField("Social Security Number"), true);
  assert.equal(isSensitiveField("Email"), false);
}

function testLookupField(): void {
  const refs: FillReferences = {
    personal: parsePersonalInformation(SAMPLE_PERSONAL),
    projects: parseProjects(SAMPLE_PROJECTS),
    answers: parseAnswers(SAMPLE_ANSWERS),
    resumePath: "/tmp/resume.pdf",
  };
  const email = lookupField("Email Address", refs, { company: "Acme", role: "Engineer" });
  assert.equal(email.source, "personal-information.md");
  assert.equal(email.value, "tim.david1111@gmail.com");

  const ssn = lookupField("SSN", refs, { company: "Acme", role: "Engineer" });
  assert.equal(ssn.reason, "sensitive_manual_only");

  const why = lookupField("Why do you want to work here?", refs, {
    company: "Acme",
    role: "Engineer",
  });
  assert.equal(why.source, "answers.md");
  assert.ok(why.value.includes("Acme"));
}

function testInterpolate(): void {
  const out = interpolate("Hello {company} — {role}", { company: "Beta", role: "SWE" });
  assert.equal(out, "Hello Beta — SWE");
}

function testNotionHelpers(): void {
  assert.equal(isTerminalStatus("Applied"), true);
  assert.equal(isTerminalStatus("In Progress"), false);
  const filter = buildEligibleJobsFilter();
  assert.ok(filter.and);
  assert.equal(statusUpdatePayload(IN_PROGRESS_STATUS)[STATUS_PROPERTY], IN_PROGRESS_STATUS);

  const rows = filterEligibleTrackerRows([
    {
      pageId: "1",
      company: "A",
      role: "B",
      jobUrl: "https://x.com",
      status: "Applied",
    },
    {
      pageId: "2",
      company: "C",
      role: "D",
      jobUrl: "https://y.com",
      status: "",
    },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.pageId, "2");
}

function testFillArtifacts(): void {
  const snap = buildJobsReadyToApplyFile([]);
  parseJobsReadyToApplyFile(snap);
  const queue = buildFillQueueFile([
    {
      page_id: "p1",
      company: "Acme",
      role: "Eng",
      jobUrl: "https://jobs.example.com/1",
      jobMatch: "High",
      dateAdded: "2026-07-08",
      status: "",
    },
  ]);
  const parsed = parseFillQueueFile(queue);
  assert.equal(parsed.item_count, 1);
}

function testUrlHealth(): void {
  assert.equal(isDeletableFailure("404"), true);
  assert.equal(isDeletableFailure("login_required"), false);
  const fakePage = { url: () => "https://example.com" } as Parameters<typeof classifyPageFailure>[0];
  assert.equal(classifyPageFailure(fakePage, { status: () => 404 } as never, "x".repeat(300)), "404");
}

function main(): void {
  testParsePersonalInformation();
  testParseProjects();
  testParseAnswers();
  testSensitiveField();
  testLookupField();
  testInterpolate();
  testNotionHelpers();
  testFillArtifacts();
  testUrlHealth();
  console.log("fill-references + url-health + fill-artifacts tests passed");
}

main();
