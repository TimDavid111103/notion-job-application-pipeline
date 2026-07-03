import { appendFile, writeFile } from "node:fs/promises";
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

export async function appendJobs(jobs: SourcedJob[]): Promise<void> {
  if (jobs.length === 0) return;
  const rows = jobs.map(formatRow).join("\n") + "\n";
  await appendFile(SCRATCH_FILE, rows, "utf8");
  console.log(`Appended ${jobs.length} job(s) to ${SCRATCH_FILE}`);
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

export function shouldEliminate(title: string, description: string): boolean {
  const combined = `${title} ${description}`.toLowerCase();
  if (/\b(senior|staff|principal|lead)\b/i.test(title)) return true;
  if (/\b(unpaid|volunteer|no salary|stipend only)\b/i.test(combined)) return true;
  const nonTech = /\b(finance analyst|marketing coordinator|sales representative|operations manager)\b/i;
  const hasSoftware = /\b(software|engineer|developer|ai|ml|llm|agent)\b/i;
  if (nonTech.test(combined) && !hasSoftware.test(combined)) return true;
  return false;
}
