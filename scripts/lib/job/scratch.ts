/**
 * Scratch file I/O for `data/sourced-jobs.md`.
 *
 * Rolling window of recent postings (default 7 days) loaded into memory during
 * sourcing so aggregators skip known jobs without burning JOB_LIMIT quota.
 *
 * Dedup layers (Notion dedup is a failsafe — see `notion.ts`):
 * 1. During sourcing — `loadScratchKeys()` + `isScratchDuplicate()` in aggregator runners.
 * 2. At write — `appendJobs()` via `jobKey()` (prepends only fresh keys).
 * 3. Before Notion log — `dedupeAgainstNotion()` on today's scratch rows vs full tracker snapshot.
 */
import { mkdir } from "node:fs/promises";
import { readFile, writeFile } from "node:fs/promises";
import { cleanJobUrl, dedupeJobList, jobKey, type SourcedJob } from "./index.js";
import { DATA_DIR, SCRATCH_FILE } from "../paths.js";

export type { SourcedJob } from "./index.js";
export { jobKey } from "./index.js";
export { SCRATCH_FILE } from "../paths.js";

const TABLE_HEADER =
  "| Date | Company | Role | Job URL | Source | Location |\n|---|---|---|---|---|---|\n";

const DEFAULT_SCRATCH_RETENTION_DAYS = 7;

export function getScratchRetentionDays(): number {
  const raw = process.env.SCRATCH_RETENTION_DAYS;
  if (!raw) return DEFAULT_SCRATCH_RETENTION_DAYS;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_SCRATCH_RETENTION_DAYS;
}

function retentionCutoffIso(retentionDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - retentionDays);
  return d.toISOString().slice(0, 10);
}

/** Drop rows older than the retention window (by `dateSourced`). */
export function pruneByRetention(jobs: SourcedJob[], retentionDays = getScratchRetentionDays()): SourcedJob[] {
  const cutoff = retentionCutoffIso(retentionDays);
  return jobs.filter((job) => (job.dateSourced ?? "") >= cutoff);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Keep rows whose `dateSourced` matches the given ISO date (default: today UTC). */
export function filterJobsByDateSourced(jobs: SourcedJob[], date = todayIso()): SourcedJob[] {
  return jobs.filter((job) => job.dateSourced === date);
}

function headerDate(content: string): string | undefined {
  const m = content.match(/^# Sourced Jobs - (\d{4}-\d{2}-\d{2})/m);
  return m?.[1];
}

function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** Newest `dateSourced` first; stable within the same date. */
export function sortNewestFirst(jobs: SourcedJob[]): SourcedJob[] {
  return [...jobs].sort((a, b) => (b.dateSourced ?? "").localeCompare(a.dateSourced ?? ""));
}

export function formatRow(job: SourcedJob): string {
  const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
  const date = job.dateSourced ?? "";
  return `| ${esc(date)} | ${esc(job.company)} | ${esc(job.role)} | ${esc(job.jobUrl)} | ${esc(job.source)} | ${esc(job.location)} |`;
}

async function writeScratchTable(jobs: SourcedJob[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const dateLine = `# Sourced Jobs - ${todayIso()}`;
  const rows = sortNewestFirst(jobs).map(formatRow).join("\n");
  const body = rows ? `${rows}\n` : "";
  await writeFile(SCRATCH_FILE, `${dateLine}\n\n${TABLE_HEADER}${body}`, "utf8");
}

export async function ensureScratchFile(): Promise<{ existing: number; pruned: number }> {
  let content = "";
  try {
    content = await readFile(SCRATCH_FILE, "utf8");
  } catch {
    /* first run */
  }

  if (!content.trim()) {
    await writeScratchTable([]);
    return { existing: 0, pruned: 0 };
  }

  const fallbackDate = headerDate(content);
  const jobs = parseScratchFile(content, fallbackDate);
  const unique = dedupeJobList(jobs);
  const pruned = jobs.length - unique.length;
  const retentionDays = getScratchRetentionDays();
  const retained = pruneByRetention(unique, retentionDays);
  const agedOut = unique.length - retained.length;
  await writeScratchTable(retained);
  if (pruned > 0) console.log(`Pruned ${pruned} duplicate row(s) from ${SCRATCH_FILE}`);
  if (agedOut > 0) {
    console.log(`Dropped ${agedOut} row(s) older than ${retentionDays} day(s) from ${SCRATCH_FILE}`);
  }
  return { existing: retained.length, pruned: pruned + agedOut };
}

/** @deprecated Use `ensureScratchFile`. */
export async function initScratchFile(): Promise<void> {
  await ensureScratchFile();
}

export async function loadScratchJobs(): Promise<SourcedJob[]> {
  try {
    const content = await readFile(SCRATCH_FILE, "utf8");
    return parseScratchFile(content, headerDate(content));
  } catch {
    return [];
  }
}

export async function loadScratchKeys(): Promise<Set<string>> {
  return new Set((await loadScratchJobs()).map(jobKey));
}

export function isScratchDuplicate(
  job: Pick<SourcedJob, "jobUrl" | "company" | "role">,
  keys: Set<string>
): boolean {
  return keys.has(jobKey(job));
}

/** Prepends new jobs (newest batch at top). Skips keys already in the file. */
export async function appendJobs(jobs: SourcedJob[]): Promise<void> {
  if (jobs.length === 0) return;
  const seen = await loadScratchKeys();
  const today = todayIso();
  const fresh: SourcedJob[] = [];
  let skipped = 0;
  for (const job of jobs) {
    const key = jobKey(job);
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    fresh.push({ ...job, dateSourced: job.dateSourced ?? today });
  }
  if (skipped > 0) console.log(`Skipped ${skipped} duplicate job(s) already in ${SCRATCH_FILE}`);
  if (fresh.length === 0) return;

  let existing: SourcedJob[] = [];
  try {
    const content = await readFile(SCRATCH_FILE, "utf8");
    existing = parseScratchFile(content, headerDate(content));
  } catch {
    /* empty */
  }

  await writeScratchTable([...fresh, ...existing]);
  console.log(`Prepended ${fresh.length} job(s) to ${SCRATCH_FILE}`);
}

export function parseScratchFile(content: string, defaultDate?: string): SourcedJob[] {
  const jobs: SourcedJob[] = [];
  for (const line of content.split("\n")) {
    if (!line.startsWith("|") || /^\|[-\s|]+\|$/.test(line.trim())) continue;
    if (line.includes("Date | Company") || line.includes("Company | Role")) continue;
    const parts = line.split("|").map((c) => c.trim());
    const cols = parts.slice(1, parts[parts.length - 1] === "" ? -1 : undefined).filter((c) => c !== "");
    if (cols.length >= 5 && isIsoDate(cols[0])) {
      jobs.push({
        dateSourced: cols[0],
        company: cols[1],
        role: cols[2],
        jobUrl: cleanJobUrl(cols[3]),
        source: cols[4] as SourcedJob["source"],
        location: cols[5] ?? "",
      });
      continue;
    }
    if (cols.length >= 4) {
      jobs.push({
        dateSourced: defaultDate ?? "",
        company: cols[0],
        role: cols[1],
        jobUrl: cleanJobUrl(cols[2]),
        source: cols[3] as SourcedJob["source"],
        location: cols[4] ?? "",
      });
    }
  }
  return jobs;
}

export function dedupeWithinSource(jobs: SourcedJob[]): SourcedJob[] {
  return dedupeJobList(jobs);
}
