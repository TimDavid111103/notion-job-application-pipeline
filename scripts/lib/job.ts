/**
 * Shared job types and identity keys — used by scratch I/O, aggregators, and Notion dedup.
 */
export type JobSource = "Wobo" | "Handshake" | "Jack & Jill";

export interface SourcedJob {
  company: string;
  role: string;
  jobUrl: string;
  source: JobSource;
  location: string;
  /** ISO date (YYYY-MM-DD) when the row was sourced to scratch; set in `scratch.ts`. */
  dateSourced?: string;
}

/**
 * Unwrap markdown link syntax (`[label](url)`) or return a trimmed plain URL.
 */
export function cleanJobUrl(raw?: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  const md = trimmed.match(/^\[[^\]]*\]\(([^)]+)\)$/);
  return (md ? md[1] : trimmed).trim();
}

/**
 * Canonicalizes a job URL so equivalent postings compare equal:
 * - unwraps markdown `[text](url)` links
 * - drops query string and hash
 * - lowercases host + trims trailing slash
 * - rewrites Handshake `/job-search/{id}` → `/jobs/{id}`
 */
export function normalizeJobUrl(raw?: string): string {
  const cleaned = cleanJobUrl(raw);
  if (!cleaned) return "";
  try {
    const u = new URL(cleaned);
    let pathname = u.pathname.replace(/\/+$/, "");
    if (/joinhandshake\.com$/i.test(u.hostname)) {
      pathname = pathname.replace(/\/job-search\/(\d+)/, "/jobs/$1");
    }
    return `${u.protocol}//${u.hostname}${pathname}`.toLowerCase();
  } catch {
    return cleaned.split(/[?#]/)[0].replace(/\/+$/, "").toLowerCase();
  }
}

export function companyRoleKey(company?: string, role?: string): string {
  return `${(company ?? "").trim().toLowerCase()}::${(role ?? "").trim().toLowerCase()}`;
}

/** Scratch + aggregator dedup key: normalized URL, else company+role. */
export function jobKey(job: Pick<SourcedJob, "jobUrl" | "company" | "role">): string {
  const normalized = normalizeJobUrl(job.jobUrl);
  if (normalized) return normalized;
  return companyRoleKey(job.company, job.role);
}

/** Collapse duplicate postings (first row wins). */
export function dedupeJobList(jobs: SourcedJob[]): SourcedJob[] {
  const seen = new Set<string>();
  return jobs.filter((job) => {
    const key = jobKey(job);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
