/**
 * Scratch file I/O for `sourced-jobs.md` — the shared table all aggregators append to.
 *
 * Two dedup layers:
 * 1. `dedupeWithinSource` — collapses repeats within a single aggregator run.
 * 2. `appendJobs` / `jobKey` — rejects rows already in the scratch file (cross-aggregator,
 *    cross-run). Duplicates never count toward JOB_LIMIT.
 *
 * `screeningSignals` is advisory only; see skill references/job-judgement.md.
 */
import { appendFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { REPO_ROOT } from "./browser.js";

export interface SourcedJob {
  company: string;
  role: string;
  jobUrl: string;
  source: "Wobo" | "Handshake" | "Jack & Jill";
  location: string;
}

export const SCRATCH_FILE = path.join(REPO_ROOT, "sourced-jobs.md");

/** Per-aggregator job limits. Override with JOB_LIMIT env. */
const DEFAULT_LIMITS: Record<string, number> = {
  wobo: 30,
  handshake: 10,
  jackjill: 10,
};

export function getJobLimit(aggregator: string): number {
  const env = process.env.JOB_LIMIT;
  if (env) {
    const n = parseInt(env, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DEFAULT_LIMITS[aggregator] ?? 10;
}

const TABLE_HEADER =
  "| Company | Role | Job URL | Source | Location |\n|---|---|---|---|---|\n";

export async function initScratchFile(): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  await writeFile(SCRATCH_FILE, `# Sourced Jobs - ${date}\n\n${TABLE_HEADER}`, "utf8");
}

export function formatRow(job: SourcedJob): string {
  const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
  return `| ${esc(job.company)} | ${esc(job.role)} | ${esc(job.jobUrl)} | ${esc(job.source)} | ${esc(job.location)} |`;
}

/**
 * Canonical identity for a job so the same posting never appears twice in the
 * scratch file: normalized Job URL (query/hash stripped, Handshake
 * `/job-search/{id}` == `/jobs/{id}`), falling back to company+role.
 */
export function jobKey(job: Pick<SourcedJob, "jobUrl" | "company" | "role">): string {
  const raw = (job.jobUrl || "").trim();
  if (raw) {
    try {
      const u = new URL(raw);
      let p = u.pathname.replace(/\/+$/, "");
      if (/joinhandshake\.com$/i.test(u.hostname)) p = p.replace(/\/job-search\/(\d+)/, "/jobs/$1");
      return `${u.protocol}//${u.hostname}${p}`.toLowerCase();
    } catch {
      return raw.split(/[?#]/)[0].replace(/\/+$/, "").toLowerCase();
    }
  }
  return `${job.company.trim().toLowerCase()}::${job.role.trim().toLowerCase()}`;
}

/** Keys already present in the scratch file (empty if the file doesn't exist). */
async function existingKeys(): Promise<Set<string>> {
  try {
    const content = await readFile(SCRATCH_FILE, "utf8");
    return new Set(parseScratchFile(content).map(jobKey));
  } catch {
    return new Set<string>();
  }
}

/**
 * Appends jobs to the scratch file, STRICTLY skipping any that already exist in
 * the file (or repeat within this batch). This prevents an aggregator from
 * duplicating a posting — and from padding its quota with duplicates.
 */
export async function appendJobs(jobs: SourcedJob[]): Promise<void> {
  if (jobs.length === 0) return;
  const seen = await existingKeys();
  const fresh: SourcedJob[] = [];
  let skipped = 0;
  for (const job of jobs) {
    const key = jobKey(job);
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    fresh.push(job);
  }
  if (skipped > 0) console.log(`Skipped ${skipped} duplicate job(s) already in ${SCRATCH_FILE}`);
  if (fresh.length === 0) return;
  const rows = fresh.map(formatRow).join("\n") + "\n";
  await appendFile(SCRATCH_FILE, rows, "utf8");
  console.log(`Appended ${fresh.length} job(s) to ${SCRATCH_FILE}`);
}

export async function appendJobsSection(source: string, jobs: SourcedJob[]): Promise<void> {
  if (jobs.length === 0) {
    console.log(`No jobs captured from ${source}`);
    return;
  }
  await appendFile(SCRATCH_FILE, `\n## ${source}\n\n`, "utf8");
  await appendJobs(jobs);
}

export function parseScratchFile(content: string): SourcedJob[] {
  const jobs: SourcedJob[] = [];
  for (const line of content.split("\n")) {
    if (!line.startsWith("|") || line.includes("---") || line.includes("Company")) continue;
    const cols = line.split("|").map((c) => c.trim()).filter(Boolean);
    if (cols.length < 5) continue;
    jobs.push({
      company: cols[0],
      role: cols[1],
      jobUrl: cols[2],
      source: cols[3] as SourcedJob["source"],
      location: cols[4],
    });
  }
  return jobs;
}

/** Collapse duplicates captured in one aggregator run before appendJobs sees them. */
export function dedupeWithinSource(jobs: SourcedJob[]): SourcedJob[] {
  const seen = new Set<string>();
  return jobs.filter((job) => {
    const key = `${job.source}::${job.jobUrl || `${job.company}::${job.role}`}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function isHourlyCompensation(text: string): boolean {
  return /\$\d+(?:\.\d{2})?\s*(?:\/\s*hr|per\s+hour|hourly)/i.test(text);
}

/**
 * Advisory-only screening. These regexes NEVER eliminate a job by themselves — they
 * return zero or more flags that ALERT the agent to things worth a closer look. The
 * final keep/reject decision is the agent's judgement call, guided by the skill's
 * `.cursor/skills/job-aggregators/references/job-judgement.md`.
 */
export function screeningSignals(title: string, description = ""): string[] {
  const combined = `${title} ${description}`;
  const flags: string[] = [];
  if (/\b(senior|staff|principal|lead|sr\.?)\b/i.test(title)) flags.push("senior-title");
  if (/\b(director|vp|head of|manager)\b/i.test(title)) flags.push("leadership-title");
  if (/\b(unpaid|volunteer|no salary|stipend only)\b/i.test(combined)) flags.push("possibly-unpaid");
  if (isHourlyCompensation(combined)) flags.push("hourly-comp");
  const nonTech = /\b(finance analyst|marketing coordinator|sales representative|sales manager|regional sales|account executive|operations manager|recruiter)\b/i;
  const hasSoftware = /\b(software|engineer|developer|ai|ml|llm|agent|data|automation)\b/i;
  if (nonTech.test(combined) && !hasSoftware.test(combined)) flags.push("possible-non-tech");
  return flags;
}
